"use client";

import { useMemo, useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { PayoutFiguresView } from "@/components/PayoutFigures";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Tabs, useToast } from "@/components/ui";
import { paymentSummary, relativeDay } from "@/lib/catalog";
import { markPayout } from "@/lib/money";
import { payoutFigures } from "@/lib/payouts";
import { isPaidPlan, PAYOUT_LABEL, PLAN_LABEL } from "@/lib/plans";
import { cents, paymentTitle, shortDate, usd, type PayoutDoc } from "@/lib/types";

const planLine = (p: PayoutDoc) => {
  const plan = isPaidPlan(p.plan) ? p.plan : "basic";
  return `${PLAN_LABEL[plan]} · ${PAYOUT_LABEL[plan].toLowerCase()}`;
};

/**
 * Payouts the Cloud Functions created on schedule (Pro and Max shops daily,
 * Standard on Mondays and Thursdays, Basic on Mondays). Each shows what the
 * buyers of its orders paid, LocalinkGo's service fee and discount, the
 * shop's share and what to send. The shop sees it as pending until it is
 * marked paid here (with the transaction reference). A failed payout goes
 * back to the shop's balance.
 */
export default function PayoutsPage() {
  const { payouts, shops, orders } = useAdminData();
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [marking, setMarking] = useState<{ p: PayoutDoc; status: "paid" | "failed" } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? "Deleted shop";
  const pending = payouts.filter((p) => p.status === "pending");
  const done = payouts.filter((p) => p.status !== "pending");
  const figures = useMemo(() => new Map(payouts.map((p) => [p.id, payoutFigures(p, payouts, orders)])), [payouts, orders]);
  const fig = (p: PayoutDoc) => figures.get(p.id)!;
  const total = (list: PayoutDoc[], k: "amount" | "buyersPaid" | "serviceFees" | "localinkNet") => cents(list.reduce((s, p) => s + fig(p)[k], 0));

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
      <PageHeader title="Payouts" subtitle={pending.length ? `${pending.length} to send · ${usd(total(pending, "amount"))}` : "Nothing to send right now"} />
      {pending.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          {[
            ["To send to shops", total(pending, "amount"), "Pending until you mark each one paid"],
            ["Buyers paid", total(pending, "buyersPaid"), "For the orders in these payouts"],
            ["LocalinkGo service fees", total(pending, "serviceFees"), "In what buyers paid"],
            ["LocalinkGo keeps", total(pending, "localinkNet"), "Fees less the discounts it paid"],
          ].map(([label, v, hint]) => (
            <Card key={label as string} className="p-3">
              <p className="text-xs font-semibold text-ink-3">{label}</p>
              <p className="text-lg font-extrabold">{usd(v as number)}</p>
              <p className="text-[11px] text-ink-3">{hint}</p>
            </Card>
          ))}
        </div>
      )}
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} options={[{ value: "pending", label: "To send", count: pending.length }, { value: "done", label: "History" }]} />
      </div>
      {tab === "pending" &&
        (pending.length === 0 ? (
          <Empty title="No payouts to send" message="They are created every morning at 06:00 (Zimbabwe time): daily for Pro and Max shops, on Mondays and Thursdays for Standard, on Mondays for Basic." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{shopName(p.shopId)}</p>
                    <p className="text-sm text-ink-3">{planLine(p)} · created {relativeDay(p.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-brand">{usd(p.amount)}</p>
                    <Badge tone="warning">Pending</Badge>
                  </div>
                </div>
                <PayoutFiguresView payout={p} f={fig(p)} audience="admin" />
                <div className="mt-3 rounded-xl bg-surface p-3 text-sm">
                  <p className="text-xs font-semibold text-ink-3">Send to</p>
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
            {done.map((p) => {
              const f = fig(p);
              return (
                <details key={p.id} className="group px-4 py-3 text-sm">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <b>{shopName(p.shopId)}</b> · {usd(p.amount)} · {shortDate(p.handledAt ?? p.createdAt)}
                      <span className="block text-xs text-ink-3">
                        {[
                          `${f.orders} order${f.orders === 1 ? "" : "s"}`,
                          `buyers paid ${usd(f.buyersPaid)}`,
                          f.serviceFees > 0 && `fees ${usd(f.serviceFees)}`,
                          paymentTitle(p.to),
                          paymentSummary(p.to),
                          p.reference && `ref ${p.reference}`,
                          p.note,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Badge tone={p.status === "paid" ? "success" : "danger"}>{p.status === "paid" ? "Paid" : "Returned"}</Badge>
                    <span className="text-ink-3 transition group-open:rotate-90">›</span>
                  </summary>
                  <PayoutFiguresView payout={p} f={f} audience="admin" />
                </details>
              );
            })}
          </Card>
        ))}
      <Modal
        open={marking != null}
        onClose={() => setMarking(null)}
        title={marking?.status === "paid" ? `Sent ${usd(marking?.p.amount ?? 0)}?` : "Could not send it?"}
        footer={<><Button variant="secondary" onClick={() => setMarking(null)}>Cancel</Button><Button variant={marking?.status === "failed" ? "danger" : "primary"} loading={busy} onClick={save}>{marking?.status === "paid" ? "Mark paid" : "Return to balance"}</Button></>}
      >
        {marking?.status === "paid" ? (
          <>
            <p className="mb-3 text-sm text-ink-2">Only mark it paid once the money has left LocalinkGo&apos;s account: until then {shopName(marking.p.shopId)} sees it as pending.</p>
            <Input label="Transaction reference" value={text} onChange={(e) => setText(e.target.value)} placeholder="From your EcoCash / bank confirmation" />
          </>
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
