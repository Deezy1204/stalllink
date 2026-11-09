"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { Badge, Card, Empty, PageHeader, SearchInput, Spinner, Switch, Tabs, useToast } from "@/components/ui";
import { fromPrice, productCategoryLabel, productPhotos, variationLabel } from "@/lib/catalog";
import { applyDiscount } from "@/lib/money";
import { patchProduct } from "@/lib/merchant";
import { usd, type Product, isActive } from "@/lib/types";

/** The active shop's inventory: search, filter, adjust stock and hide/show products. */
export default function ProductsPage() {
  const { shop, loaded } = useMerchant();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const all = useMemo(() => shop?.products ?? [], [shop]);
  const categories = [...new Set(all.map((p) => p.category ?? "grains"))];
  const list = all.filter((p) => (category === "all" || (p.category ?? "grains") === category) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())));

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="list products" />;

  const change = (p: Product, patch: (p: Product) => Partial<Product>, fail: string) =>
    patchProduct(shop.id, p.id, patch).catch((e: Error) => toast(`${fail}: ${e.message}`, "error"));

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${shop.name} · ${list.length} of ${all.length} shown`}
        actions={
          <Link href="/merchant/products/new" className="group inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm shadow-brand/20 hover:bg-brand-600">
            <Icon name="plus" className="size-4" strokeWidth={2.2} /> Add product
          </Link>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <SearchInput placeholder="Search your products…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tabs value={category} onChange={setCategory} options={[{ value: "all", label: "All", count: all.length }, ...categories.map((c) => ({ value: c, label: productCategoryLabel(c) }))]} />
      </div>

      {list.length === 0 ? (
        <Empty
          title={all.length ? "No matches" : "No products yet"}
          message={all.length ? "Try a different search or shelf." : "List your first item for buyers. Add each size you sell with its own price."}
          action={!all.length && <Link href="/merchant/products/new" className="font-semibold text-brand hover:underline">+ Add product</Link>}
        />
      ) : (
        <div className="stagger grid gap-3 md:grid-cols-2">
          {list.map((p, i) => {
            const photo = productPhotos(p)[0];
            const sizes = p.variations ?? [];
            const low = p.stock <= 5;
            const available = p.available !== false;
            return (
              <Card key={p.id} index={Math.min(i, 12)} className={`p-4 ${available ? "" : "opacity-75"}`}>
                <div className="flex gap-3">
                  <Link href={`/merchant/products/${p.id}`} className="group relative shrink-0">
                    {photo?.startsWith("http") ? (
                      <img src={photo} alt="" className="size-20 rounded-xl object-cover" />
                    ) : (
                      <div className="flex size-20 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="cart" className="size-8" strokeWidth={1.6} /></div>
                    )}
                    {(low || p.tag) && <span className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${low ? "bg-red-600 text-white" : "bg-brand text-white"}`}>{low ? "Low stock" : p.tag}</span>}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <Link href={`/merchant/products/${p.id}`} className="min-w-0 flex-1 truncate font-bold hover:text-brand">{p.name}</Link>
                      <Link href={`/merchant/products/${p.id}`} className="text-sm font-semibold text-brand hover:underline">Edit</Link>
                    </div>
                    {p.subtitle && <p className="truncate text-sm text-ink-3">{p.subtitle}</p>}
                    {sizes.length > 0 && <p className="truncate text-xs text-ink-2">{sizes.map(variationLabel).join(" · ")}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`text-lg font-extrabold ${isActive(p.discount) ? "text-red-700" : "text-brand"}`}>{sizes.length > 1 ? "From " : ""}{usd(isActive(p.discount) ? applyDiscount(fromPrice(p), p.discount!) : fromPrice(p))}</span>
                      {isActive(p.discount) && <><s className="text-sm text-ink-3">{usd(fromPrice(p))}</s> <span className="rounded-md bg-red-700 px-1.5 text-xs font-bold text-white">-{p.discount!.percent}%</span></>}
                      {sizes.length > 1 && <Badge>{sizes.length} sizes</Badge>}
                      {sizes.some((v) => v.bulk?.length) && <Badge tone="brand">Bulk</Badge>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
                  <span className="text-sm font-semibold">Stock</span>
                  <div className="flex items-center rounded-xl border border-line">
                    <button className="size-8 rounded-l-xl text-lg hover:bg-surface-2 disabled:opacity-40" disabled={p.stock <= 0} onClick={() => change(p, (x) => ({ stock: Math.max(0, x.stock - 1) }), "Could not change the stock")} aria-label={`One less ${p.name}`}>−</button>
                    <span className="w-10 text-center text-sm font-bold">{p.stock}</span>
                    <button className="size-8 rounded-r-xl text-lg hover:bg-surface-2" onClick={() => change(p, (x) => ({ stock: Math.min(9999, x.stock + 1) }), "Could not change the stock")} aria-label={`One more ${p.name}`}>+</button>
                  </div>
                  <div className="ml-auto">
                    <Switch
                      checked={available}
                      onChange={(v) => change(p, () => ({ available: v }), "Could not update the product")}
                      label={<span className={available ? "text-mint-800" : "text-ink-3"}>{available ? "Available" : "Hidden"}</span>}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
