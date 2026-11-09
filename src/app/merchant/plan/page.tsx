"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { Badge, Button, Card, Input, Modal, PageHeader, Pill, Spinner, Switch, useToast } from "@/components/ui";
import { paymentSummary } from "@/lib/catalog";
import { PRO_DAYS, renewWithCredits, saveWalletSettings, startOnlinePlanPayment, submitPlanPayment, watchShopPlanPayments } from "@/lib/money";
import { cents, isPro, paymentTitle, shortDate, usd, type PaymentsConfig, type PlanPaymentDoc } from "@/lib/types";

/** What Basic and Pro shops get (the same comparison as the app's Plans screen). */
function features(c: PaymentsConfig) {
  return [
    { title: "Service fee on your orders", basic: `${c.serviceFeePercent}% added to what buyers pay`, pro: "None", basicOk: false },
    { title: "Take payments yourself", basic: "No: buyers pay Localink, you get paid out", pro: "Yes: your EcoCash, bank and other accounts", basicOk: false },
    { title: "Payouts of Localink payments", basic: "Weekly, on Mondays", pro: "Daily" },
    { title: "Online payments and Localink credits", basic: "Yes, through Localink", pro: "Yes, as well as your own" },
    { title: "Discounts and shop offers", basic: "Yes", pro: "Yes" },
    { title: "Spend your earnings on Pro or at other shops", basic: "Yes", pro: "Yes" },
  ];
}

/** Basic and Pro side by side, the active shop's plan, and buying or renewing Pro. */
export default function PlanPage() {
  const { shop, user, loaded, config, wallet } = useMerchant();
  const toast = useToast();
  const [buying, setBuying] = useState(false);
  const [history, setHistory] = useState<PlanPaymentDoc[]>([]);
  const shopId = shop?.id;

  useEffect(() => (shopId ? watchShopPlanPayments(user.uid, shopId, setHistory, () => {}) : undefined), [user.uid, shopId]);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="choose a plan" />;

  const pro = isPro(shop);
  const expired = !pro && !!shop.proUntil;
  const rows = features(config);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Plans"
        subtitle={`${shop.name} · each of your shops has its own plan`}
        actions={<Button onClick={() => setBuying(true)}><Icon name="sparkles" className="size-4" /> {pro ? "Add Pro months" : expired ? "Renew Pro" : "Get Pro"}</Button>}
      />
      <Card className={`flex items-center gap-4 p-5 ${pro ? "bg-ink text-white" : "bg-brand-50/60"}`}>
        <span className={`flex size-12 items-center justify-center rounded-2xl ${pro ? "bg-accent text-white" : "bg-white text-brand"}`}><Icon name={pro ? "sparkles" : "store"} className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{shop.name} is on {pro ? "Pro" : "Basic"}</p>
          <p className={`text-sm ${pro ? "text-white/70" : "text-ink-3"}`}>
            {pro
              ? `Paid until ${shortDate(shop.proUntil)}${wallet?.autoRenew !== false ? " · renews from your earnings" : ""}`
              : expired
                ? `Pro ended ${shortDate(shop.proUntil)}. Renew any time.`
                : "Free. Upgrade any time."}
          </p>
        </div>
      </Card>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(["basic", "pro"] as const).map((plan) => {
          const current = (plan === "pro") === pro;
          return (
            <Card key={plan} className={`p-5 ${plan === "pro" ? "border-accent/50 bg-accent-50" : ""} ${current ? "ring-2 ring-brand" : ""}`}>
              <div className="flex items-center gap-2">
                <Badge tone={plan === "pro" ? "dark" : "neutral"}>{plan === "pro" ? "Pro" : "Basic"}</Badge>
                {current && <Badge tone="brand">Current</Badge>}
              </div>
              <p className="mt-3 text-3xl font-extrabold">{plan === "pro" ? `${usd(config.proMonthly).replace(".00", "")}` : "$0"}<span className="text-base font-semibold text-ink-3">{plan === "pro" ? " / month" : ""}</span></p>
              <p className="text-sm text-ink-3">{plan === "pro" ? "Grow faster, keep every cent" : "Start selling for free"}</p>
              <ul className="mt-4 space-y-3 border-t border-line pt-4">
                {rows.map((f) => {
                  const ok = plan === "pro" ? true : f.basicOk !== false;
                  return (
                    <li key={f.title} className="flex gap-2.5">
                      <span className={`mt-0.5 ${ok ? "text-mint-600" : "text-ink-3"}`}><Icon name={ok ? "checkCircle" : "xCircle"} className="size-4" /></span>
                      <span>
                        <span className="block text-sm font-semibold">{f.title}</span>
                        <span className="block text-sm text-ink-3">{plan === "pro" ? f.pro : f.basic}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 p-4">
        <Switch
          checked={wallet?.autoRenew !== false}
          onChange={(autoRenew) => saveWalletSettings(user.uid, shop.id, { autoRenew }).catch((e: Error) => toast(`Could not save: ${e.message}`, "error"))}
          label="Renew from earnings"
          description={`When Pro runs out, Localink takes the next month from this shop's earnings if there is enough (${usd(wallet?.balance ?? 0)} now).`}
        />
      </Card>

      {history.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-bold">Your Pro payments</h2>
          <Card className="divide-y divide-line">
            {history.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1">{usd(p.amount)} · {p.months} month{p.months === 1 ? "" : "s"} · {shortDate(p.createdAt)}{p.note ? ` · ${p.note}` : ""}</span>
                <Badge tone={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "warning"}>{p.status === "approved" ? "Pro switched on" : p.status === "rejected" ? "Not accepted" : "Localink is checking"}</Badge>
              </div>
            ))}
          </Card>
        </>
      )}

      {buying && <BuyPro onClose={() => setBuying(false)} />}
    </div>
  );
}

/** Buys or renews Pro: from the shop's earnings, online, or by transfer to Localink with proof. */
function BuyPro({ onClose }: { onClose: () => void }) {
  const { shop, user, config, wallet, profile } = useMerchant();
  const toast = useToast();
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [payer, setPayer] = useState(profile.name);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  if (!shop) return null;
  const price = cents(config.proMonthly * months);
  const balance = wallet?.balance ?? 0;
  const transfer = config.options.find((o) => o.id === method);

  async function pay() {
    if (!method) return toast("Choose how to pay.", "error");
    setBusy(true);
    try {
      if (method === "credits") {
        const err = await renewWithCredits(user.uid, shop!.id, months);
        if (err) return toast(err, "error");
        toast("Pro is on. Paid from this shop's earnings.");
      } else if (method === "online") {
        const r = await startOnlinePlanPayment(user.uid, shop!.id, months);
        if (r.error || !r.url) return toast(r.error ?? "Could not start the payment.", "error");
        window.open(r.url, "_blank", "noopener");
        toast("Pro switches on as soon as your payment goes through.");
      } else {
        setTried(true);
        if (!file || !reference.trim() || !payer.trim() || !transfer) return;
        await submitPlanPayment(user.uid, shop!, months, price, transfer, file, reference.trim(), payer.trim());
        toast("Proof sent. Localink switches Pro on once it has checked your payment.");
      }
      onClose();
    } catch (e) {
      toast(`Could not pay: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  const option = (id: string, title: string, sub: string, enabled = true) => (
    <button
      key={id}
      type="button"
      disabled={!enabled}
      onClick={() => setMethod(id)}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-50 ${method === id ? "border-brand bg-brand-50" : "border-line hover:bg-surface"}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-ink-3">{sub}</span>
      </span>
      <span className={`size-4 rounded-full border-2 ${method === id ? "border-brand bg-brand" : "border-line"}`} />
    </button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={isPro(shop) ? "Add Pro months" : `Get Pro for ${shop.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={pay}>Pay {usd(price)}</Button></>}
    >
      <p className="text-sm text-ink-3">No service fee on your orders, take payments yourself, and daily payouts.</p>
      <p className="mb-2 mt-4 text-sm font-bold">How long</p>
      <div className="flex flex-wrap gap-2">
        {[1, 3, 6, 12].map((m) => <Pill key={m} selected={months === m} onClick={() => setMonths(m)}>{m} month{m === 1 ? "" : "s"}</Pill>)}
      </div>
      <p className="mt-2 text-xs text-ink-3">{usd(config.proMonthly)} × {months} = {usd(price)} · {PRO_DAYS * months} days, added to any Pro time left.</p>
      <p className="mb-2 mt-5 text-sm font-bold">Pay with</p>
      <div className="space-y-2">
        {option("credits", `Earnings of ${shop.name}`, balance + 0.001 >= price ? `${usd(balance)} available · instant` : `Only ${usd(balance)} available`, balance + 0.001 >= price)}
        {config.onlineEnabled && option("online", "Pay online", "Card, EcoCash, OneMoney or InnBucks · instant")}
        {config.options.map((o) => option(o.id, paymentTitle(o), `${paymentSummary(o)} · upload proof`))}
      </div>
      {transfer && (
        <div className="mt-4 space-y-3 rounded-2xl bg-surface p-4">
          <p className="text-sm font-bold">Send {usd(price)} to Localink</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {transfer.accountNumber && (<><dt className="text-ink-3">Pay to</dt><dd className="font-semibold">{transfer.accountNumber}</dd></>)}
            {transfer.accountName && (<><dt className="text-ink-3">Account name</dt><dd>{transfer.accountName}</dd></>)}
            <dt className="text-ink-3">Reference</dt><dd className="font-semibold">PRO-{shop.id}</dd>
          </dl>
          {transfer.instructions && <p className="text-xs text-ink-3">{transfer.instructions}</p>}
          <label className="block text-sm">
            <span className="font-semibold">Proof of payment (photo or PDF)</span>
            <input type="file" accept="image/*,application/pdf" className="mt-1 block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {tried && !file && <span className="text-xs text-red-700">Attach your proof of payment.</span>}
          </label>
          <Input label="Transaction reference" value={reference} onChange={(e) => setReference(e.target.value)} error={tried && !reference.trim() ? "Enter the reference of your payment" : null} />
          <Input label="Name the payment came from" value={payer} onChange={(e) => setPayer(e.target.value)} error={tried && !payer.trim() ? "Enter the payer name" : null} />
        </div>
      )}
    </Modal>
  );
}
