"use client";

import { useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Tabs, useConfirm, useToast } from "@/components/ui";
import { relativeDay } from "@/lib/catalog";
import { confirmLocalinkPayment, decidePlanPayment, rejectLocalinkProof } from "@/lib/money";
import { orderShare, orderTotal, paymentTitle, usd, type OrderDoc, type PlanPaymentDoc } from "@/lib/types";

type Tab = "orders" | "pro" | "waiting";

/**
 * Money sent to Localink's own accounts by transfer: buyers paying for
 * orders at Basic shops (or choosing Localink at Pro shops), and shops paying
 * for Pro. Check each against Localink's statements, then confirm it.
 * Online and credits payments confirm themselves.
 */
export default function PaymentsPage() {
  const { orders, planPayments, shops } = useAdminData();
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("orders");
  const [busy, setBusy] = useState<string | null>(null);
  const [proof, setProof] = useState<{ url: string; title: string } | null>(null);
  const [rejecting, setRejecting] = useState<{ kind: "order"; o: OrderDoc } | { kind: "pro"; p: PlanPaymentDoc } | null>(null);
  const [reason, setReason] = useState("");

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? "Deleted shop";
  const toCheck = orders.filter((o) => o.payTo === "localink" && o.paymentStatus === "proofSent");
  const waiting = orders.filter((o) => o.payTo === "localink" && o.paymentStatus === "awaitingProof" && o.status === "readyForPickup");
  const pro = planPayments.filter((p) => p.status === "proofSent");
  const uid = user?.uid ?? "";

  async function run(id: string, job: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await job();
      toast(done);
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function confirmOrder(o: OrderDoc) {
    const ok = await confirm({
      title: `Confirm ${usd(orderTotal(o))}?`,
      message: `Only confirm once ${usd(orderTotal(o))} from ${o.payerName || o.senderName} (ref ${o.paymentRef || "—"}) is in Localink's ${paymentTitle(o.payment)} account. ${shopName(o.stallId)} is then told to hand it over, and ${usd(orderShare(o))} goes to its earnings on collection.`,
      confirm: "Yes, the money is in",
    });
    if (ok) await run(o.id, () => confirmLocalinkPayment(o), `#${o.id} confirmed. The buyer and the shop have been told.`);
  }

  async function approvePro(p: PlanPaymentDoc) {
    const ok = await confirm({
      title: `Approve ${usd(p.amount)}?`,
      message: `Only approve once ${usd(p.amount)} from ${p.payerName || shopName(p.shopId)} (ref ${p.paymentRef || "—"}) is in Localink's account. ${shopName(p.shopId)} gets ${p.months} month${p.months === 1 ? "" : "s"} of Pro.`,
      confirm: "Approve and switch Pro on",
    });
    if (ok) await run(p.id, () => decidePlanPayment(uid, p.id, "approved"), `Pro switched on for ${shopName(p.shopId)}.`);
  }

  async function reject() {
    const r = rejecting;
    if (!r) return;
    setRejecting(null);
    if (r.kind === "order") await run(r.o.id, () => rejectLocalinkProof(uid, r.o, reason.trim()), "Proof rejected. The buyer has been asked to send it again.");
    else await run(r.p.id, () => decidePlanPayment(uid, r.p.id, "rejected", reason.trim()), "Pro payment rejected. The shop has been told.");
    setReason("");
  }

  const proofButton = (url: string | null | undefined, title: string) =>
    url ? (
      url.toLowerCase().includes(".pdf") ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-surface-2">Proof (PDF) ↗</a>
      ) : (
        <Button variant="secondary" onClick={() => setProof({ url, title })}>View proof</Button>
      )
    ) : null;

  return (
    <>
      <PageHeader title="Payments to check" subtitle="Transfers to Localink's accounts. Online and credits payments confirm themselves." />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "orders", label: "Order payments", count: toCheck.length },
            { value: "pro", label: "Pro payments", count: pro.length },
            { value: "waiting", label: "Not paid yet", count: waiting.length },
          ]}
        />
      </div>

      {tab === "orders" &&
        (toCheck.length === 0 ? (
          <Empty title="Nothing to check" message="Proof sent by buyers who paid Localink by transfer shows here." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {toCheck.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">#{o.id} · {shopName(o.stallId)}</p>
                    <p className="text-sm text-ink-3">From {o.senderName} for {o.recipient?.name} · {relativeDay(o.createdAt)}</p>
                  </div>
                  <p className="text-xl font-extrabold text-brand">{usd(orderTotal(o))}</p>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                  <dt className="text-ink-3">Paid into</dt><dd>{paymentTitle(o.payment)}</dd>
                  <dt className="text-ink-3">Reference</dt><dd className="font-semibold">{o.paymentRef || "—"}</dd>
                  <dt className="text-ink-3">Paid by</dt><dd>{o.payerName || "—"}</dd>
                  {!!o.serviceFee && (<><dt className="text-ink-3">Service fee</dt><dd>{usd(o.serviceFee)} (shop gets {usd(orderShare(o))})</dd></>)}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {proofButton(o.slipUrl, `#${o.id} · ${usd(orderTotal(o))}`)}
                  <Button loading={busy === o.id} onClick={() => confirmOrder(o)}>Confirm payment</Button>
                  <Button variant="danger" onClick={() => setRejecting({ kind: "order", o })}>Reject</Button>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {tab === "pro" &&
        (pro.length === 0 ? (
          <Empty title="Nothing to check" message="Shops paying for Pro by transfer show here." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pro.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{shopName(p.shopId)}</p>
                    <p className="text-sm text-ink-3">Pro · {p.months} month{p.months === 1 ? "" : "s"} · {relativeDay(p.createdAt)}</p>
                  </div>
                  <p className="text-xl font-extrabold text-brand">{usd(p.amount)}</p>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                  <dt className="text-ink-3">Paid into</dt><dd>{paymentTitle(p.payment)}</dd>
                  <dt className="text-ink-3">Reference</dt><dd className="font-semibold">{p.paymentRef || "—"}</dd>
                  <dt className="text-ink-3">Paid by</dt><dd>{p.payerName || "—"}</dd>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {proofButton(p.slipUrl, `${shopName(p.shopId)} · ${usd(p.amount)}`)}
                  <Button loading={busy === p.id} onClick={() => approvePro(p)}>Approve</Button>
                  <Button variant="danger" onClick={() => setRejecting({ kind: "pro", p })}>Reject</Button>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {tab === "waiting" &&
        (waiting.length === 0 ? (
          <Empty title="No unpaid orders" />
        ) : (
          <Card className="divide-y divide-line">
            {waiting.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <b>#{o.id}</b> · {shopName(o.stallId)} · from {o.senderName} · {relativeDay(o.createdAt)}
                  <span className="block text-xs text-ink-3">Chosen: {paymentTitle(o.payment)}. If the money arrived without proof, you can confirm it.</span>
                </span>
                <Badge tone="danger">{usd(orderTotal(o))}</Badge>
                <Button variant="secondary" loading={busy === o.id} onClick={() => confirmOrder(o)}>Confirm payment</Button>
              </div>
            ))}
          </Card>
        ))}

      <Modal open={proof != null} onClose={() => setProof(null)} title="Proof of payment" wide>
        {proof && (
          <>
            <p className="mb-3 text-sm text-ink-3">{proof.title}</p>
            <a href={proof.url} target="_blank" rel="noreferrer" title="Open full size">
              <img src={proof.url} alt="Proof of payment" className="mx-auto max-h-[65vh] rounded-xl border border-line object-contain" />
            </a>
          </>
        )}
      </Modal>
      <Modal
        open={rejecting != null}
        onClose={() => setRejecting(null)}
        title="Reject this proof?"
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" onClick={reject}>Reject</Button></>}
      >
        <p className="mb-3 text-sm text-ink-2">{rejecting?.kind === "order" ? "The buyer is asked to check the payment and send proof again." : "The shop is told the payment could not be matched."}</p>
        <Input label="Reason (sent to them)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No payment with this reference reached our account" />
      </Modal>
    </>
  );
}
