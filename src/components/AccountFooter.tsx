"use client";

import Link from "next/link";

import { Icon, type IconName } from "./icons";
import { PRIVACY_URL, TERMS_URL } from "./Legal";

/** "Nyasha Dube" → "ND"; an email → its first letter. */
const initials = (name: string) =>
  name
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/**
 * The foot of a console sidebar: who is signed in, switching to the other
 * console (admins only), signing out, then the legal links on their own line.
 */
export function AccountFooter({
  name,
  email,
  switchTo,
  onSignOut,
  onNavigate,
}: {
  name: string;
  email: string;
  switchTo?: { href: string; label: string; icon: IconName };
  onSignOut: () => void;
  /** Closes the drawer on phones. */
  onNavigate?: () => void;
}) {
  return (
    <div className="mt-auto pt-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex items-center gap-3 p-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand">
            {initials(name || email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">{name || email}</span>
            {name && email && name !== email && <span className="block truncate text-xs text-ink-3">{email}</span>}
          </span>
        </div>
        <div className="border-t border-line p-1.5">
          {switchTo && (
            <Link href={switchTo.href} onClick={onNavigate} className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-2 transition hover:bg-surface-2">
              <Icon name={switchTo.icon} className="size-[18px] text-ink-3 group-hover:text-brand" />
              <span className="flex-1">{switchTo.label}</span>
              <span aria-hidden className="text-ink-3">›</span>
            </Link>
          )}
          <button onClick={onSignOut} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-ink-2 transition hover:bg-red-50 hover:text-red-700">
            <Icon name="logout" className="size-[18px] text-ink-3 group-hover:text-red-700" />
            Sign out
          </button>
        </div>
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-[11px] text-ink-3">
        <a href={TERMS_URL} target="_blank" rel="noreferrer" className="hover:text-brand hover:underline">Terms &amp; Conditions</a>
        <span aria-hidden className="size-1 rounded-full bg-line" />
        <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="hover:text-brand hover:underline">Privacy Policy</a>
      </p>
    </div>
  );
}
