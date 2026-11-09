"use client";

import { useEffect, useMemo, useState } from "react";

import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop, OrderCard } from "@/components/merchant/OrderBits";
import { Empty, PageHeader, SearchInput, Spinner, Tabs } from "@/components/ui";
import type { OrderDoc } from "@/lib/types";

type Tab = "open" | "proof" | "done" | "all";

/** Where an order is collected: "main", a branch id, or "delivery". */
const placeOf = (o: OrderDoc) => (o.delivery ? "delivery" : (o.branch?.id ?? "main"));

/** Vouchers issued at the active shop: waiting for pickup, payments to check, completed. */
export default function MerchantOrders() {
  const { shop, shopOrders, loaded } = useMerchant();
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState("");
  /** "all", "main", a branch id, or "delivery". */
  const [place, setPlace] = useState("all");

  // Links from the overview open a tab directly (?tab=proof).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "proof" || t === "done" || t === "all") setTab(t);
  }, []);

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return shopOrders.filter((o) => {
      if (tab === "open" && o.status !== "readyForPickup") return false;
      if (tab === "proof" && (o.paymentStatus !== "proofSent" || o.payTo === "localink")) return false;
      if (tab === "done" && o.status === "readyForPickup") return false;
      if (place !== "all" && placeOf(o) !== place) return false;
      return !text || `${o.id} ${o.voucherCode} ${o.senderName} ${o.recipient?.name} ${o.recipient?.phone} ${o.items.map((i) => i.name).join(" ")}`.toLowerCase().includes(text);
    });
  }, [shopOrders, tab, q, place]);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="receive orders" />;

  return (
    <>
      <PageHeader title="Orders & vouchers" subtitle={`${shop.name} · tap an order to confirm its payment or see the details`} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <SearchInput placeholder="Search order, voucher, sender, recipient, item…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {/* Shops with branches (or delivery) can see one collection point at a time. */}
          {(shop.branches?.length || shop.offersDelivery) && (
            <select
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              aria-label="Collection point"
              className="h-11 max-w-[45%] rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            >
              <option value="all">All locations</option>
              <option value="main">Main shop ({shopOrders.filter((o) => placeOf(o) === "main").length})</option>
              {(shop.branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({shopOrders.filter((o) => placeOf(o) === b.id).length})</option>
              ))}
              {shop.offersDelivery && <option value="delivery">Delivery ({shopOrders.filter((o) => placeOf(o) === "delivery").length})</option>}
            </select>
          )}
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "open", label: "Awaiting pickup", count: shopOrders.filter((o) => o.status === "readyForPickup").length },
            { value: "proof", label: "Payments to check", count: shopOrders.filter((o) => o.payTo !== "localink" && o.paymentStatus === "proofSent").length },
            { value: "done", label: "Completed", count: shopOrders.filter((o) => o.status !== "readyForPickup").length },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <Empty
          title={q ? "No orders match" : tab === "open" ? "No vouchers waiting" : tab === "proof" ? "No payments to check" : "Nothing here yet"}
          message={tab === "open" ? "When a buyer abroad orders from your shop, the voucher shows up here." : undefined}
        />
      ) : (
        <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o, i) => <OrderCard key={o.id} order={o} shop={shop} index={i} />)}
        </div>
      )}
    </>
  );
}
