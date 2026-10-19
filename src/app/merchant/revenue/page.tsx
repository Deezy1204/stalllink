"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { Button, Card, PageHeader, Spinner, useToast } from "@/components/ui";
import { dayMonthYear, monthKey, monthLabel } from "@/lib/catalog";
import { download, earningsCsv, earningsPdf } from "@/lib/reports";
import { orderTotal, paymentTitle, statusLabel, usd, type OrderDoc } from "@/lib/types";

interface Month {
  key: string;
  orders: OrderDoc[];
  total: number;
  collected: number;
  awaiting: number;
  items: number;
}

function summarise(key: string, orders: OrderDoc[]): Month {
  const sum = (l: OrderDoc[]) => l.reduce((s, o) => s + orderTotal(o), 0);
  return {
    key,
    orders,
    total: sum(orders),
    collected: sum(orders.filter((o) => o.status === "collected")),
    awaiting: sum(orders.filter((o) => o.status === "readyForPickup")),
    items: orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0),
  };
}

/** What the active shop sold through StallLink, month by month. Buyers pay the shop directly, so this is a sales record, not a balance. */
export default function RevenuePage() {
  const { shop, shopOrders, loaded } = useMerchant();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="start selling and see your monthly revenue" />;

  const sales = shopOrders.filter((o) => o.status !== "cancelled");
  const groups = new Map<string, OrderDoc[]>([[monthKey(Date.now()), []]]);
  for (const o of sales) groups.set(monthKey(o.createdAt), [...(groups.get(monthKey(o.createdAt)) ?? []), o]);
  const months = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, l]) => summarise(k, l));
  const current = months[0];
  const previous = months.find((m) => m.key !== current.key && m.key < current.key);
  const change = previous && previous.total > 0 ? (current.total - previous.total) / previous.total : null;

  const now = new Date();
  const chart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = monthKey(d.getTime());
    return summarise(key, groups.get(key) ?? []);
  });
  const peak = Math.max(1, ...chart.map((m) => m.total));

  async function exportMonth(m: Month, kind: "pdf" | "csv") {
    if (!m.orders.length) return toast(`No orders in ${monthLabel(m.key)} yet.`, "error");
    setBusy(`${m.key}-${kind}`);
    try {
      const blob = kind === "pdf" ? await earningsPdf(`${shop!.name} - ${monthLabel(m.key)}`, m.orders) : earningsCsv(m.orders);
      download(blob, `StallLink-${m.key}.${kind}`);
      toast("Report saved.");
    } catch (e) {
      toast(`Could not make the report: ${(e as Error).message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Revenue" subtitle={shop.name} />
      <Card className="bg-ink p-5 text-white">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-bold">{monthLabel(current.key)}</p>
          {change != null && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${change >= 0 ? "bg-mint-100 text-mint-800" : "bg-red-100 text-red-800"}`}>
              {change >= 0 ? "▲" : "▼"} {Math.round(Math.abs(change) * 100)}% vs last month
            </span>
          )}
        </div>
        <p className="mt-4 text-xs text-white/60">Sold this month</p>
        <p className="text-4xl font-extrabold">{usd(current.total)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[["Orders", String(current.orders.length)], ["Collected", usd(current.collected)], ["Awaiting pickup", usd(current.awaiting)]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/10 p-3">
              <p className="truncate text-xs text-white/70">{l}</p>
              <p className="truncate font-bold">{v}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="group mt-4 p-5">
        <h2 className="mb-4 flex items-center gap-2 font-bold"><Icon name="chart" className="size-5 text-brand" play /> Last 6 months</h2>
        <div className="flex h-44 items-end gap-3">
          {chart.map((m, i) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-semibold text-ink-3">{m.total ? `$${Math.round(m.total)}` : ""}</span>
              <div className={`w-full rounded-lg transition-all duration-700 ${i === 5 ? "bg-brand" : "bg-brand/25"}`} style={{ height: `${Math.max(4, (m.total / peak) * 120)}px` }} title={`${m.orders.length} orders`} />
              <span className={`text-xs font-semibold ${i === 5 ? "text-brand" : "text-ink-3"}`}>{monthLabel(m.key, "short")}</span>
            </div>
          ))}
        </div>
      </Card>

      <h2 className="mb-3 mt-6 font-bold">Monthly records</h2>
      <div className="space-y-3">
        {months.map((m) => (
          <Card key={m.key} className="overflow-hidden">
            <button onClick={() => setOpen(open === m.key ? null : m.key)} className="group flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface" aria-expanded={open === m.key}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="calendar" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{monthLabel(m.key)}</span>
                <span className="block text-sm text-ink-3">{m.orders.length} order{m.orders.length === 1 ? "" : "s"} · {m.items} items</span>
              </span>
              <span className="font-bold text-brand">{usd(m.total)}</span>
              <span className={`text-ink-3 transition ${open === m.key ? "rotate-180" : ""}`}>⌄</span>
            </button>
            {open === m.key && (
              <div className="animate-fade-in border-t border-line">
                {m.orders.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-ink-3">No orders this month yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {m.orders.map((o) => (
                      <li key={o.id}>
                        <Link href={`/merchant/orders/${o.id}`} className="group flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-surface">
                          <span className={o.status === "collected" ? "text-mint-600" : "text-amber-600"}>
                            <Icon name={o.status === "collected" ? "checkCircle" : "hourglass"} className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">#{o.id} · {o.recipient?.name}</span>
                            <span className="block truncate text-xs text-ink-3">{dayMonthYear(o.createdAt)} · {statusLabel[o.status]} · {paymentTitle(o.payment)}</span>
                          </span>
                          <span className="font-semibold">{usd(orderTotal(o))}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
                  <span className="mr-auto text-sm text-ink-3">Download this month</span>
                  <Button variant="secondary" loading={busy === `${m.key}-pdf`} onClick={() => exportMonth(m, "pdf")}>PDF report</Button>
                  <Button variant="secondary" loading={busy === `${m.key}-csv`} onClick={() => exportMonth(m, "csv")}>CSV spreadsheet</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      <p className="group mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3"><Icon name="cash" className="size-4" /> Buyers pay your shop directly. StallLink does not hold your money.</p>
    </div>
  );
}
