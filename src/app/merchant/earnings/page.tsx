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
import { paidPlan, PAYOUT_LABEL, payoutDays, PLAN_LABEL, planOf, priceOf } from "@/lib/plans";
import { cents, paymentTitle, shortDate, usd, type LedgerDoc, type PayoutDoc } from "@/lib/types";
import { PayoutFiguresView } from "@/components/PayoutFigures";
import { payoutFigures } from "@/lib/payouts";

const ledgerTitle: Record<string, string> = {
  sale_paid: "Sale paid, awaiting collection",
  sale_released: "Sale collected",
  spend: "Paid an order with credits",
  plan: "Plan",
  payout: "Payout",
  payout_reversed: "Payout returned",
};

/** The active shop's money held by LocalinkGo: available and pending, payouts, and every change. */
export default function EarningsPage() {
  const { shop, user, loaded, wallet, profile, config, shopOrders } = useMerchant();
  const toast = useToast();
  const [ledger, setLedger] = useState<LedgerDoc[]>([]);
  const [payouts, setPayouts] = useState<PayoutDoc[]>([]);
  const [editing, setEditing] = useState(false);
  const shopId = shop?.id;

  useEffect(() => (shopId ? watchLedger(shopId, setLedger, () => setLedger([])) : undefined), [shopId]);
  useEffect(() => (shopId ? watchShopPayouts(user.uid, shopId, setPayouts, () => setPayouts([])) : undefined), [user.uid, shopId]);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="start earning" />;

  const plan = planOf(shop);
  const paid = paidPlan(shop);
  // Payouts LocalinkGo has not sent yet: out of the balance, not paid out until an admin marks them paid.
  const pendingPayouts = cents(payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0));
  const payoutById = new Map(payouts.map((p) => [p.id, p]));
  const schedule = PAYOUT_LABEL[plan];
  const w = wallet;
  const next = nextPayoutAt(plan);
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
      <PageHeader title="Earnings" subtitle={`${shop.name} · ${PLAN_LABEL[plan]}: paid out ${schedule.toLowerCase()}`} />
      <Card className="bg-ink p-5 text-white">
        <p className="text-sm font-semibold text-white/70">Available to spend or pay out</p>
        <p className="mt-1 text-4xl font-extrabold">{usd(w?.balance ?? 0)}</p>
        <p className="mt-1 text-sm text-white/60">{line}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ["Awaiting collection", w?.pending ?? 0, "Paid by buyers, not collected yet"],
            ["Payout pending", pendingPayouts, "In a payout LocalinkGo has not sent yet"],
            ["Paid out", w?.paidOut ?? 0, "Sent to you by LocalinkGo"],
            ["Earned, all time", w?.earned ?? 0, "Everything this shop has earned on LocalinkGo"],
            ["Spent", w?.spent ?? 0, "On plans and at other shops"],
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
          <p className="text-xs font-semibold text-ink-3">Where LocalinkGo pays you</p>
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
            description={`${schedule}. Turn off to keep your earnings as credits.`}
          />
          {payoutDays(plan).length > 0 && (
            <Link href="/merchant/plan" className="block text-sm font-semibold text-accent-800 hover:underline">
              {plan === "basic" ? "Get paid twice a week on Standard, daily on Pro ›" : "Get paid daily with Pro ›"}
            </Link>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-bold">Use your earnings</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/merchant/plan" className="group">
          <Card className="h-full p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
            <p className="font-bold">{paid !== "basic" ? `Renew ${PLAN_LABEL[paid]} (${usd(priceOf(paid, config))}/month)` : `Pay for a plan (from ${usd(config.standardMonthly)}/month)`}</p>
            <p className="text-sm text-ink-3">Straight from this shop&apos;s balance.</p>
          </Card>
        </Link>
        <Card className="p-4">
          <p className="font-bold">Shop at other shops</p>
          <p className="text-sm text-ink-3">In the LocalinkGo app, choose &quot;Credits from {shop.name}&quot; at checkout.</p>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-bold">Payouts</h2>
      {payouts.length === 0 ? (
        <Card className="p-4 text-sm text-ink-3">No payouts yet.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {payouts.slice(0, 20).map((p) => (
            <details key={p.id} className="group px-4 py-3 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{usd(p.amount)}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {[
                      shortDate(p.handledAt ?? p.createdAt),
                      p.breakdown?.orders && `${p.breakdown.orders} order${p.breakdown.orders === 1 ? "" : "s"}`,
                      p.breakdown?.localinkDiscount && `${usd(p.breakdown.localinkDiscount)} discounts paid by LocalinkGo`,
                      p.to && paymentTitle(p.to),
                      p.reference && `ref ${p.reference}`,
                      p.note,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "warning"}>{p.status === "paid" ? "Paid" : p.status === "failed" ? "Returned to balance" : "Pending"}</Badge>
              </summary>
              {p.status === "pending" && <p className="mt-2 text-xs text-amber-800">Pending: LocalinkGo has not sent this yet. It shows as paid, with the transaction reference, once it has.</p>}
              <PayoutFiguresView payout={p} f={payoutFigures(p, payouts, shopOrders)} audience="shop" />
            </details>
          ))}
        </Card>
      )}

      <h2 className="mb-3 mt-8 font-bold">Activity</h2>
      {ledger.length === 0 ? (
        <Card className="p-4 text-sm text-ink-3">Nothing yet. Orders paid through LocalinkGo show here: pending once paid, available once collected.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {ledger.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {e.type === "payout" && e.payoutId && payoutById.get(e.payoutId)
                    ? { pending: "Payout pending (not sent yet)", paid: "Payout sent", failed: "Payout could not be sent" }[payoutById.get(e.payoutId)!.status]
                    : (ledgerTitle[e.type] ?? "Adjustment by LocalinkGo")}
                </span>
                <span className="block truncate text-xs text-ink-3">
                  {relativeDay(e.createdAt)}
                  {e.note ? ` · ${e.note}` : ""}
                  {e.localinkDiscount ? ` · includes ${usd(e.localinkDiscount)} LocalinkGo pays for the buyer's discount` : ""}
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
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3"><Icon name="shieldCheck" className="size-4" /> Only LocalinkGo can change your balance. Every change is listed here.</p>

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
