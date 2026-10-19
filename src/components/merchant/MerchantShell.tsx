"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAuth } from "@/components/AuthProvider";
import { Icon, type IconName } from "@/components/icons";
import { useMerchant } from "./MerchantData";

export function ShopThumb({ src, name, className = "size-10" }: { src?: string; name: string; className?: string }) {
  return src?.startsWith("http") ? (
    <img src={src} alt="" className={`${className} shrink-0 rounded-xl object-cover`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand`}>{name[0] ?? "S"}</div>
  );
}

function ShopSwitcher({ onDone }: { onDone: () => void }) {
  const { shops, shop, selectShop } = useMerchant();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  if (!shop) {
    return (
      <Link href="/merchant/shop/new" onClick={onDone} className="group mb-4 flex items-center gap-3 rounded-2xl border border-dashed border-brand/40 bg-brand-50/50 p-3 text-sm font-semibold text-brand">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white"><Icon name="plus" /></span>
        Set up your shop
      </Link>
    );
  }

  return (
    <div ref={box} className="relative mb-4">
      <button onClick={() => setOpen((v) => !v)} className="group flex w-full items-center gap-3 rounded-2xl border border-line p-2.5 text-left transition hover:bg-surface" aria-expanded={open}>
        <ShopThumb src={shop.bannerAsset} name={shop.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{shop.name}</span>
          <span className="block truncate text-xs text-ink-3">{shop.suspended ? "Paused by StallLink" : shop.verified ? "Verified" : "Awaiting verification"}</span>
        </span>
        <Icon name="chevronsUpDown" className="size-4 text-ink-3" strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 animate-rise overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          <p className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-widest text-ink-3">Your shops</p>
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {shops.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    selectShop(s.id);
                    setOpen(false);
                    onDone();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl p-2 text-left text-sm transition hover:bg-surface ${s.id === shop.id ? "bg-brand-50" : ""}`}
                >
                  <ShopThumb src={s.bannerAsset} name={s.name} className="size-8" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                  {s.id === shop.id && <span className="text-xs font-bold text-brand">Active</span>}
                </button>
              </li>
            ))}
          </ul>
          <Link href="/merchant/shop/new" onClick={() => { setOpen(false); onDone(); }} className="group flex items-center gap-2 border-t border-line px-4 py-3 text-sm font-semibold text-brand hover:bg-surface">
            <Icon name="plus" className="size-4" strokeWidth={2} /> Add another shop
          </Link>
        </div>
      )}
    </div>
  );
}

export function MerchantShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { signOut } = useAuth();
  const { profile, user, shopOrders, unread } = useMerchant();
  const [open, setOpen] = useState(false);

  const awaiting = shopOrders.filter((o) => o.status === "readyForPickup").length;
  const proofs = shopOrders.filter((o) => o.paymentStatus === "proofSent").length;
  const nav: { href: string; label: string; icon: IconName; count?: number; alert?: boolean }[] = [
    { href: "/merchant", label: "Overview", icon: "dashboard" },
    { href: "/merchant/orders", label: "Orders", icon: "receipt", count: awaiting, alert: proofs > 0 },
    { href: "/merchant/collect", label: "Scan & collect", icon: "scan" },
    { href: "/merchant/products", label: "Products", icon: "box" },
    { href: "/merchant/revenue", label: "Revenue", icon: "chart" },
    { href: "/merchant/shop", label: "Shop settings", icon: "store" },
    { href: "/merchant/notifications", label: "Notifications", icon: "bell", count: unread, alert: unread > 0 },
    { href: "/merchant/profile", label: "Profile", icon: "user" },
  ];
  const isActive = (href: string) =>
    href === "/merchant" ? path === "/merchant" : href === "/merchant/shop" ? path === "/merchant/shop" : path.startsWith(href);

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-4">
      <div className="mb-5 flex items-center gap-3 px-2">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-brand text-lg font-black text-white shadow-lg shadow-brand/30">S</div>
        <div>
          <p className="font-extrabold text-brand">StallLink</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">Merchant</p>
        </div>
      </div>
      <ShopSwitcher onDone={() => setOpen(false)} />
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setOpen(false)}
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive(n.href) ? "bg-brand-50 text-brand" : "text-ink-2 hover:bg-surface-2"}`}
        >
          {/* The bell keeps ringing while there is something unread. */}
          <Icon name={n.icon} play={isActive(n.href)} loop={n.icon === "bell" && unread > 0} />
          <span className="flex-1">{n.label}</span>
          {!!n.count && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${n.alert ? "bg-brand text-white" : "bg-surface-2 text-ink-2"}`}>{n.count}</span>}
        </Link>
      ))}
      <div className="mt-auto rounded-2xl bg-surface-2 p-3">
        <p className="truncate text-sm font-semibold">{profile.name || user.displayName || user.email}</p>
        <p className="truncate text-xs text-ink-3">{user.email}</p>
        <button onClick={signOut} className="mt-2 text-sm font-semibold text-brand hover:underline">Sign out</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="group rounded-xl p-2 hover:bg-surface-2" aria-label="Menu">
          <Icon name="menu" strokeWidth={2} />
        </button>
        <p className="flex-1 font-extrabold text-brand">StallLink Merchant</p>
        <Link href="/merchant/notifications" className="group relative rounded-xl p-2 hover:bg-surface-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Icon name="bell" loop={unread > 0} />
          {!!unread && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-4 text-white">{unread}</span>}
        </Link>
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
