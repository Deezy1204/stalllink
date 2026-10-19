"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Badge, Button, Card, Modal, useConfirm, useToast } from "@/components/ui";
import { isOpenOrder, paymentStatusOf, paymentStatusText, paymentSummary, pickupPlace, relativeDay } from "@/lib/catalog";
import { confirmPayment } from "@/lib/merchant";
import { orderTotal, paymentTitle, statusLabel, usd, type OrderDoc, type ShopDoc } from "@/lib/types";
import { useMerchant } from "./MerchantData";

export const paymentTone = (o: OrderDoc) => (paymentStatusOf(o) === "confirmed" ? "success" : paymentStatusOf(o) === "proofSent" ? "warning" : "danger");

/** One order in a list: who sent it, for whom, where it stands. */
export function OrderCard({ order: o, shop, index }: { order: OrderDoc; shop?: ShopDoc; index?: number }) {
  const done = o.status === "collected";
  const place = pickupPlace(o, shop);
  return (
    <Link href={`/merchant/orders/${o.id}`} style={index == null ? undefined : ({ "--i": Math.min(index, 12) } as React.CSSProperties)} className="group block">
      <Card className="h-full p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">From {o.senderName}</p>
            <p className="truncate text-sm text-ink-3">For {o.recipient?.name} · {o.delivery ? "Delivery" : place.name}</p>
          </div>
          <Badge tone={done ? "neutral" : o.status === "readyForPickup" ? "success" : "danger"}>{done ? "Collected" : o.status === "readyForPickup" ? "Ready" : statusLabel[o.status]}</Badge>
        </div>
        <div className="mt-3 flex items-end gap-3 border-t border-line pt-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate text-xs text-ink-3">#{o.id} · {o.voucherCode}</p>
            <p className="text-ink-3">{o.items.length} item{o.items.length === 1 ? "" : "s"} · {relativeDay(o.createdAt)}</p>
            {paymentStatusOf(o) !== "confirmed" && isOpenOrder(o) && (
              <span className="mt-1 inline-block"><Badge tone={paymentTone(o)}>{paymentStatusText[paymentStatusOf(o)]}</Badge></span>
            )}
          </div>
          <p className="text-lg font-extrabold text-brand">{usd(orderTotal(o))}</p>
        </div>
      </Card>
    </Link>
  );
}

/** How the order is paid and where that stands, with the buyer's proof and the shop's Confirm button. */
export function PaymentCard({ order: o, shopName }: { order: OrderDoc; shopName: string }) {
  const { user } = useMerchant();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState(false);
  const status = paymentStatusOf(o);
  const tone = status === "confirmed" ? "border-mint-600/20 bg-mint-100 text-mint-800" : status === "proofSent" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900";
  const isPdf = (o.slipUrl ?? "").toLowerCase().includes(".pdf");

  async function onConfirm() {
    const ok = await confirm({
      title: "Payment received?",
      message: `Only confirm once ${usd(orderTotal(o))} from ${o.payerName || o.senderName} has reached your ${paymentTitle(o.payment)} account.`,
      confirm: "Yes, I received it",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await confirmPayment(user.uid, o, shopName);
      toast(`Payment confirmed. ${o.senderName.split(" ")[0]} has been told.`);
    } catch (e) {
      toast(`Could not confirm the payment: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="font-bold">{paymentStatusText[status]}</p>
      <p className="text-sm">{paymentTitle(o.payment)}{paymentSummary(o.payment) && ` · ${paymentSummary(o.payment)}`}</p>
      {(o.paymentRef || o.payerName) && <p className="text-sm">{[o.paymentRef && `Ref ${o.paymentRef}`, o.payerName && `from ${o.payerName}`].filter(Boolean).join(" · ")}</p>}
      {(o.slipUrl || status !== "confirmed") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {o.slipUrl &&
            (isPdf ? (
              <a href={o.slipUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-2">View proof (PDF) ↗</a>
            ) : (
              <Button variant="secondary" onClick={() => setProof(true)}>View proof</Button>
            ))}
          {status !== "confirmed" && <Button loading={busy} onClick={onConfirm}>Confirm payment</Button>}
        </div>
      )}
      {status === "awaitingProof" && <p className="mt-2 text-xs">The buyer has not uploaded proof yet. You can still confirm once the money is in your account.</p>}
      <Modal open={proof} onClose={() => setProof(false)} title="Proof of payment" wide>
        <p className="mb-3 text-sm text-ink-3">#{o.id} · {usd(orderTotal(o))} · {paymentTitle(o.payment)}</p>
        {o.slipUrl && (
          <a href={o.slipUrl} target="_blank" rel="noreferrer" title="Open full size">
            <img src={o.slipUrl} alt="Proof of payment uploaded by the buyer" className="mx-auto max-h-[60vh] rounded-xl border border-line object-contain" />
          </a>
        )}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          {o.paymentRef && (<><dt className="text-ink-3">Reference</dt><dd>{o.paymentRef}</dd></>)}
          {o.payerName && (<><dt className="text-ink-3">Paid by</dt><dd>{o.payerName}</dd></>)}
        </dl>
      </Modal>
    </div>
  );
}

/** Ordered → paid → voucher sent → picked up. */
export function Timeline({ order: o, shop }: { order: OrderDoc; shop?: ShopDoc }) {
  const done = o.status === "collected";
  const steps = [
    { title: "Ordered", sub: `${usd(orderTotal(o))} · ${relativeDay(o.createdAt)}`, ok: true },
    { title: paymentStatusText[paymentStatusOf(o)], sub: paymentTitle(o.payment), ok: paymentStatusOf(o) === "confirmed" },
    { title: "Voucher sent", sub: o.recipient?.name ?? "", ok: true },
    { title: "Picked up", sub: done && o.collectedAt ? `${relativeDay(o.collectedAt)}${shop?.standNo ? ` at ${shop.standNo}` : ""}` : `Waiting at ${pickupPlace(o, shop).name}`, ok: done },
  ];
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${s.ok ? "bg-mint-600 text-white" : "border-2 border-line bg-white text-ink-3"}`}>
              {s.ok ? <Icon name="check" className="size-3.5" strokeWidth={2.6} draw /> : i + 1}
            </span>
            {i < steps.length - 1 && <span className={`w-0.5 flex-1 ${s.ok ? "bg-mint-600/50" : "bg-line"}`} />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-semibold">{s.title}</p>
            <p className="text-xs text-ink-3">{s.sub}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Shown on merchant pages until the account has a shop. */
export function NoShop({ what }: { what: string }) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name="store" className="size-8" strokeWidth={1.6} loop /></div>
      <h1 className="mt-4 text-xl font-bold">Set up your first shop</h1>
      <p className="mt-1 text-sm text-ink-3">Add your shop to {what}. Buyers abroad order from it and their family collects with a QR voucher.</p>
      <Link href="/merchant/shop/new" className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm shadow-brand/20 hover:bg-brand-600">Set up shop</Link>
    </Card>
  );
}
