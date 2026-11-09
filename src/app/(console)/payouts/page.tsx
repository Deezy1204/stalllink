"use client";

import { useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Tabs, useToast } from "@/components/ui";
import { paymentSummary, relativeDay } from "@/lib/catalog";
import { markPayout } from "@/lib/money";
import { paymentTitle, shortDate, usd, type PayoutDoc } from "@/lib/types";

/**
 * Payouts the Cloud Functions created on schedule (Pro shops daily, Basic
 * shops on Mondays). Send the money to the account shown, then mark it paid
 * with the transaction reference. A failed payout goes back to the shop's balance.
 */
export default function PayoutsPage() {
  const { payouts, shops } = useAdminData();
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [marking, setMarking] = useState<{ p: PayoutDoc; status: "paid" | "failed" } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? "Deleted shop";
  const pending = payouts.filter((p) => p.status === "pending");
  const done = payouts.filter((p) => p.status !== "pending");
  const due = pending.reduce((s, p) => s + p.amount, 0);

  async function save() {
    if (!marking) return;
    if (marking.status === "paid" && !text.trim()) return toast("Enter the transaction reference.", "error");
    setBusy(true);
    try {
      await markPayout(user?.uid ?? "", marking.p.id, marking.status, marking.status === "paid" ? { reference: text.trim() } : { note: text.trim() });
      toast(marking.status === "paid" ? "Marked paid. The shop has been told." : "Marked failed. The money is back in the shop's balance.");
      setMarking(null);
      setText("");
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Payouts" subtitle={pending.length ? `${pending.length} to send · ${usd(due)}` : "Nothing to send right now"} />
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} options={[{ value: "pending", label: "To send", count: pending.length }, { value: "done", label: "History" }]} />
      </div>
      {tab === "pending" &&
        (pending.length === 0 ? (
          <Empty title="No payouts to send" message="They are created every morning at 06:00 (Zimbabwe time): daily for Pro shops, on Mondays for Basic shops." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{shopName(p.shopId)}</p>
                    <p className="text-sm text-ink-3">{p.plan === "pro" ? "Pro · daily" : "Basic · weekly"} · created {relativeDay(p.createdAt)}</p>
                  </div>
                  <p className="text-xl font-extrabold text-brand">{usd(p.amount)}</p>
                </div>
                <div className="mt-3 rounded-xl bg-surface p-3 text-sm">
                  <p className="font-semibold">{paymentTitle(p.to)}</p>
                  <p className="text-ink-2">{paymentSummary(p.to)}</p>
                  {p.to?.instructions && <p className="text-xs text-ink-3">{p.to.instructions}</p>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setMarking({ p, status: "paid" })}>Mark paid</Button>
                  <Button variant="danger" onClick={() => setMarking({ p, status: "failed" })}>Could not send</Button>
                </div>
              </Card>
            ))}
          </div>
        ))}
      {tab === "done" &&
        (done.length === 0 ? (
          <Empty title="No payouts yet" />
        ) : (
          <Card className="divide-y divide-line">
            {done.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <b>{shopName(p.shopId)}</b> · {usd(p.amount)} · {shortDate(p.handledAt ?? p.createdAt)}
                  <span className="block text-xs text-ink-3">{[paymentTitle(p.to), paymentSummary(p.to), p.reference && `ref ${p.reference}`, p.note].filter(Boolean).join(" · ")}</span>
                </span>
                <Badge tone={p.status === "paid" ? "success" : "danger"}>{p.status === "paid" ? "Paid" : "Returned"}</Badge>
              </div>
            ))}
          </Card>
        ))}
      <Modal
        open={marking != null}
        onClose={() => setMarking(null)}
        title={marking?.status === "paid" ? `Sent ${usd(marking?.p.amount ?? 0)}?` : "Could not send it?"}
        footer={<><Button variant="secondary" onClick={() => setMarking(null)}>Cancel</Button><Button variant={marking?.status === "failed" ? "danger" : "primary"} loading={busy} onClick={save}>{marking?.status === "paid" ? "Mark paid" : "Return to balance"}</Button></>}
      >
        {marking?.status === "paid" ? (
          <Input label="Transaction reference" value={text} onChange={(e) => setText(e.target.value)} placeholder="From your EcoCash / bank confirmation" />
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-2">The amount goes back to the shop&apos;s balance and is paid out again on its next payout day. Tell the shop why.</p>
            <Input label="Reason" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. The EcoCash number is not registered" />
          </>
        )}
      </Modal>
    </>
  );
}
