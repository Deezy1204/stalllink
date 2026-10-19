"use client";

import { useMemo, useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { Badge, Card, Empty, Modal, PageHeader, SearchInput, Tabs } from "@/components/ui";
import { pickupPlace } from "@/lib/catalog";
import { orderTotal, paymentLabel, paymentTitle, shortDate, statusLabel, usd, type OrderDoc } from "@/lib/types";

type Filter = "all" | "open" | "collected" | "proof" | "unpaid";

export default function OrdersPage() {
  const { orders, shops } = useAdminData();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<OrderDoc | null>(null);

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? "Deleted shop";
  /** "Main shop", a branch's name, or delivery. */
  const collectAt = (o: OrderDoc) => (o.delivery ? "Delivery to the recipient" : (o.branch?.name ?? "Main shop"));

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "open" && o.status !== "readyForPickup") return false;
      if (filter === "collected" && o.status !== "collected") return false;
      if (filter === "proof" && o.paymentStatus !== "proofSent") return false;
      if (filter === "unpaid" && o.paymentStatus !== "awaitingProof") return false;
      return !text || `${o.id} ${o.voucherCode} ${o.senderName} ${o.recipient?.name} ${o.recipient?.phone} ${shopName(o.stallId)}`.toLowerCase().includes(text);
    });
  }, [orders, shops, q, filter]);

  const total = list.filter((o) => o.status !== "cancelled").reduce((s, o) => s + orderTotal(o), 0);

  return (
    <>
      <PageHeader title="Orders" subtitle={`${list.length} orders · ${usd(total)} in groceries`} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <SearchInput placeholder="Search order, voucher, sender, recipient, shop…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: orders.length },
            { value: "open", label: "Awaiting pickup" },
            { value: "collected", label: "Collected" },
            { value: "proof", label: "Proof to check", count: orders.filter((o) => o.paymentStatus === "proofSent").length },
            { value: "unpaid", label: "No proof yet" },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Empty title="No orders match" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Shop</th>
                  <th className="px-5 py-3">From → To</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="stagger divide-y divide-line">
                {list.slice(0, 300).map((o, i) => (
                  <tr key={o.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties} onClick={() => setOpen(o)} className="cursor-pointer hover:bg-surface">
                    <td className="px-5 py-3">
                      <p className="font-semibold">#{o.id}</p>
                      <p className="text-xs text-ink-3">{shortDate(o.createdAt)}</p>
                    </td>
                    <td className="px-5 py-3">
                      {shopName(o.stallId)}
                      <p className="text-xs text-ink-3">{collectAt(o)}</p>
                    </td>
                    <td className="px-5 py-3 text-ink-2">{o.senderName} → {o.recipient?.name}</td>
                    <td className="px-5 py-3">
                      <p className="text-ink-2">{paymentTitle(o.payment)}</p>
                      <Badge tone={o.paymentStatus === "confirmed" ? "success" : o.paymentStatus === "proofSent" ? "warning" : "danger"}>{paymentLabel[o.paymentStatus ?? "confirmed"]}</Badge>
                    </td>
                    <td className="px-5 py-3"><Badge tone={o.status === "collected" ? "success" : o.status === "cancelled" ? "danger" : "neutral"}>{statusLabel[o.status] ?? o.status}</Badge></td>
                    <td className="px-5 py-3 text-right font-semibold">{usd(orderTotal(o))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open != null} onClose={() => setOpen(null)} title={open ? `Order #${open.id}` : ""}>
        {open && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-ink-3">Shop</dt><dd className="font-semibold">{shopName(open.stallId)}</dd>
            <dt className="text-ink-3">{open.delivery ? "Delivery" : "Collect at"}</dt>
            <dd>
              {collectAt(open)}
              {(() => {
                const p = pickupPlace(open, shops.find((s) => s.id === open.stallId));
                const where = [p.standNo, p.address, p.suburb, p.city].filter(Boolean).join(", ");
                return !open.delivery && where && <span className="block text-xs text-ink-3">{where}</span>;
              })()}
            </dd>
            <dt className="text-ink-3">Placed</dt><dd>{new Date(open.createdAt).toLocaleString("en-GB")}</dd>
            <dt className="text-ink-3">Status</dt><dd>{statusLabel[open.status]}{open.collectedAt ? ` · ${new Date(open.collectedAt).toLocaleString("en-GB")}` : ""}</dd>
            <dt className="text-ink-3">Voucher</dt><dd className="font-mono">{open.voucherCode}</dd>
            <dt className="text-ink-3">Sender</dt><dd>{open.senderName} {open.senderCity && `(${open.senderCity})`}</dd>
            <dt className="text-ink-3">Recipient</dt><dd>{open.recipient?.name} · {open.recipient?.phone}</dd>
            <dt className="text-ink-3">Payment</dt>
            <dd>
              {paymentTitle(open.payment)} {open.payment?.accountNumber && `· ${open.payment.accountNumber}`}
              <br />
              <Badge tone={open.paymentStatus === "confirmed" ? "success" : "warning"}>{paymentLabel[open.paymentStatus ?? "confirmed"]}</Badge>
              {open.paymentRef && <span className="ml-2 text-ink-3">Ref {open.paymentRef}</span>}
              {open.slipUrl && (
                <a href={open.slipUrl} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-brand hover:underline">View proof ↗</a>
              )}
            </dd>
            <dt className="col-span-2 mt-3 font-semibold">Items</dt>
            {open.items.map((it, i) => (
              <div key={i} className="col-span-2 flex justify-between border-b border-line py-1.5 last:border-0">
                <span>{it.qty} × {it.name}</span>
                <span>{usd(it.qty * it.unitPrice)}</span>
              </div>
            ))}
            {!!open.runnerFee && (<><dt className="text-ink-3">Delivery</dt><dd className="text-right">{usd(open.runnerFee)}</dd></>)}
            <dt className="font-bold">Total</dt><dd className="text-right font-bold text-brand">{usd(orderTotal(open))}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}
