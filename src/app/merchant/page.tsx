"use client";

import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";
import { LocationList, LocationsMap, shopPlaces } from "@/components/Locations";
import { useMerchant } from "@/components/merchant/MerchantData";
import { ShopThumb } from "@/components/merchant/MerchantShell";
import { NoShop, OrderCard } from "@/components/merchant/OrderBits";
import { Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { monthKey } from "@/lib/catalog";
import { orderTotal, usd } from "@/lib/types";

/** Merchant dashboard for the active shop (the app's Overview tab). */
export default function MerchantOverview() {
  const { shop, shopOrders, loaded, error, shops } = useMerchant();

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="list products and receive orders" />;

  const pending = shopOrders.filter((o) => o.status === "readyForPickup");
  const recent = shopOrders.filter((o) => o.status !== "readyForPickup").slice(0, 4);
  const thisMonth = shopOrders.filter((o) => o.status !== "cancelled" && monthKey(o.createdAt) === monthKey(Date.now()));
  const sold = thisMonth.reduce((s, o) => s + orderTotal(o), 0);
  const items = thisMonth.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const toCheck = shopOrders.filter((o) => o.paymentStatus === "proofSent").length;
  const places = shopPlaces(shop);
  const products = shop.products ?? [];
  const low = products.filter((p) => p.stock <= 5).length;
  const stats: { label: string; value: number; href: string; icon: IconName; alert?: boolean; busy?: boolean; note?: string }[] = [
    { label: "Awaiting pickup", value: pending.length, href: "/merchant/orders", icon: "hourglass", busy: pending.length > 0 },
    { label: "Payments to check", value: toCheck, href: "/merchant/orders?tab=proof", icon: "receipt", alert: toCheck > 0, busy: toCheck > 0 },
    { label: "Products", value: products.length, href: "/merchant/products", icon: "box", note: low ? `${low} low on stock` : undefined },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/merchant/products/new" className="group inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm shadow-brand/20 hover:bg-brand-600">
              <Icon name="plus" className="size-4" strokeWidth={2.2} /> Add product
            </Link>
            <Link href="/merchant/collect" className="group inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-surface-2">
              <Icon name="scan" className="size-4" strokeWidth={2} /> Scan voucher
            </Link>
          </div>
        }
      />
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {shop.bannerAsset?.startsWith("http") && <img src={shop.bannerAsset} alt="" className="h-36 w-full object-cover sm:h-auto sm:w-56" />}
          <div className="flex flex-1 items-start gap-3 p-5">
            {!shop.bannerAsset?.startsWith("http") && <ShopThumb name={shop.name} className="size-14" />}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xl font-extrabold">
                {shop.name}
                {shop.verified && <span className="text-mint-600"><Icon name="verified" className="size-5" title="Verified by StallLink" play /></span>}
              </p>
              <p className="text-sm text-ink-3">{[shop.standNo, shop.suburb, shop.city].filter(Boolean).join(" · ")}</p>
              {shops.length > 1 && <p className="mt-1 text-xs font-semibold text-brand">{shops.length} shops · switch in the sidebar</p>}
            </div>
            <Link href="/merchant/shop" className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">Edit shop</Link>
          </div>
        </div>
      </Card>

      {(shop.suspended || !shop.verified) && (
        <p className={`mt-3 rounded-2xl px-4 py-3 text-sm ${shop.suspended ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
          {shop.suspended
            ? "StallLink has paused this shop, so buyers cannot see it. Contact support."
            : "StallLink is checking this shop. Buyers can already order; the verified badge appears once it is approved."}
        </p>
      )}

      <div className="stagger mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/merchant/revenue" style={{ "--i": 0 } as React.CSSProperties} className="group col-span-2 lg:col-span-1">
          <Card className="relative h-full bg-ink p-4 text-white">
            <Icon name="chart" className="absolute right-4 top-4 size-6 text-brand-50/80" play />
            <p className="text-xs font-semibold text-white/70">Sold this month</p>
            <p className="mt-1 text-2xl font-extrabold">{usd(sold)}</p>
            <p className="text-xs text-white/60">{thisMonth.length} orders · {items} items</p>
          </Card>
        </Link>
        {stats.map((m, i) => (
          <Link key={m.label} href={m.href} style={{ "--i": i + 1 } as React.CSSProperties} className="group">
            <Card className={`relative h-full p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-md ${m.alert ? "border-brand/30 bg-brand-50/40" : ""}`}>
              {/* Keeps moving while something is waiting. */}
              <Icon name={m.icon} className={`absolute right-4 top-4 size-5 ${m.busy ? "text-brand" : "text-ink-3"}`} loop={m.busy} />
              <p className="text-xs font-semibold text-ink-3">{m.label}</p>
              <p className={`mt-1 text-2xl font-extrabold ${m.alert ? "text-brand" : ""}`}>{m.value}</p>
              {m.note && <p className="text-xs font-semibold text-amber-800">{m.note}</p>}
            </Card>
          </Link>
        ))}
      </div>

      {toCheck > 0 && (
        <Link href="/merchant/orders?tab=proof" className="mt-3 block rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">
          {toCheck} payment{toCheck === 1 ? "" : "s"} to check. Open the order and confirm once the money is in. ›
        </Link>
      )}

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="font-bold">Awaiting pickup</h2>
        {pending.length > 0 && <Link href="/merchant/orders" className="text-sm font-semibold text-brand hover:underline">See all</Link>}
      </div>
      {pending.length === 0 ? (
        <Empty title="No vouchers waiting" message="New orders appear here the moment a buyer places them." />
      ) : (
        <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pending.slice(0, 6).map((o, i) => <OrderCard key={o.id} order={o} shop={shop} index={i} />)}
        </div>
      )}

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="font-bold">{places.length === 1 ? "Your location" : `Your locations (${places.length})`}</h2>
        <Link href="/merchant/shop" className="group inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          <Icon name="store" className="size-4" strokeWidth={2} /> {places.length === 1 ? "Add a branch" : "Edit branches"}
        </Link>
      </div>
      <Card className="p-4">
        <LocationsMap places={places} className="mb-3 h-60" />
        <LocationList
          places={places}
          shopName={shop.name}
          note={(p) => {
            const waiting = pending.filter((o) => !o.delivery && (o.branch?.id ?? "main") === p.id).length;
            return waiting > 0 && <p className="mt-1 text-xs font-bold text-brand">{waiting} order{waiting === 1 ? "" : "s"} waiting here</p>;
          }}
        />
        {places.length === 1 && <p className="mt-3 text-xs text-ink-3">Have another stand or shop where customers can collect? Add it as a branch in Shop settings.</p>}
      </Card>

      {recent.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex items-center justify-between">
            <h2 className="font-bold">Recent</h2>
            <Link href="/merchant/revenue" className="text-sm font-semibold text-brand hover:underline">Revenue</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((o) => <OrderCard key={o.id} order={o} shop={shop} />)}
          </div>
        </>
      )}
    </>
  );
}
