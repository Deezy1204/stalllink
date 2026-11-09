"use client";

import { useEffect, useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { PaymentForm } from "@/components/merchant/ShopForm";
import { Button, Card, Input, PageHeader, Switch, useConfirm, useToast } from "@/components/ui";
import { paymentSummary } from "@/lib/catalog";
import { savePaymentsConfig, savePaynowCredentials } from "@/lib/money";
import { paymentTitle, type PaymentOption, type PaymentsConfig } from "@/lib/types";

/**
 * Localink's own payment settings (`config/payments`): the accounts buyers of
 * Basic shops (and shops buying Pro) pay into, the online gateway switch, the
 * Pro price and the service fee. The app and the Cloud Functions read them.
 */
export default function SettingsPage() {
  const { config, loaded } = useAdminData();
  const confirm = useConfirm();
  const toast = useToast();
  const [c, setC] = useState<PaymentsConfig>(config);
  const [price, setPrice] = useState(String(config.proMonthly));
  const [fee, setFee] = useState(String(config.serviceFeePercent));
  const [editing, setEditing] = useState<PaymentOption | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [paynowId, setPaynowId] = useState("");
  const [paynowKey, setPaynowKey] = useState("");

  // Follow the saved settings until the admin starts editing.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched) return;
    setC(config);
    setPrice(String(config.proMonthly));
    setFee(String(config.serviceFeePercent));
  }, [config, touched]);
  const edit = (patch: Partial<PaymentsConfig>) => {
    setTouched(true);
    setC((x) => ({ ...x, ...patch }));
  };

  const priceN = Number(price);
  const feeN = Number(fee);
  const priceErr = !(priceN > 0) ? "Enter a price above $0" : null;
  const feeErr = !(feeN >= 0 && feeN <= 50) ? "Between 0 and 50%" : null;

  async function save() {
    if (priceErr || feeErr) return;
    if (!c.options.length && !c.onlineEnabled) {
      const ok = await confirm({
        title: "No way to pay Localink?",
        message: "Without an account or online payments, buyers of Basic shops cannot pay, so those shops cannot take orders.",
        confirm: "Save anyway",
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await savePaymentsConfig({ ...c, proMonthly: priceN, serviceFeePercent: feeN });
      setTouched(false);
      toast("Payment settings saved. The app and web use them straight away.");
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveKey() {
    if (!paynowId.trim() || !paynowKey.trim()) return toast("Enter the integration ID and key.", "error");
    try {
      await savePaynowCredentials(paynowId, paynowKey);
      setPaynowId("");
      setPaynowKey("");
      toast("Paynow details saved. They cannot be read back from the browser.");
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, "error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Payment settings" subtitle="How buyers pay Localink, and what Localink charges." />
      {!loaded && <p className="text-sm text-ink-3">Loading…</p>}

      <Card className="p-5">
        <h2 className="text-lg font-bold">Localink&apos;s accounts</h2>
        <p className="mt-0.5 text-sm text-ink-3">Buyers at Basic shops pay into these and upload proof; you confirm it under Payments to check. Shops can pay for Pro into them too.</p>
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
          {!c.options.length && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">No accounts yet. Add at least one (e.g. Localink&apos;s EcoCash merchant number) so Basic shops can take orders.</p>}
        </div>
        <Button variant="secondary" className="mt-3" onClick={() => setEditing("new")}>+ Add account</Button>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <h2 className="text-lg font-bold">Prices</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Pro, per month (USD)" prefix="$" value={price} onChange={(e) => { setTouched(true); setPrice(e.target.value); }} error={priceErr} />
          <Input label="Service fee at Basic shops (%)" value={fee} onChange={(e) => { setTouched(true); setFee(e.target.value); }} error={feeErr} hint="Added to what buyers pay. Pro shops have none." />
        </div>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <h2 className="text-lg font-bold">Online payments (Paynow)</h2>
        <Switch
          checked={c.onlineEnabled}
          onChange={(onlineEnabled) => edit({ onlineEnabled })}
          label="Offer online payment"
          description="Card, EcoCash, OneMoney and InnBucks on Paynow's page; paid orders confirm themselves. Switch on only once the Paynow details below are saved and tested in Paynow's test mode."
        />
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <Input label="Paynow integration ID" value={paynowId} onChange={(e) => setPaynowId(e.target.value)} autoComplete="off" />
          <Input label="Paynow integration key" type="password" value={paynowKey} onChange={(e) => setPaynowKey(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={saveKey}>Save Paynow details</Button>
          <p className="text-xs text-ink-3">Stored for the Cloud Functions only; nobody can read them back here. Saving again replaces them.</p>
        </div>
      </Card>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t border-line bg-surface/95 py-3 backdrop-blur">
        {touched && <Button variant="secondary" onClick={() => setTouched(false)}>Undo changes</Button>}
        <Button loading={saving} disabled={!touched} onClick={save}>Save settings</Button>
      </div>

      {editing && (
        <PaymentForm
          existing={editing === "new" ? null : editing}
          defaultAccountName="Localink"
          onClose={() => setEditing(null)}
          onSave={(p) => {
            edit({ options: c.options.some((x) => x.id === p.id) ? c.options.map((x) => (x.id === p.id ? p : x)) : [...c.options, p] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
