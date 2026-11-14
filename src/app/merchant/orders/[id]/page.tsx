"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { PhotoViewer } from "@/components/merchant/Photos";
import { PaymentCard, Timeline } from "@/components/merchant/OrderBits";
import { Button, Card, Empty, Spinner, useToast } from "@/components/ui";
import { dayMonthYear, digitsOnly, pickupPlace, relativeDay, timeOfDay } from "@/lib/catalog";
import { download, receiptPdf } from "@/lib/reports";
import { orderShare, orderTotal, paymentTitle, statusLabel, usd, viaLocalink } from "@/lib/types";

/** One order as the shop sees it (the app's order tracking screen in Merchant mode). */
export default function MerchantOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { orders, shops, loaded, shop: active, selectShop } = useMerchant();
  const toast = useToast();
  const [photo, setPhoto] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  const o = orders.find((x) => x.id === id);
  if (!o) return <Empty title="Order not found" message="It may belong to a shop you no longer own." action={<Link href="/merchant/orders" className="font-semibold text-brand hover:underline">Back to orders</Link>} />;

  const shop = shops.find((s) => s.id === o.stallId);
  const shopName = shop?.name ?? "your shop";
  const done = o.status === "collected";
  const place = pickupPlace(o, shop);
  const phone = digitsOnly(o.recipient?.phone ?? "");

  async function receipt(share: boolean) {
    setBusy(true);
    try {
      const blob = await receiptPdf(o!, shop);
      const name = `Localink-receipt-${o!.id}.pdf`;
      const file = new File([blob], name, { type: "application/pdf" });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Localink order #${o!.id}`, text: `Localink order #${o!.id} · ${usd(orderTotal(o!))} · ${shopName}` });
      } else {
        download(blob, name);
        toast("Receipt saved.");
      }
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") toast(`Could not make the receipt: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/merchant/orders" className="text-sm font-semibold text-brand hover:underline">‹ Orders</Link>
      {shop && active && shop.id !== active.id && (
        <p className="mt-3 rounded-xl bg-surface-2 px-4 py-2.5 text-sm">
          This order is for <b>{shop.name}</b>.{" "}
          <button onClick={() => selectShop(shop.id)} className="font-semibold text-brand hover:underline">Switch to that shop</button>
        </p>
      )}

      <Card className={`mt-3 flex items-center gap-4 p-5 ${done ? "bg-mint-100" : "bg-brand-50/60"}`}>
        <span className={`flex size-12 items-center justify-center rounded-2xl bg-white ${done ? "text-mint-800" : "text-brand"}`}>
          {done ? <Icon name="checkCircle" className="size-7" draw /> : <Icon name="hourglass" className="size-7" loop={o.status === "readyForPickup"} />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className={`text-xl font-extrabold ${done ? "text-mint-800" : "text-brand"}`}>{done ? "Collected" : o.status === "readyForPickup" ? "Awaiting pickup" : statusLabel[o.status]}</h1>
          <p className="text-sm text-ink-2">Order #{o.id} · {relativeDay(o.createdAt)}</p>
        </div>
        <p className="text-2xl font-extrabold text-brand">{usd(orderTotal(o))}</p>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <PaymentCard order={o} shopName={shopName} />

          {o.status === "readyForPickup" && (
            <Link href={`/merchant/collect?code=${encodeURIComponent(o.voucherCode)}`} className="group flex items-center gap-4 rounded-2xl bg-ink px-5 py-4 text-white transition hover:bg-ink-2">
              <Icon name="scan" className="size-8" strokeWidth={1.6} />
              <span className="flex-1">
                <span className="block font-bold">Hand over this order</span>
                <span className="block text-sm text-white/70">When the recipient is at the counter: check the items and release it.</span>
              </span>
              <span className="text-xl">›</span>
            </Link>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-bold">Items ({o.items.length})</h2>
            <ul className="divide-y divide-line text-sm">
              {o.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{it.qty} × {it.name}</span>
                    {it.unit && <span className="block text-xs text-ink-3">{it.unit[0].toUpperCase() + it.unit.slice(1)} × {it.qty}</span>}
                  </span>
                  <span className="font-semibold">{usd(it.qty * it.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 border-t border-line pt-3 text-sm">
              <dt className="text-ink-3">Voucher</dt><dd className="font-mono">{o.voucherCode}</dd>
              <dt className="text-ink-3">Subtotal</dt><dd>{usd(o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0))}</dd>
              {!!o.discount && (<><dt className="text-ink-3">{o.promoLabel || "Shop offer"}</dt><dd>−{usd(o.discount)}</dd></>)}
              {!!o.runnerFee && (<><dt className="text-ink-3">Delivery</dt><dd>{usd(o.runnerFee)}</dd></>)}
              {!!o.serviceFee && (<><dt className="text-ink-3">Localink service fee (paid by the buyer)</dt><dd>{usd(o.serviceFee)}</dd></>)}
              {!!o.localinkDiscount && (<><dt className="text-ink-3">{o.localinkLabel || "Localink discount"} (paid by Localink)</dt><dd className="text-mint-800">−{usd(o.localinkDiscount)}</dd></>)}
              <dt className="text-ink-3">Payment</dt><dd>{paymentTitle(o.payment)}</dd>
              <dt className="font-bold">Buyer pays</dt><dd className="text-lg font-extrabold text-brand">{usd(orderTotal(o))}</dd>
              {(!!o.serviceFee || viaLocalink(o)) && (<><dt className="text-ink-3">Your sale</dt><dd className="font-semibold">{usd(orderShare(o))}</dd></>)}
            </dl>
            {!!o.localinkDiscount && (
              <p className="mt-2 rounded-xl bg-mint-100 px-3 py-2 text-xs text-mint-800">
                Localink gave the buyer {usd(o.localinkDiscount)} off and pays it to you: you get the full {usd(orderShare(o))}.
              </p>
            )}
          </Card>

          {done && o.handoverUrl && (
            <Card className="overflow-hidden">
              <button onClick={() => setPhoto(true)} className="block w-full"><img src={o.handoverUrl} alt="Handover photo" className="h-56 w-full object-cover" /></button>
              <div className="flex items-center justify-between p-4 text-sm">
                <span><b>Proof of handover</b><span className="block text-ink-3">{o.collectedAt ? `${dayMonthYear(o.collectedAt)} · ${timeOfDay(o.collectedAt)}` : ""}</span></span>
                <a href={o.handoverUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">Open ↗</a>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5"><Timeline order={o} shop={shop} /></Card>
          <Card className="space-y-4 p-5 text-sm">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Recipient (collects)</p>
              <p className="mt-1 font-bold">{o.recipient?.name}</p>
              <p className="text-ink-2">{o.recipient?.phone}{o.recipient?.city ? ` · ${o.recipient.city}` : ""}</p>
              {phone && (
                <div className="mt-2 flex gap-3">
                  <a href={`tel:${phone}`} className="font-semibold text-brand hover:underline">Call</a>
                  <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">WhatsApp</a>
                </div>
              )}
            </section>
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Paid by</p>
              <p className="mt-1 font-bold">{o.senderName}</p>
              {o.senderCity && <p className="text-ink-2">{o.senderCity}</p>}
              {o.senderMessage && <p className="mt-1 rounded-xl bg-surface px-3 py-2 italic text-ink-2">“{o.senderMessage}”</p>}
            </section>
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{o.delivery ? "Delivery" : "Collection point"}</p>
              <p className="mt-1 font-bold">{o.delivery ? "Deliver to the recipient" : `${shopName}, ${place.name}`}</p>
              <p className="text-ink-2">{[place.standNo, place.address, place.suburb].filter(Boolean).join(" · ")}</p>
            </section>
            {o.note && (
              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Note from the buyer</p>
                <p className="mt-1 text-ink-2">{o.note}</p>
              </section>
            )}
          </Card>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" loading={busy} onClick={() => receipt(false)}>Download receipt</Button>
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => receipt(true)}>Share</Button>
          </div>
        </div>
      </div>
      {photo && o.handoverUrl && <PhotoViewer photos={[o.handoverUrl]} onClose={() => setPhoto(false)} />}
    </div>
  );
}
