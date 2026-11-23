"use client";

import { useEffect, useState } from "react";

import { Button, Input, Modal } from "@/components/ui";
import { parseAmount } from "@/lib/proofs";
import { usd } from "@/lib/types";

/**
 * Confirming a payment by transfer: whoever was paid types what their
 * statement shows (not the screenshot: screenshots can be edited or reused)
 * and ticks that they found the reference there. Less than is due cannot be
 * confirmed; the payer is asked for the rest (reject the proof instead).
 */
export function ConfirmReceived({
  open,
  onClose,
  onConfirm,
  busy,
  title,
  due,
  account,
  reference,
  payer,
  amountSent,
  warnings = [],
  confirmLabel = "Confirm payment",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (received: number) => void;
  busy?: boolean;
  title: string;
  due: number;
  /** Where the money should be, e.g. "LocalinkGo's EcoCash account". */
  account: string;
  reference?: string;
  payer?: string;
  amountSent?: number;
  warnings?: string[];
  confirmLabel?: string;
}) {
  const [amount, setAmount] = useState("");
  const [found, setFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setFound(false);
    setError(null);
  }, [open]);

  function submit() {
    const v = parseAmount(amount);
    if (v == null || v <= 0) return setError("Enter the amount the statement shows.");
    if (v + 0.005 < due) return setError(`Only ${usd(v)} of ${usd(due)} arrived. Do not confirm: reject the proof with the reason so they send the rest.`);
    if (!found) return setError("Tick that you found this payment on the statement.");
    onConfirm(v);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>{confirmLabel}</Button></>}
    >
      <p className="text-sm text-ink-2">
        Check {account} statement or SMS, not the screenshot: screenshots can be edited or reused. Confirm only when <b>{usd(due)}</b> has arrived.
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-3">Reference to look for</dt><dd className="font-semibold">{reference || "None given"}</dd>
        {payer && (<><dt className="text-ink-3">Paid by</dt><dd>{payer}</dd></>)}
        {amountSent != null && (<><dt className="text-ink-3">Payer says they sent</dt><dd className={amountSent + 0.005 < due ? "font-semibold text-red-700" : ""}>{usd(amountSent)}</dd></>)}
      </dl>
      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          {warnings.map((w) => <li key={w}>⚠ {w}</li>)}
        </ul>
      )}
      <div className="mt-4">
        <Input label="Amount that reached the account" prefix="$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={due.toFixed(2)} />
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-brand)]" checked={found} onChange={(e) => setFound(e.target.checked)} />
        <span>{reference ? <>I found reference <b>{reference}</b> on the statement</> : "I found this payment on the statement"}</span>
      </label>
      {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
    </Modal>
  );
}
