"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useAdminData } from "./AdminData";
import { useAuth } from "./AuthProvider";
import { BrandHeader, BrandInline } from "./Brand";
import { Icon, type IconName } from "./icons";

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { user, signOut } = useAuth();
  const { shops, orders, nominations, shopReviews, appReviews, payouts, planPayments } = useAdminData();
  const [open, setOpen] = useState(false);

  const nav: { href: string; label: string; icon: IconName; count?: number }[] = [
    { href: "/", label: "Dashboard", icon: "dashboard" },
    { href: "/shops", label: "Shops", icon: "store", count: shops.filter((s) => !s.verified && !s.suspended).length },
    { href: "/users", label: "Users", icon: "users" },
    { href: "/orders", label: "Orders", icon: "receipt" },
    // Money sent to Localink: proofs to check (orders and Pro), and payouts to send.
    {
      href: "/payments",
      label: "Payments to check",
      icon: "cash",
      count: orders.filter((o) => o.payTo === "localink" && o.paymentStatus === "proofSent").length + planPayments.filter((p) => p.status === "proofSent").length,
    },
    { href: "/payouts", label: "Payouts", icon: "bank", count: payouts.filter((p) => p.status === "pending").length },
    { href: "/requests", label: "Shop requests", icon: "plusSquare", count: nominations.filter((n) => n.status === "new").length },
    // Low ratings from the last week, so problems surface quickly.
    { href: "/reviews", label: "Reviews", icon: "star", count: [...shopReviews, ...appReviews].filter((r) => !r.hidden && r.rating <= 2 && Date.now() - r.updatedAt < 7 * 864e5).length },
    { href: "/admins", label: "Admins", icon: "shieldCheck" },
    { href: "/settings", label: "Payment settings", icon: "sparkles" },
    { href: "/guide", label: "How it works", icon: "book" },
  ];

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 px-2">
        <BrandHeader label="Admin" />
      </div>
      {nav.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-brand-50 text-brand" : "text-ink-2 hover:bg-surface-2"}`}
          >
            <Icon name={n.icon} play={active} />
            <span className="flex-1">{n.label}</span>
            {!!n.count && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{n.count}</span>}
          </Link>
        );
      })}
      <div className="mt-auto rounded-2xl bg-surface-2 p-3">
        <p className="truncate text-sm font-semibold">{user?.displayName || user?.email}</p>
        <p className="truncate text-xs text-ink-3">{user?.email}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/merchant" className="text-sm font-semibold text-ink-2 hover:underline">Merchant console</Link>
          <button onClick={signOut} className="text-sm font-semibold text-brand hover:underline">Sign out</button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">{sidebar}</aside>

      {/* Mobile: top bar + slide-in drawer */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="group rounded-xl p-2 hover:bg-surface-2" aria-label="Menu">
          <Icon name="menu" strokeWidth={2} />
        </button>
        <BrandInline label="Admin" />
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 animate-fade-in bg-ink/40" />
          <aside className="absolute inset-y-0 left-0 w-72 animate-[rise_0.25s_ease-out] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      <main key={path} className="mx-auto max-w-6xl animate-rise px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
