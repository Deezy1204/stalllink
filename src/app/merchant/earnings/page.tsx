"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { PaymentForm } from "@/components/merchant/ShopForm";
import { Badge, Button, Card, PageHeader, Spinner, Switch, useToast } from "@/components/ui";
import { paymentSummary, relativeDay } from "@/lib/catalog";
import { MIN_PAYOUT, nextPayoutAt, saveWalletSettings, watchLedger, watchShopPayouts } from "@/lib/money";
import { isPro, paymentTitle, shortDate, usd, type LedgerDoc, type PayoutDoc } from "@/lib/types";

const ledgerTitle: Record<string, string> = {
  sale_paid: "Sale paid, awaiting collection",
  sale_released: "Sale collected",
  spend: "Paid an order with credits",
  plan: "Pro plan",
  payout: "Payout",
  payout_reversed: "Payout returned",
};

/** The active shop's money held by Localink: available and pending, payouts, and every change. */
export default function EarningsPage() {
  const { shop, user, loaded, wallet, profile } = useMerchant();
  const toast = useToast();
  const [ledger, setLedger] = useState<LedgerDoc[]>([]);
  const [payouts, setPayouts] = useState<PayoutDoc[]>([]);
  const [editing, setEditing] = useState(false);
  const shopId = shop?.id;

  useEffect(() => (shopId ? watchLedger(shopId, setLedger, () => setLedger([])) : undefined), [shopId]);
  useEffect(() => (shopId ? watchShopPayouts(user.uid, shopId, setPayouts, () => setPayouts([])) : undefined), [user.uid, shopId]);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="start earning" />;

  const pro = isPro(shop);
  const w = wallet;
  const next = nextPayoutAt(pro);
  const when = next.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const line = !w?.payout
    ? "Add a payout account to get paid"
    : w.autoPayout === false
      ? "Automatic payouts are off: your earnings stay here as credits"
      : (w.balance ?? 0) < MIN_PAYOUT
        ? `Next payout ${when} once you have earnings`
        : `${usd(w.balance)} is paid out ${when}`;

  const save = (s: Parameters<typeof saveWalletSettings>[2], done?: string) =>
    saveWalletSettings(user.uid, shop.id, s)
      .then(() => done && toast(done))
      .catch((e: Error) => toast(`Could not save: ${e.message}`, "error"));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Earnings" subtitle={`${shop.name} · ${pro ? "Pro: paid out daily" : "Basic: paid out weekly, on Mondays"}`} />
      <Card className="bg-ink p-5 text-white">
        <p className="text-sm font-semibold text-white/70">Available</p>
        <p className="mt-1 text-4xl font-extrabold">{usd(w?.balance ?? 0)}</p>
        <p className="mt-1 text-sm text-white/60">{line}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Pending", w?.pending ?? 0, "Paid, not collected yet"],
            ["Paid out", w?.paidOut ?? 0, ""],
            ["Spent", w?.spent ?? 0, "On Pro and at other shops"],
          ].map(([label, v, hint]) => (
            <div key={label as string} className="rounded-xl bg-white/10 p-3" title={hint as string}>
              <p className="text-xs text-white/70">{label}</p>
              <p className="font-bold">{usd(v as number)}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card className={`p-4 ${w?.payout ? "" : "border-amber-300 bg-amber-50"}`}>
          <p className="text-xs font-semibold text-ink-3">Where Localink pays you</p>
          {w?.payout ? (
            <>
              <p className="mt-1 font-bold">{paymentTitle(w.payout)}</p>
              <p className="text-sm text-ink-3">{paymentSummary(w.payout)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-amber-900">Add your EcoCash, bank or other account to receive payouts.</p>
          )}
          <Button variant="secondary" className="mt-3" onClick={() => setEditing(true)}>{w?.payout ? "Change" : "Add payout account"}</Button>
        </Card>
        <Card className="space-y-4 p-4">
          <Switch
            checked={w?.autoPayout !== false}
            onChange={(autoPayout) => save({ autoPayout })}
            label="Automatic payouts"
            description={`${pro ? "Daily" : "Weekly, on Mondays"}. Turn off to keep your earnings as credits.`}
          />
          {!pro && (
            <Link href="/merchant/plan" className="block text-sm font-semibold text-accent-800 hover:underline">Get paid daily with Pro ›</Link>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-bold">Use your earnings</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/merchant/plan" className="group">
          <Card className="h-full p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
            <p className="font-bold">{pro ? "Renew Pro" : "Pay for Pro"}</p>
            <p className="text-sm text-ink-3">Straight from this shop&apos;s balance.</p>
          </Card>
        </Link>
        <Card className="p-4">
          <p className="font-bold">Shop at other shops</p>
          <p className="text-sm text-ink-3">In the Localink app, choose &quot;Credits from {shop.name}&quot; at checkout.</p>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-bold">Payouts</h2>
      {payouts.length === 0 ? (
        <Card className="p-4 text-sm text-ink-3">No payouts yet.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {payouts.slice(0, 20).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{usd(p.amount)}</span>
                <span className="block truncate text-xs text-ink-3">
                  {[shortDate(p.handledAt ?? p.createdAt), p.to && paymentTitle(p.to), p.reference && `ref ${p.reference}`, p.note].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "warning"}>{p.status === "paid" ? "Paid" : p.status === "failed" ? "Returned to balance" : "On its way"}</Badge>
            </div>
          ))}
        </Card>
      )}

      <h2 className="mb-3 mt-8 font-bold">Activity</h2>
      {ledger.length === 0 ? (
        <Card className="p-4 text-sm text-ink-3">Nothing yet. Orders paid through Localink show here: pending once paid, available once collected.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {ledger.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{ledgerTitle[e.type] ?? "Adjustment by Localink"}</span>
                <span className="block truncate text-xs text-ink-3">
                  {relativeDay(e.createdAt)}
                  {e.note ? ` · ${e.note}` : ""}
                  {e.orderId && (
                    <>
                      {" · "}
                      <Link href={`/merchant/orders/${e.orderId}`} className="text-brand hover:underline">open order</Link>
                    </>
                  )}
                </span>
              </span>
              <span className={`font-bold ${e.amount < 0 ? "" : e.amount === 0 ? "text-ink-3" : "text-mint-800"}`}>
                {e.amount === 0 ? `${e.pending >= 0 ? "+" : "−"}${usd(Math.abs(e.pending))} pending` : `${e.amount > 0 ? "+" : "−"}${usd(Math.abs(e.amount))}`}
              </span>
            </div>
          ))}
        </Card>
      )}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3"><Icon name="shieldCheck" className="size-4" /> Only Localink can change your balance. Every change is listed here.</p>

      {editing && (
        <PaymentForm
          payout
          existing={w?.payout ?? null}
          defaultAccountName={profile.name}
          onClose={() => setEditing(false)}
          onSave={(payout) => {
            setEditing(false);
            save({ payout }, "Payout account saved.");
          }}
        />
      )}
    </div>
  );
}
