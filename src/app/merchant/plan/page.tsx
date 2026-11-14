"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { Badge, Button, Card, Input, Modal, PageHeader, Pill, Spinner, Switch, useConfirm, useToast } from "@/components/ui";
import { paymentSummary } from "@/lib/catalog";
import { PRO_DAYS, renewWithCredits, saveWalletSettings, startOnlinePlanPayment, startTrial, submitPlanPayment, watchShopPlanPayments } from "@/lib/money";
import {
  activeTrial,
  canTrial,
  hiddenSummary,
  isPaidPlan,
  lapsedPlan,
  paidPlan,
  paidUntil,
  PLAN_LABEL,
  PLAN_TAGLINE,
  planFeatures,
  planOf,
  PLANS,
  priceOf,
  RANK,
  TRIAL_DAYS,
  TRIAL_ORDERS,
  type Plan,
} from "@/lib/plans";
import { cents, paymentTitle, shortDate, usd, type PlanPaymentDoc } from "@/lib/types";

const planTone: Record<Plan, string> = {
  basic: "",
  standard: "border-brand/30",
  pro: "border-accent/50 bg-accent-50",
  max: "border-ink/30",
};

/** The four plans (one column on phones), the active shop's plan or trial, and buying, renewing or trying a plan. */
export default function PlanPage() {
  const { shop, user, loaded, config, wallet } = useMerchant();
  const toast = useToast();
  const confirm = useConfirm();
  const [buying, setBuying] = useState<Plan | null>(null);
  const [trying, setTrying] = useState<Plan | null>(null);
  const [history, setHistory] = useState<PlanPaymentDoc[]>([]);
  const shopId = shop?.id;

  useEffect(() => (shopId ? watchShopPlanPayments(user.uid, shopId, setHistory, () => {}) : undefined), [user.uid, shopId]);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="choose a plan" />;

  const plan = planOf(shop);
  const paid = paidPlan(shop);
  const until = paidUntil(shop);
  const trial = activeTrial(shop);
  const lapsed = lapsedPlan(shop);
  const hidden = hiddenSummary(shop, config.limits);
  const dark = plan !== "basic";

  let line: string;
  if (trial) {
    const days = Math.ceil((trial.endsAt - Date.now()) / 864e5);
    line = `Free trial: ${days <= 1 ? "ends today" : `${days} days`} or ${trial.maxOrders - trial.orders} orders left. Then ${PLAN_LABEL[paid]}${until ? ` (paid until ${shortDate(until)})` : " until you pay"}.`;
  } else if (until) {
    line = `Paid until ${shortDate(until)}${wallet?.autoRenew !== false ? " · renews from your earnings" : ""}`;
  } else if (lapsed) {
    line = `${PLAN_LABEL[lapsed]} ended ${shortDate(shop.planUntil ?? shop.proUntil)}. Your settings are kept: renew any time.`;
  } else {
    line = `Free. Try a paid plan free for ${TRIAL_DAYS} days, or upgrade any time.`;
  }

  async function tryPlan(p: Plan) {
    const ok = await confirm({
      title: `Try ${PLAN_LABEL[p]} free`,
      message: `For ${TRIAL_DAYS} days or ${TRIAL_ORDERS} orders, whichever comes first. Then ${shop!.name} goes back to ${PLAN_LABEL[paid]} until you pay for ${PLAN_LABEL[p]}. Nothing is deleted: anything only ${PLAN_LABEL[p]} has stays saved and is just hidden from buyers.`,
      confirm: "Start free trial",
    });
    if (!ok) return;
    setTrying(p);
    const err = await startTrial(user.uid, shop!.id, p);
    setTrying(null);
    toast(err ?? `${PLAN_LABEL[p]} trial is on for ${shop!.name}.`, err ? "error" : undefined);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Plans" subtitle={`${shop.name} · each of your shops has its own plan`} />
      <Card className={`flex items-center gap-4 p-5 ${dark ? "bg-ink text-white" : "bg-brand-50/60"}`}>
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${dark ? "bg-accent text-white" : "bg-white text-brand"}`}><Icon name={dark ? "sparkles" : "store"} className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{shop.name} is on {PLAN_LABEL[plan]}{trial ? " (trial)" : ""}</p>
          <p className={`text-sm ${dark ? "text-white/70" : "text-ink-3"}`}>{line}</p>
        </div>
      </Card>
      {hidden && (
        <p className="mt-3 rounded-2xl bg-accent-50 px-4 py-3 text-sm text-accent-800">
          Saved but hidden from buyers on {PLAN_LABEL[plan]}: {hidden}. Nothing was deleted: it shows again when you upgrade.
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const current = p === plan;
          const isTrial = trial?.plan === p;
          const paidHere = paid === p && p !== "basic";
          const label = paidHere
            ? "Add another month"
            : lapsed === p
              ? `Renew ${PLAN_LABEL[p]}`
              : paid !== "basic" && RANK[p] < RANK[paid]
                ? `Switch to ${PLAN_LABEL[p]}`
                : `${isTrial ? "Keep" : "Get"} ${PLAN_LABEL[p]}`;
          return (
            <Card key={p} className={`flex flex-col p-5 ${planTone[p]} ${current ? "ring-2 ring-brand" : ""}`}>
              <div className="flex items-center gap-2">
                <Badge tone={p === "max" ? "dark" : p === "pro" ? "warning" : p === "standard" ? "brand" : "neutral"}>{PLAN_LABEL[p]}</Badge>
                {current && <Badge tone="brand">{isTrial ? "Trial" : "Current"}</Badge>}
              </div>
              <p className="mt-3 text-3xl font-extrabold">
                {p === "basic" ? "$0" : usd(priceOf(p, config)).replace(".00", "")}
                {p !== "basic" && <span className="text-base font-semibold text-ink-3"> / month</span>}
              </p>
              <p className="text-sm text-ink-3">{PLAN_TAGLINE[p]}</p>
              <ul className="mt-4 flex-1 space-y-3 border-t border-line pt-4">
                {planFeatures(p, config).map((f) => (
                  <li key={f.title} className="flex gap-2.5">
                    <span className={`mt-0.5 ${f.ok ? "text-mint-600" : "text-ink-3"}`}><Icon name={f.ok ? "checkCircle" : "xCircle"} className="size-4" /></span>
                    <span>
                      <span className="block text-sm font-semibold">{f.title}</span>
                      <span className="block text-sm text-ink-3">{f.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {isPaidPlan(p) && (
                <div className="mt-4 space-y-2">
                  <Button className="w-full" onClick={() => setBuying(p)}>{label} · {usd(priceOf(p, config)).replace(".00", "")}/mo</Button>
                  {canTrial(shop, p) ? (
                    <>
                      <Button variant="secondary" className="w-full" loading={trying === p} onClick={() => tryPlan(p)}>Try free for {TRIAL_DAYS} days</Button>
                      <p className="text-center text-xs text-ink-3">Or {TRIAL_ORDERS} orders, whichever comes first. No payment needed.</p>
                    </>
                  ) : (
                    (shop.trialsUsed ?? []).includes(p) && !isTrial && !paidHere && <p className="text-center text-xs text-ink-3">Free trial used</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 p-4">
        <Switch
          checked={wallet?.autoRenew !== false}
          onChange={(autoRenew) => saveWalletSettings(user.uid, shop.id, { autoRenew }).catch((e: Error) => toast(`Could not save: ${e.message}`, "error"))}
          label="Renew from earnings"
          description={`When a paid plan runs out, Localink takes the next month from this shop's earnings if there is enough (${usd(wallet?.balance ?? 0)} now).`}
        />
      </Card>

      {history.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-bold">Your plan payments</h2>
          <Card className="divide-y divide-line">
            {history.slice(0, 8).map((h) => {
              const hp = isPaidPlan(h.plan) ? h.plan : "pro";
              return (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex-1">{PLAN_LABEL[hp]} · {usd(h.amount)} · {h.months} month{h.months === 1 ? "" : "s"} · {shortDate(h.createdAt)}{h.note ? ` · ${h.note}` : ""}</span>
                  <Badge tone={h.status === "approved" ? "success" : h.status === "rejected" ? "danger" : "warning"}>{h.status === "approved" ? `${PLAN_LABEL[hp]} switched on` : h.status === "rejected" ? "Not accepted" : "Localink is checking"}</Badge>
                </div>
              );
            })}
          </Card>
        </>
      )}

      {buying && <BuyPlan plan={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}

/** Buys or renews [plan]: from the shop's earnings, online, or by transfer to Localink with proof. */
function BuyPlan({ plan, onClose }: { plan: Plan; onClose: () => void }) {
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
  const monthly = priceOf(plan, config);
  const price = cents(monthly * months);
  const balance = wallet?.balance ?? 0;
  const transfer = config.options.find((o) => o.id === method);
  const current = paidPlan(shop);
  const until = paidUntil(shop);
  const left = until ? (until - Date.now()) / 864e5 : 0;
  const carry = current !== "basic" && current !== plan && left >= 1 ? Math.floor((left * priceOf(current, config)) / monthly) : null;

  async function pay() {
    if (!method) return toast("Choose how to pay.", "error");
    setBusy(true);
    try {
      if (method === "credits") {
        const err = await renewWithCredits(user.uid, shop!.id, plan, months);
        if (err) return toast(err, "error");
        toast(`${PLAN_LABEL[plan]} is on. Paid from this shop's earnings.`);
      } else if (method === "online") {
        const r = await startOnlinePlanPayment(user.uid, shop!.id, plan, months);
        if (r.error || !r.url) return toast(r.error ?? "Could not start the payment.", "error");
        window.open(r.url, "_blank", "noopener");
        toast(`${PLAN_LABEL[plan]} switches on as soon as your payment goes through.`);
      } else {
        setTried(true);
        if (!file || !reference.trim() || !payer.trim() || !transfer) return;
        await submitPlanPayment(user.uid, shop!, plan, months, price, transfer, file, reference.trim(), payer.trim());
        toast(`Proof sent. Localink switches ${PLAN_LABEL[plan]} on once it has checked your payment.`);
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
      title={current === plan ? `Add ${PLAN_LABEL[plan]} months` : `Get ${PLAN_LABEL[plan]} for ${shop.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={pay}>Pay {usd(price)}</Button></>}
    >
      <p className="text-sm text-ink-3">{PLAN_TAGLINE[plan]}.</p>
      <p className="mb-2 mt-4 text-sm font-bold">How long</p>
      <div className="flex flex-wrap gap-2">
        {[1, 3, 6, 12].map((m) => <Pill key={m} selected={months === m} onClick={() => setMonths(m)}>{m} month{m === 1 ? "" : "s"}</Pill>)}
      </div>
      <p className="mt-2 text-xs text-ink-3">{usd(monthly)} × {months} = {usd(price)} · {PRO_DAYS * months} days{current === plan ? `, added to the ${PLAN_LABEL[plan]} time left` : ""}.</p>
      {carry != null && <p className="mt-1 text-xs text-brand">The {Math.floor(left)} days left on {PLAN_LABEL[current]} become {carry} days of {PLAN_LABEL[plan]}, before the months you buy now.</p>}
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
            <dt className="text-ink-3">Reference</dt><dd className="font-semibold">{plan.toUpperCase()}-{shop.id}</dd>
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

