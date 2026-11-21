"use client";

import { useEffect, useState, type FormEvent } from "react";

import { useAdminData } from "@/components/AdminData";
import { PaymentForm } from "@/components/merchant/ShopForm";
import { Button, Card, Input, Modal, PageHeader, Pill, Switch, useConfirm, useToast } from "@/components/ui";
import { paymentSummary } from "@/lib/catalog";
import { savePaymentsConfig, saveSecureSettings, watchKycConfig, watchPesepayConfig, type PesepayFlags } from "@/lib/money";
import { PLAN_LABEL, PLANS, tierOffer, type Plan } from "@/lib/plans";
import { paymentTitle, type PaymentOption, type PaymentsConfig } from "@/lib/types";

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "stalllinkweb";
/** Where Didit posts status changes (functions/src/kyc.ts diditWebhook). */
const WEBHOOK_URL = `https://us-central1-${PROJECT}.cloudfunctions.net/diditWebhook`;

type TierForm = { minSpend: string; amount: string; percent: string };
const num = (s: string) => (s.trim() === "" ? 0 : Number(s));

/** Per plan, as typed: empty means no limit. */
type LimitsForm = Record<Plan, { products: string; branches: string }>;
const limitText = (n: number | null) => (n == null ? "" : String(n));
const limitValue = (s: string) => (s.trim() === "" ? null : Number(s));
const limitErr = (s: string) => (s.trim() !== "" && !(Number.isInteger(Number(s)) && Number(s) >= 0) ? "A whole number, or empty" : null);
function toLimitsForm(l: PaymentsConfig["limits"]): LimitsForm {
  return Object.fromEntries(PLANS.map((p) => [p, { products: limitText(l[p].products), branches: limitText(l[p].branches) }])) as LimitsForm;
}

/** Something that needs the developer password; [run] returns the message shown afterwards. */
type Guarded = { title: string; what: string; run: (password: string) => Promise<string> };

/**
 * LocalinkGo's own settings (`config/payments`): the accounts buyers (and shops
 * paying for a plan) pay into, the plan prices and service fees, and
 * LocalinkGo's discount for big baskets. Plus, behind the developer password,
 * online payments (Pesepay) and identity checks (Didit), whose keys the Cloud
 * Functions keep and nobody can read back here.
 */
export default function SettingsPage() {
  const { config, loaded } = useAdminData();
  const confirm = useConfirm();
  const toast = useToast();
  const [c, setC] = useState<PaymentsConfig>(config);
  const [prices, setPrices] = useState({ standard: "", pro: "", max: "", basicFee: "", standardFee: "" });
  const [tiers, setTiers] = useState<TierForm[]>([]);
  const [limits, setLimits] = useState<LimitsForm>(() => toLimitsForm(config.limits));
  const [cap, setCap] = useState("");
  const [editing, setEditing] = useState<PaymentOption | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [pesepay, setPesepay] = useState({ integrationKey: "", encryptionKey: "" });
  const [pesepaySet, setPesepaySet] = useState<PesepayFlags>({});
  const [mode, setMode] = useState<"live" | "test" | null>(null);
  const [didit, setDidit] = useState({ apiKey: "", workflowId: "", webhookSecret: "" });
  const [kycSet, setKycSet] = useState<{ apiKeySet?: boolean; workflowSet?: boolean; webhookSet?: boolean; updatedAt?: number }>({});
  const [newPassword, setNewPassword] = useState({ next: "", again: "" });
  const [guard, setGuard] = useState<Guarded | null>(null);

  useEffect(() => watchKycConfig(setKycSet), []);
  useEffect(() => watchPesepayConfig(setPesepaySet), []);
  const savedMode = pesepaySet.mode ?? "live";
  const shownMode = mode ?? savedMode;

  // Follow the saved settings until the admin starts editing.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched) return;
    setC(config);
    setPrices({
      standard: String(config.standardMonthly),
      pro: String(config.proMonthly),
      max: String(config.maxMonthly),
      basicFee: String(config.serviceFeePercent),
      standardFee: String(config.standardFeePercent),
    });
    setTiers(config.rewards.tiers.map((t) => ({ minSpend: String(t.minSpend), amount: t.amount ? String(t.amount) : "", percent: t.percent ? String(t.percent) : "" })));
    setCap(config.rewards.capPer30Days ? String(config.rewards.capPer30Days) : "");
    setLimits(toLimitsForm(config.limits));
  }, [config, touched]);
  const setLimit = (p: Plan, k: "products" | "branches", v: string) => {
    setTouched(true);
    setLimits((l) => ({ ...l, [p]: { ...l[p], [k]: v } }));
  };
  // A higher plan never shows buyers less than a lower one.
  const limitErrors = (p: Plan, k: "products" | "branches") => {
    const own = limitErr(limits[p][k]);
    if (own) return own;
    const i = PLANS.indexOf(p);
    if (i === 0) return null;
    const lower = limitValue(limits[PLANS[i - 1]][k]);
    const mine = limitValue(limits[p][k]);
    return lower == null ? (mine == null ? null : `No limit on ${PLAN_LABEL[PLANS[i - 1]]}`) : mine != null && mine < lower ? `At least ${lower} (${PLAN_LABEL[PLANS[i - 1]]})` : null;
  };
  const edit = (patch: Partial<PaymentsConfig>) => {
    setTouched(true);
    setC((x) => ({ ...x, ...patch }));
  };
  const setPrice = (k: keyof typeof prices, v: string) => {
    setTouched(true);
    setPrices((p) => ({ ...p, [k]: v }));
  };
  const setTier = (i: number, patch: Partial<TierForm>) => {
    setTouched(true);
    setTiers((l) => l.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  };

  const priceErr = (s: string) => (!(Number(s) > 0) ? "Above $0" : null);
  const feeErr = (s: string) => (!(Number(s) >= 0 && Number(s) <= 50) ? "Between 0 and 50%" : null);
  const errs = {
    standard: priceErr(prices.standard),
    pro: priceErr(prices.pro),
    max: priceErr(prices.max),
    basicFee: feeErr(prices.basicFee),
    standardFee: feeErr(prices.standardFee),
  };
  const tierErr = (t: TierForm) =>
    !(num(t.minSpend) > 0) ? "Enter a basket size" : !(num(t.amount) > 0 || num(t.percent) > 0) ? "Enter $ off and/or % off" : num(t.percent) > 50 ? "50% at most" : num(t.amount) >= num(t.minSpend) ? "Less than the basket" : null;
  const capErr = cap.trim() && !(Number(cap) >= 0) ? "Enter an amount" : null;
  const invalid =
    Object.values(errs).some(Boolean) || tiers.some((t) => tierErr(t)) || !!capErr || PLANS.some((p) => limitErrors(p, "products") || limitErrors(p, "branches"));

  async function save() {
    if (invalid) return toast("Check the highlighted fields.", "error");
    if (!c.options.length && !config.onlineEnabled) {
      const ok = await confirm({
        title: "No way to pay LocalinkGo?",
        message: "Without an account or online payments, buyers of Basic and Standard shops cannot pay, so those shops cannot take orders.",
        confirm: "Save anyway",
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await savePaymentsConfig({
        ...c,
        standardMonthly: Number(prices.standard),
        proMonthly: Number(prices.pro),
        maxMonthly: Number(prices.max),
        serviceFeePercent: Number(prices.basicFee),
        standardFeePercent: Number(prices.standardFee),
        limits: Object.fromEntries(PLANS.map((p) => [p, { products: limitValue(limits[p].products), branches: limitValue(limits[p].branches) }])) as PaymentsConfig["limits"],
        rewards: {
          ...c.rewards,
          tiers: tiers.map((t) => ({ minSpend: num(t.minSpend), amount: num(t.amount), percent: num(t.percent) })).sort((a, b) => a.minSpend - b.minSpend),
          capPer30Days: num(cap),
          label: c.rewards.label.trim() || "LocalinkGo bulk discount",
        },
      });
      setTouched(false);
      toast("Settings saved. The app and web use them straight away.");
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  const encErr = pesepay.encryptionKey.trim() && pesepay.encryptionKey.trim().length !== 32 ? `32 characters (this has ${pesepay.encryptionKey.trim().length})` : null;

  function savePesepay() {
    const values = {
      integrationKey: pesepay.integrationKey.trim(),
      encryptionKey: pesepay.encryptionKey.trim(),
      ...(mode && mode !== savedMode ? { mode } : !pesepaySet.mode ? { mode: shownMode } : {}),
    };
    if (encErr) return toast("The encryption key has 32 characters.", "error");
    if (!values.integrationKey && !values.encryptionKey && !("mode" in values)) return toast("Enter the Pesepay keys, or choose live or test.", "error");
    setGuard({
      title: "Save Pesepay settings",
      what: "Changing the online payment settings",
      run: async (password) => {
        await saveSecureSettings("pesepay", values, password);
        setPesepay({ integrationKey: "", encryptionKey: "" });
        setMode(null);
        return "Pesepay settings saved. They cannot be read back from the browser.";
      },
    });
  }

  function switchOnline(on: boolean) {
    setGuard({
      title: on ? "Switch online payments on" : "Switch online payments off",
      what: on ? "Switching online payments on" : "Switching online payments off",
      run: async (password) => {
        await saveSecureSettings("pesepay", { onlineEnabled: on }, password);
        return on ? "Online payments are on: buyers and shops can pay with Pesepay." : "Online payments are off.";
      },
    });
  }

  function saveDidit() {
    if (!didit.apiKey.trim() && !didit.workflowId.trim() && !didit.webhookSecret.trim()) return toast("Enter at least one of the Didit settings.", "error");
    const values = { ...didit };
    setGuard({
      title: "Save Didit settings",
      what: "Changing the identity check settings",
      run: async (password) => {
        await saveSecureSettings("didit", values, password);
        setDidit({ apiKey: "", workflowId: "", webhookSecret: "" });
        return "Didit settings saved. They cannot be read back from the browser.";
      },
    });
  }

  const passwordErr = newPassword.next && newPassword.next.length < 6 ? "At least 6 characters" : null;
  const againErr = newPassword.again && newPassword.again !== newPassword.next ? "Not the same" : null;
  function changePassword() {
    if (!newPassword.next || passwordErr || againErr || newPassword.again !== newPassword.next) return toast("Enter the new password twice (at least 6 characters).", "error");
    const next = newPassword.next;
    setGuard({
      title: "Change the developer password",
      what: "Changing the developer password",
      run: async (password) => {
        await saveSecureSettings("password", { newPassword: next }, password);
        setNewPassword({ next: "", again: "" });
        return "Developer password changed. Use the new one from now on.";
      },
    });
  }

  const r = c.rewards;
  const setRewards = (patch: Partial<PaymentsConfig["rewards"]>) => edit({ rewards: { ...r, ...patch } });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="How buyers pay LocalinkGo, what LocalinkGo charges, LocalinkGo's own discounts, online payments and identity checks." />
      {!loaded && <p className="text-sm text-ink-3">Loading…</p>}

      <Card className="p-5">
        <h2 className="text-lg font-bold">LocalinkGo&apos;s accounts</h2>
        <p className="mt-0.5 text-sm text-ink-3">Buyers at Basic and Standard shops pay into these and upload proof; you confirm it under Payments to check. Shops can pay for their plan into them too.</p>
        <div className="mt-4 space-y-2">
          {c.options.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{paymentTitle(p)}</span>
                <span className="block truncate text-xs text-ink-3">{paymentSummary(p)}</span>
              </span>
              <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setEditing(p)}>Edit</button>
              <button type="button" className="text-sm font-semibold text-red-700 hover:underline" onClick={() => edit({ options: c.options.filter((x) => x.id !== p.id) })}>Remove</button>
            </div>
          ))}
          {!c.options.length && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">No accounts yet. Add at least one (e.g. LocalinkGo&apos;s EcoCash merchant number) so Basic shops can take orders.</p>}
        </div>
        <Button variant="secondary" className="mt-3" onClick={() => setEditing("new")}>+ Add account</Button>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">Plans</h2>
          <p className="mt-0.5 text-sm text-ink-3">Monthly prices, and the service fee added to what buyers pay. Pro and Max shops pay no fee. Each paid plan has a free trial of 7 days or 10 orders.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Standard, per month" prefix="$" inputMode="decimal" value={prices.standard} onChange={(e) => setPrice("standard", e.target.value)} error={errs.standard} />
          <Input label="Pro, per month" prefix="$" inputMode="decimal" value={prices.pro} onChange={(e) => setPrice("pro", e.target.value)} error={errs.pro} />
          <Input label="Max, per month" prefix="$" inputMode="decimal" value={prices.max} onChange={(e) => setPrice("max", e.target.value)} error={errs.max} hint="For bulk sellers: bulk prices, no limits." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Service fee at Basic shops (%)" inputMode="decimal" value={prices.basicFee} onChange={(e) => setPrice("basicFee", e.target.value)} error={errs.basicFee} />
          <Input label="Service fee at Standard shops (%)" inputMode="decimal" value={prices.standardFee} onChange={(e) => setPrice("standardFee", e.target.value)} error={errs.standardFee} />
        </div>
        <div className="border-t border-line pt-4">
          <p className="text-sm font-bold">Limits</p>
          <p className="mt-0.5 text-xs text-ink-3">
            How many products and extra branches (collection points besides the main shop) each plan shows buyers. Leave empty for no limit. Lowering a limit never deletes
            anything: what is over it is kept and only hidden from buyers until the shop upgrades.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="pb-1.5 font-semibold">Plan</th>
                  <th className="pb-1.5 font-semibold">Products buyers see</th>
                  <th className="pb-1.5 font-semibold">Extra branches</th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map((p) => (
                  <tr key={p} className="align-top">
                    <td className="py-1.5 pr-3 pt-4 font-semibold">{PLAN_LABEL[p]}</td>
                    <td className="py-1.5 pr-3">
                      <Input inputMode="numeric" value={limits[p].products} placeholder="No limit" aria-label={`${PLAN_LABEL[p]}: products buyers see`} onChange={(e) => setLimit(p, "products", e.target.value)} error={limitErrors(p, "products")} />
                    </td>
                    <td className="py-1.5">
                      <Input inputMode="numeric" value={limits[p].branches} placeholder="No limit" aria-label={`${PLAN_LABEL[p]}: extra branches`} onChange={(e) => setLimit(p, "branches", e.target.value)} error={limitErrors(p, "branches")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">LocalinkGo discount for big baskets</h2>
          <p className="mt-0.5 text-sm text-ink-3">
            LocalinkGo&apos;s own promotion for customers who buy a lot, separate from shops&apos; discounts. The buyer pays less; the shop is still paid its full price and
            LocalinkGo pays the difference (shown on each payout). Only on orders paid through LocalinkGo.
          </p>
        </div>
        <Switch checked={r.enabled} onChange={(enabled) => setRewards({ enabled })} label="Offer the discount" description="Buyers see it at checkout, and how much more to add to reach the next step." />
        <div>
          <p className="mb-1.5 text-sm font-semibold">Counted on</p>
          <div className="flex flex-wrap gap-2">
            <Pill selected={r.basis === "order"} onClick={() => setRewards({ basis: "order" })}>This basket</Pill>
            <Pill selected={r.basis === "month"} onClick={() => setRewards({ basis: "month" })}>The customer&apos;s last 30 days</Pill>
          </div>
          <p className="mt-1 text-xs text-ink-3">
            {r.basis === "order"
              ? "A basket over the amount gets the discount."
              : "Once a customer's paid orders in the last 30 days (this basket included) pass the amount, the discount applies to each order."}
          </p>
        </div>
        <div className="space-y-2">
          {tiers.map((t, i) => {
            const e = tierErr(t);
            return (
              <div key={i} className="rounded-2xl border border-line p-3">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                  <Input label="Basket from" prefix="$" inputMode="decimal" value={t.minSpend} onChange={(ev) => setTier(i, { minSpend: ev.target.value })} />
                  <Input label="$ off" prefix="$" inputMode="decimal" value={t.amount} onChange={(ev) => setTier(i, { amount: ev.target.value })} />
                  <Input label="% off" inputMode="decimal" value={t.percent} onChange={(ev) => setTier(i, { percent: ev.target.value })} />
                  <button type="button" className="h-11 px-2 text-sm font-semibold text-red-700 hover:underline" onClick={() => { setTouched(true); setTiers((l) => l.filter((_, j) => j !== i)); }}>Remove</button>
                </div>
                <p className={`mt-1 text-xs ${e ? "text-red-700" : "text-ink-3"}`}>
                  {e ?? `Spend $${num(t.minSpend)}${r.basis === "month" ? " in 30 days" : ""}: ${tierOffer({ amount: num(t.amount), percent: num(t.percent) })}`}
                </p>
              </div>
            );
          })}
          <Button variant="secondary" onClick={() => { setTouched(true); setTiers((l) => [...l, { minSpend: "", amount: "", percent: "" }]); }}>+ Add a step</Button>
          <p className="text-xs text-ink-3">The best step a basket reaches applies (steps do not add up). E.g. $150 and up: $10 off.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Most one customer gets in 30 days" prefix="$" inputMode="decimal" value={cap} onChange={(e) => { setTouched(true); setCap(e.target.value); }} error={capErr} hint="Leave empty for no limit." />
          <Input label="What buyers see" value={r.label} onChange={(e) => setRewards({ label: e.target.value })} placeholder="LocalinkGo bulk discount" maxLength={40} />
        </div>
      </Card>

      <p className="mb-2 mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-3">
        <span aria-hidden>🔒</span> Developer password needed to change these
      </p>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">Online payments (Pesepay)</h2>
          <p className="mt-0.5 text-sm text-ink-3">
            EcoCash, InnBucks, Zimswitch, Visa and Mastercard on Pesepay&apos;s page; paid orders and plans confirm themselves. Use the integration key and encryption key from
            your Pesepay account. Try it in test mode first.
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Saved: integration key {pesepaySet.integrationKeySet ? "✓" : "—"} · encryption key {pesepaySet.encryptionKeySet ? "✓" : "—"} · {savedMode === "test" ? "test mode" : "live"}
            {" "}(or set in the functions&apos; .env file).
          </p>
        </div>
        <Switch
          checked={config.onlineEnabled}
          onChange={switchOnline}
          label="Offer online payment"
          description={config.onlineEnabled ? "Buyers and shops can pay online now." : "Switch on once the Pesepay keys are saved and a test payment worked."}
        />
        <div className="border-t border-line pt-4">
          <p className="mb-1.5 text-sm font-semibold">Pesepay account</p>
          <div className="flex flex-wrap gap-2">
            <Pill selected={shownMode === "live"} onClick={() => setMode("live")}>Live</Pill>
            <Pill selected={shownMode === "test"} onClick={() => setMode("test")}>Test (sandbox)</Pill>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Integration key" type="password" value={pesepay.integrationKey} onChange={(e) => setPesepay((p) => ({ ...p, integrationKey: e.target.value }))} autoComplete="new-password" />
          <Input label="Encryption key" type="password" value={pesepay.encryptionKey} onChange={(e) => setPesepay((p) => ({ ...p, encryptionKey: e.target.value }))} autoComplete="new-password" error={encErr} hint="32 characters" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={savePesepay}>Save Pesepay settings</Button>
          <p className="text-xs text-ink-3">Only the fields you fill in are replaced. Nobody can read them back here.</p>
        </div>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">Identity checks (Didit)</h2>
          <p className="mt-0.5 text-sm text-ink-3">
            Shop owners verify their identity with Didit; a shop can only be verified once its owner is. In the Didit console, create a &quot;Verifying users&quot; (KYC)
            workflow, and under API &amp; Webhooks add this webhook for <b>status.updated</b>:
          </p>
          <p className="mt-2 break-all rounded-xl bg-surface px-3 py-2 font-mono text-xs">{WEBHOOK_URL}</p>
          <p className="mt-2 text-xs text-ink-3">
            Saved: API key {kycSet.apiKeySet ? "✓" : "—"} · Workflow ID {kycSet.workflowSet ? "✓" : "—"} · Webhook secret {kycSet.webhookSet ? "✓" : "—"}
            {" "}(or set in the functions&apos; .env file). A sandbox key (sk_test_…) runs mock checks; switch to the live key to go live.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="API key" type="password" value={didit.apiKey} onChange={(e) => setDidit((d) => ({ ...d, apiKey: e.target.value }))} autoComplete="new-password" placeholder="sk_…" />
          <Input label="Workflow ID" value={didit.workflowId} onChange={(e) => setDidit((d) => ({ ...d, workflowId: e.target.value }))} autoComplete="off" placeholder="from Workflows" />
          <Input label="Webhook secret" type="password" value={didit.webhookSecret} onChange={(e) => setDidit((d) => ({ ...d, webhookSecret: e.target.value }))} autoComplete="new-password" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={saveDidit}>Save Didit settings</Button>
          <p className="text-xs text-ink-3">Only the fields you fill in are replaced. Nobody can read them back here.</p>
        </div>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">Developer password</h2>
          <p className="mt-0.5 text-sm text-ink-3">
            Needed to change online payments and identity checks, so a signed-in admin cannot change them by accident or on purpose. Five wrong tries lock the settings for 15
            minutes, and the other admins are told about every change.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="New password" type="password" value={newPassword.next} onChange={(e) => setNewPassword((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" error={passwordErr} />
          <Input label="New password again" type="password" value={newPassword.again} onChange={(e) => setNewPassword((p) => ({ ...p, again: e.target.value }))} autoComplete="new-password" error={againErr} />
        </div>
        <Button variant="secondary" onClick={changePassword}>Change developer password</Button>
      </Card>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t border-line bg-surface/95 py-3 backdrop-blur">
        {touched && <Button variant="secondary" onClick={() => setTouched(false)}>Undo changes</Button>}
        <Button loading={saving} disabled={!touched} onClick={save}>Save settings</Button>
      </div>

      {editing && (
        <PaymentForm
          existing={editing === "new" ? null : editing}
          defaultAccountName="LocalinkGo"
          onClose={() => setEditing(null)}
          onSave={(p) => {
            edit({ options: c.options.some((x) => x.id === p.id) ? c.options.map((x) => (x.id === p.id ? p : x)) : [...c.options, p] });
            setEditing(null);
          }}
        />
      )}
      {guard && <DeveloperPassword guard={guard} onClose={() => setGuard(null)} />}
    </div>
  );
}

/** Asks for the developer password and runs [guard] with it; stays open on a wrong one. */
function DeveloperPassword({ guard, onClose }: { guard: Guarded; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!password) return setError("Enter the developer password.");
    setBusy(true);
    setError(null);
    try {
      toast(await guard.run(password));
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={guard.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={() => submit()}>Confirm</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink-3">{guard.what} needs the developer password.</p>
        <Input label="Developer password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" autoFocus error={error} />
      </form>
    </Modal>
  );
}
