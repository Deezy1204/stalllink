"use client";

import Link from "next/link";

import { useAdminData } from "@/components/AdminData";
import { Icon, type IconName } from "@/components/icons";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { orderTotal, paymentLabel, paymentTitle, shortDate, statusLabel, usd } from "@/lib/types";

export default function Dashboard() {
  const { users, shops, orders, nominations, loaded, error } = useAdminData();
  const now = new Date();
  const sales = orders.filter((o) => o.status !== "cancelled");
  const thisMonth = sales.filter((o) => {
    const d = new Date(o.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  // Last 6 months of platform sales.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const list = sales.filter((o) => {
      const c = new Date(o.createdAt);
      return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
    });
    return { label: d.toLocaleString("en-GB", { month: "short" }), total: list.reduce((s, o) => s + orderTotal(o), 0), count: list.length };
  });
  const peak = Math.max(1, ...months.map((m) => m.total));

  const toVerify = shops.filter((s) => !s.verified && !s.suspended);
  // Proofs of transfers to Localink, which Localink confirms (shops confirm their own).
  const proofs = orders.filter((o) => o.payTo === "localink" && o.paymentStatus === "proofSent");
  const newRequests = nominations.filter((n) => n.status === "new").length;
  const stats: { label: string; value: string | number; href: string; icon: IconName; alert?: boolean }[] = [
    { label: "Users", value: users.length, href: "/users", icon: "users" },
    { label: "Merchants", value: new Set(shops.map((s) => s.ownerId)).size, href: "/users", icon: "user" },
    { label: "Shops", value: shops.length, href: "/shops", icon: "store" },
    { label: "Shops to verify", value: toVerify.length, href: "/shops", icon: "verified", alert: toVerify.length > 0 },
    { label: "Orders this month", value: thisMonth.length, href: "/orders", icon: "receipt" },
    { label: "Sales this month", value: usd(thisMonth.reduce((s, o) => s + orderTotal(o), 0)), href: "/orders", icon: "chart" },
    { label: "Payments to check", value: proofs.length, href: "/payments", icon: "cash", alert: proofs.length > 0 },
    { label: "New shop requests", value: newRequests, href: "/requests", icon: "plusSquare", alert: newRequests > 0 },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Localink at a glance · ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`} />
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {!loaded ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}
        </div>
      ) : (
        <>
          <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s, i) => (
              <Link key={s.label} href={s.href} style={{ "--i": i } as React.CSSProperties} className="group">
                <Card className={`relative h-full p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-md ${s.alert ? "border-brand/30 bg-brand-50/40" : ""}`}>
                  {/* Keeps moving while something needs an admin. */}
                  <Icon name={s.icon} className={`absolute right-4 top-4 size-5 ${s.alert ? "text-brand" : "text-ink-3"}`} loop={s.alert} />
                  <p className="text-xs font-semibold text-ink-3">{s.label}</p>
                  <p className={`mt-2 text-2xl font-extrabold ${s.alert ? "text-brand" : ""}`}>{s.value}</p>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <Card className="p-5 lg:col-span-3">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-bold">Sales, last 6 months</h2>
                <p className="text-xs text-ink-3">Orders placed through Localink (paid to shops directly)</p>
              </div>
              <div className="flex h-48 items-end gap-3">
                {months.map((m, i) => (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[11px] font-semibold text-ink-3">{m.total ? usd(m.total).replace(".00", "") : ""}</span>
                    <div
                      className={`w-full rounded-lg transition-all duration-700 ${i === 5 ? "bg-brand" : "bg-brand/25"}`}
                      style={{ height: `${Math.max(4, (m.total / peak) * 140)}px`, transitionDelay: `${i * 60}ms` }}
                      title={`${m.count} orders`}
                    />
                    <span className={`text-xs font-semibold ${i === 5 ? "text-brand" : "text-ink-3"}`}>{m.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Shops waiting for verification</h2>
                <Link href="/shops" className="text-sm font-semibold text-brand hover:underline">All shops</Link>
              </div>
              {toVerify.length === 0 ? (
                <p className="flex items-center justify-center gap-2 py-6 text-center text-sm text-ink-3">
                  <Icon name="sparkles" className="size-5 text-brand" loop /> Nothing waiting.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {toVerify.slice(0, 6).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{s.name}</p>
                        <p className="truncate text-xs text-ink-3">{s.city} · {s.ownerName}</p>
                      </div>
                      <Badge tone="warning">To verify</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-bold">Recent orders</h2>
              <Link href="/orders" className="text-sm font-semibold text-brand hover:underline">All orders</Link>
            </div>
            {orders.length === 0 ? (
              <div className="px-5 pb-5"><Empty title="No orders yet" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wide text-ink-3">
                    <tr><th className="px-5 py-2.5">Order</th><th className="px-5 py-2.5">Shop</th><th className="px-5 py-2.5">Date</th><th className="px-5 py-2.5">Payment</th><th className="px-5 py-2.5">Status</th><th className="px-5 py-2.5 text-right">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {orders.slice(0, 8).map((o) => (
                      <tr key={o.id} className="hover:bg-surface">
                        <td className="px-5 py-3 font-semibold">#{o.id}</td>
                        <td className="px-5 py-3">{shops.find((s) => s.id === o.stallId)?.name ?? "—"}</td>
                        <td className="px-5 py-3 text-ink-3">{shortDate(o.createdAt)}</td>
                        <td className="px-5 py-3">
                          <span className="text-ink-2">{paymentTitle(o.payment)}</span>{" "}
                          <Badge tone={o.paymentStatus === "confirmed" ? "success" : o.paymentStatus === "proofSent" ? "warning" : "danger"}>{paymentLabel[o.paymentStatus ?? "confirmed"]}</Badge>
                        </td>
                        <td className="px-5 py-3"><Badge tone={o.status === "collected" ? "success" : "neutral"}>{statusLabel[o.status] ?? o.status}</Badge></td>
                        <td className="px-5 py-3 text-right font-semibold">{usd(orderTotal(o))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
