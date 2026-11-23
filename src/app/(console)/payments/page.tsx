"use client";

import { useMemo, useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmReceived } from "@/components/ConfirmReceived";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Tabs, useToast } from "@/components/ui";
import { relativeDay } from "@/lib/catalog";
import { confirmLocalinkPayment, decidePlanPayment, rejectLocalinkProof } from "@/lib/money";
import { isPaidPlan, PLAN_LABEL } from "@/lib/plans";
import { duplicatesOf, proofWarnings } from "@/lib/proofs";
import { orderShare, orderTotal, paymentTitle, placedByShop, usd, type OrderDoc, type PlanPaymentDoc } from "@/lib/types";

const planOfPayment = (p: PlanPaymentDoc) => PLAN_LABEL[isPaidPlan(p.plan) ? p.plan : "pro"];

type Tab = "orders" | "pro" | "waiting";
type Confirming = { kind: "order"; o: OrderDoc } | { kind: "pro"; p: PlanPaymentDoc };

/**
 * Money sent to LocalinkGo's own accounts by transfer: buyers paying for
 * orders at Basic shops (or choosing LocalinkGo at Pro shops), shops paying
 * for a plan, and customers of orders shops took. Check each against
 * LocalinkGo's statement, enter what arrived, then confirm it. Online and
 * credits payments confirm themselves.
 *
 * The app and firestore.rules already refuse a transaction reference or a
 * proof file that backs another payment; the warnings here also show what
 * LocalinkGo's check of the file found, and duplicates among payments sent
 * before that check existed.
 */
export default function PaymentsPage() {
  const { orders, planPayments, shops } = useAdminData();
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("orders");
  const [busy, setBusy] = useState<string | null>(null);
  const [proof, setProof] = useState<{ url: string; title: string } | null>(null);
  const [rejecting, setRejecting] = useState<Confirming | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [reason, setReason] = useState("");

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? "Deleted shop";
  const toCheck = orders.filter((o) => o.payTo === "localink" && o.paymentStatus === "proofSent");
  const waiting = orders.filter((o) => o.payTo === "localink" && o.paymentStatus === "awaitingProof" && o.status === "readyForPickup");
  const pro = planPayments.filter((p) => p.status === "proofSent");
  const uid = user?.uid ?? "";

  const everything = useMemo(
    () => [...orders.filter((o) => o.paymentRef || o.slipHash).map((doc) => ({ kind: "order" as const, doc })), ...planPayments.map((doc) => ({ kind: "plan" as const, doc }))],
    [orders, planPayments],
  );
  const orderFlags = (o: OrderDoc) => {
    const sent = o.amountSent;
    return [
      ...proofWarnings(o.proofCheck),
      ...duplicatesOf({ kind: "order", doc: o }, everything),
      ...(sent != null && sent + 0.005 < orderTotal(o) ? [`The payer says they sent ${usd(sent)}; ${usd(orderTotal(o))} is due.`] : []),
    ].filter((w, i, all) => all.indexOf(w) === i);
  };
  const planFlags = (p: PlanPaymentDoc) => {
    const sent = p.amountSent;
    return [
      ...proofWarnings(p.proofCheck),
      ...duplicatesOf({ kind: "plan", doc: p }, everything),
      ...(sent != null && sent + 0.005 < p.amount ? [`The shop says it sent ${usd(sent)}; ${usd(p.amount)} is due.`] : []),
    ].filter((w, i, all) => all.indexOf(w) === i);
  };

  async function run(id: string, job: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await job();
      toast(done);
      return true;
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function onConfirmed(received: number) {
    const c = confirming;
    if (!c) return;
    const ok =
      c.kind === "order"
        ? await run(c.o.id, () => confirmLocalinkPayment(c.o, received), `#${c.o.id} confirmed. ${placedByShop(c.o) ? "The customer and the shop have" : "The buyer and the shop have"} been told.`)
        : await run(c.p.id, () => decidePlanPayment(uid, c.p.id, "approved", "", received), `${planOfPayment(c.p)} switched on for ${shopName(c.p.shopId)}.`);
    if (ok) setConfirming(null);
  }

  async function reject() {
    const r = rejecting;
    if (!r) return;
    setRejecting(null);
    if (r.kind === "order") await run(r.o.id, () => rejectLocalinkProof(uid, r.o, reason.trim()), placedByShop(r.o) ? "Proof rejected. The customer and the shop have been told." : "Proof rejected. The buyer has been asked to send it again.");
    else await run(r.p.id, () => decidePlanPayment(uid, r.p.id, "rejected", reason.trim()), "Plan payment rejected. The shop has been told.");
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

  const flagList = (flags: string[]) =>
    flags.length > 0 && (
      <ul className="mt-3 space-y-0.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
        {flags.map((f) => <li key={f}>⚠ {f}</li>)}
      </ul>
    );

  const c = confirming;
  return (
    <>
      <PageHeader title="Payments to check" subtitle="Transfers to LocalinkGo's accounts. Check each one on LocalinkGo's statement before confirming. Online and credits payments confirm themselves." />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "orders", label: "Order payments", count: toCheck.length },
            { value: "pro", label: "Plan payments", count: pro.length },
            { value: "waiting", label: "Not paid yet", count: waiting.length },
          ]}
        />
      </div>

      {tab === "orders" &&
        (toCheck.length === 0 ? (
          <Empty title="Nothing to check" message="Proof sent by buyers who paid LocalinkGo by transfer shows here." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {toCheck.map((o) => {
              const flags = orderFlags(o);
              return (
                <Card key={o.id} className={`p-4 ${flags.length ? "ring-2 ring-red-300" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">#{o.id} · {shopName(o.stallId)}</p>
                      <p className="text-sm text-ink-3">
                        {placedByShop(o) ? `Taken by the shop for ${o.senderName}` : `From ${o.senderName}`} for {o.recipient?.name} · {relativeDay(o.createdAt)}
                      </p>
                    </div>
                    <p className="text-xl font-extrabold text-brand">{usd(orderTotal(o))}</p>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                    <dt className="text-ink-3">Paid into</dt><dd>{paymentTitle(o.payment)}</dd>
                    <dt className="text-ink-3">Reference</dt><dd className="font-semibold">{o.paymentRef || "—"}</dd>
                    <dt className="text-ink-3">Paid by</dt><dd>{o.payerName || "—"}</dd>
                    {o.amountSent != null && (<><dt className="text-ink-3">Says they sent</dt><dd>{usd(o.amountSent)}</dd></>)}
                    {!!o.serviceFee && (<><dt className="text-ink-3">Service fee</dt><dd>{usd(o.serviceFee)} (shop gets {usd(orderShare(o))})</dd></>)}
                    {!!o.localinkDiscount && (<><dt className="text-ink-3">LocalinkGo discount</dt><dd>{usd(o.localinkDiscount)} off, paid by LocalinkGo (shop gets {usd(orderShare(o))})</dd></>)}
                  </dl>
                  {flagList(flags)}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {proofButton(o.slipUrl, `#${o.id} · ${usd(orderTotal(o))}`)}
                    <Button loading={busy === o.id} onClick={() => setConfirming({ kind: "order", o })}>Confirm payment</Button>
                    <Button variant="danger" onClick={() => setRejecting({ kind: "order", o })}>Reject</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ))}

      {tab === "pro" &&
        (pro.length === 0 ? (
          <Empty title="Nothing to check" message="Shops paying for a plan by transfer show here." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pro.map((p) => {
              const flags = planFlags(p);
              return (
                <Card key={p.id} className={`p-4 ${flags.length ? "ring-2 ring-red-300" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{shopName(p.shopId)}</p>
                      <p className="text-sm text-ink-3">{planOfPayment(p)} · {p.months} month{p.months === 1 ? "" : "s"} · {relativeDay(p.createdAt)}</p>
                    </div>
                    <p className="text-xl font-extrabold text-brand">{usd(p.amount)}</p>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                    <dt className="text-ink-3">Paid into</dt><dd>{paymentTitle(p.payment)}</dd>
                    <dt className="text-ink-3">Reference</dt><dd className="font-semibold">{p.paymentRef || "—"}</dd>
                    <dt className="text-ink-3">Paid by</dt><dd>{p.payerName || "—"}</dd>
                    {p.amountSent != null && (<><dt className="text-ink-3">Says they sent</dt><dd>{usd(p.amountSent)}</dd></>)}
                  </dl>
                  {flagList(flags)}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {proofButton(p.slipUrl, `${shopName(p.shopId)} · ${usd(p.amount)}`)}
                    <Button loading={busy === p.id} onClick={() => setConfirming({ kind: "pro", p })}>Approve</Button>
                    <Button variant="danger" onClick={() => setRejecting({ kind: "pro", p })}>Reject</Button>
                  </div>
                </Card>
              );
            })}
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
                  <b>#{o.id}</b> · {shopName(o.stallId)} · {placedByShop(o) ? `taken by the shop for ${o.senderName}` : `from ${o.senderName}`} · {relativeDay(o.createdAt)}
                  <span className="block text-xs text-ink-3">Chosen: {paymentTitle(o.payment)}. If the money arrived without proof, you can confirm it once you find it on the statement.</span>
                </span>
                <Badge tone="danger">{usd(orderTotal(o))}</Badge>
                <Button variant="secondary" loading={busy === o.id} onClick={() => setConfirming({ kind: "order", o })}>Confirm payment</Button>
              </div>
            ))}
          </Card>
        ))}

      <ConfirmReceived
        open={c != null}
        onClose={() => setConfirming(null)}
        onConfirm={onConfirmed}
        busy={busy != null}
        title={c?.kind === "pro" ? `Approve ${usd(c.p.amount)}?` : c ? `Confirm ${usd(orderTotal(c.o))}?` : ""}
        confirmLabel={c?.kind === "pro" ? `Approve and switch ${planOfPayment(c.p)} on` : "Yes, the money is in"}
        due={c?.kind === "pro" ? c.p.amount : c ? orderTotal(c.o) : 0}
        account={`LocalinkGo's ${c ? paymentTitle(c.kind === "pro" ? c.p.payment : c.o.payment) : ""}`}
        reference={c?.kind === "pro" ? c.p.paymentRef : c?.o.paymentRef}
        payer={c?.kind === "pro" ? c.p.payerName || shopName(c.p.shopId) : c ? c.o.payerName || c.o.senderName : ""}
        amountSent={c?.kind === "pro" ? c.p.amountSent : c?.o.amountSent}
        warnings={c ? (c.kind === "pro" ? planFlags(c.p) : orderFlags(c.o)) : []}
      />

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
        <p className="mb-3 text-sm text-ink-2">{rejecting?.kind === "order" ? "They are asked to check the payment and send proof again." : "The shop is told the payment could not be matched."}</p>
        <Input label="Reason (sent to them)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Only $200 of $240 reached our account / No payment with this reference" />
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {["No payment with this reference reached our account", "Less than the amount due arrived", "This proof was already used for another payment", "This is not a proof of payment"].map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-line px-2.5 py-1 hover:bg-surface-2">{r}</button>
          ))}
        </div>
      </Modal>
    </>
  );
}
