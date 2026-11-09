"use client";

import Link from "next/link";
import { useState } from "react";

import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { Badge, Button, Card, Input, Modal, PageHeader, Pill, Spinner, useToast } from "@/components/ui";
import { fromPrice } from "@/lib/catalog";
import { savePromo, setDiscount } from "@/lib/merchant";
import { applyDiscount, promoHeadline } from "@/lib/money";
import { isActive, shortDate, usd, type Discount, type Product, type ShopPromo } from "@/lib/types";

const QUICK = [5, 10, 15, 20, 25, 30, 50];

/** The active shop's offers: one on the whole basket, and discounts on any of its products. */
export default function PromotionsPage() {
  const { shop, loaded } = useMerchant();
  const toast = useToast();
  const [editing, setEditing] = useState<{ kind: "promo" } | { kind: "product"; product: Product } | { kind: "pick" } | null>(null);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="run discounts and offers" />;

  const products = shop.products ?? [];
  const discounted = products.filter((p) => p.discount).sort((a, b) => Number(isActive(b.discount)) - Number(isActive(a.discount)));
  const promo = shop.promo ?? null;
  const live = isActive(promo);

  async function saveOffer(d: Discount & { minSpend?: number }, remove: boolean) {
    const target = editing;
    setEditing(null);
    try {
      if (target?.kind === "promo") {
        await savePromo(shop!.id, remove ? null : (d as ShopPromo));
        toast(remove ? "Offer ended." : `Offer live: ${promoHeadline(d as ShopPromo)}.`);
      } else if (target?.kind === "product") {
        const { minSpend: _m, ...discount } = d;
        await setDiscount(shop!.id, target.product.id, remove ? null : discount);
        toast(remove ? `Discount on ${target.product.name} ended.` : `${target.product.name} is now ${d.percent}% off.`);
      }
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Discounts & offers" subtitle={shop.name} />

      <h2 className="font-bold">Shop offer</h2>
      <p className="mb-3 text-sm text-ink-3">One offer on the whole basket, e.g. &quot;10% off orders over $30&quot;. Buyers see it on your shop and get it at checkout.</p>
      <Card className={`flex flex-wrap items-center gap-4 p-4 ${live ? "border-accent/50 bg-accent-50" : ""}`}>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{promo ? `${promo.label ? `${promo.label} · ` : ""}${promoHeadline(promo)}` : "No shop offer"}</p>
          <p className="text-sm text-ink-3">
            {!promo ? "Create one to bring buyers back." : !live ? `Ended ${shortDate(promo.endsAt)}` : promo.endsAt ? `Live until ${shortDate(promo.endsAt)}` : "Live until you end it"}
          </p>
        </div>
        <Button variant={promo ? "secondary" : "primary"} onClick={() => setEditing({ kind: "promo" })}>{promo ? "Edit offer" : "Create offer"}</Button>
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-bold">Product discounts</h2>
          <p className="text-sm text-ink-3">A percentage off every size of a product, shown with the old price crossed out.</p>
        </div>
        <Button onClick={() => setEditing({ kind: "pick" })}>+ Discount a product</Button>
      </div>
      {discounted.length === 0 ? (
        <Card className="p-4 text-sm text-ink-3">No products on sale.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {discounted.map((p) => {
            const on = isActive(p.discount);
            const was = fromPrice(p);
            return (
              <button key={p.id} type="button" onClick={() => setEditing({ kind: "product", product: p })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface">
                {p.imageAsset?.startsWith("http") ? <img src={p.imageAsset} alt="" className="size-12 rounded-xl object-cover" /> : <span className="size-12 rounded-xl bg-surface-2" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-sm">
                    <b className={on ? "text-red-700" : ""}>{usd(applyDiscount(was, p.discount!))}</b> <s className="text-ink-3">{usd(was)}</s>
                  </span>
                  <span className="block text-xs text-ink-3">
                    {!on ? `Ended ${shortDate(p.discount!.endsAt)}` : [p.discount!.label, p.discount!.endsAt ? `until ${shortDate(p.discount!.endsAt)}` : "until you end it"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Badge tone={on ? "danger" : "neutral"}>-{p.discount!.percent}%</Badge>
              </button>
            );
          })}
        </Card>
      )}
      <Link href="/merchant/products" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Go to products ›</Link>

      {editing?.kind === "pick" && (
        <Modal open onClose={() => setEditing(null)} title="Which product?">
          <div className="space-y-1">
            {products.filter((p) => !isActive(p.discount)).map((p) => (
              <button key={p.id} type="button" onClick={() => setEditing({ kind: "product", product: p })} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-surface">
                <span className="font-semibold">{p.name}</span>
                <span className="text-ink-3">{(p.variations?.length ?? 0) > 1 ? "From " : ""}{usd(fromPrice(p))}</span>
              </button>
            ))}
            {products.every((p) => isActive(p.discount)) && <p className="text-sm text-ink-3">{products.length ? "Every product is already on sale." : "Add products first."}</p>}
          </div>
        </Modal>
      )}
      {(editing?.kind === "promo" || editing?.kind === "product") && (
        <OfferForm
          title={editing.kind === "promo" ? "Shop offer" : `Discount on ${editing.product.name}`}
          existing={editing.kind === "promo" ? promo : editing.product.discount ?? null}
          promo={editing.kind === "promo"}
          example={editing.kind === "product" ? fromPrice(editing.product) : null}
          onClose={() => setEditing(null)}
          onSave={saveOffer}
        />
      )}
    </div>
  );
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function OfferForm({
  title,
  existing,
  promo,
  example,
  onClose,
  onSave,
}: {
  title: string;
  existing: (Discount & { minSpend?: number }) | null;
  promo: boolean;
  example: number | null;
  onClose: () => void;
  onSave: (d: Discount & { minSpend?: number }, remove: boolean) => void;
}) {
  const [percent, setPercent] = useState(existing ? String(existing.percent) : "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [ends, setEnds] = useState(existing?.endsAt ? day(existing.endsAt) : "");
  const [min, setMin] = useState(existing?.minSpend ? String(existing.minSpend) : "");
  const [tried, setTried] = useState(false);
  const n = Number(percent);
  const percentErr = !Number.isInteger(n) || n < 1 || n > 90 ? "Between 1 and 90%" : null;
  const minErr = min.trim() && !(Number(min) >= 0) ? "Enter an amount" : null;

  function save() {
    setTried(true);
    if (percentErr || minErr) return;
    // The end of the chosen day, Zimbabwe time.
    const endsAt = ends ? Date.parse(`${ends}T23:59:59+02:00`) : null;
    onSave({ percent: n, label: label.trim(), endsAt, ...(promo ? { minSpend: Number(min) || 0 } : {}) }, false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          {existing && <Button variant="danger" onClick={() => onSave(existing, true)}>{promo ? "End this offer" : "End this discount"}</Button>}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{promo ? "Save offer" : "Save discount"}</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-3">{promo ? "Taken off the whole basket at checkout, on top of product discounts." : "Applies to every size and bulk price of this product."}</p>
      <div className="mb-3 flex flex-wrap gap-2">{QUICK.map((q) => <Pill key={q} selected={n === q} onClick={() => setPercent(String(q))}>{q}%</Pill>)}</div>
      <div className="space-y-3">
        <Input label="Percentage off" type="number" min={1} max={90} value={percent} onChange={(e) => setPercent(e.target.value)} error={tried ? percentErr : null}
          hint={example != null && !percentErr ? `Buyers pay ${usd(applyDiscount(example, { percent: n }))} instead of ${usd(example)} for the cheapest size.` : undefined} />
        {promo && <Input label="Minimum basket (optional)" prefix="$" value={min} onChange={(e) => setMin(e.target.value)} placeholder="e.g. 30" hint="Leave empty to take it off every order." error={tried ? minErr : null} />}
        <Input label="Name (optional)" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder={promo ? "e.g. Month-end special" : "e.g. Weekend special"} />
        <Input label="Last day (optional)" type="date" value={ends} min={day(Date.now())} onChange={(e) => setEnds(e.target.value)} hint="Leave empty to run it until you end it." />
      </div>
    </Modal>
  );
}
