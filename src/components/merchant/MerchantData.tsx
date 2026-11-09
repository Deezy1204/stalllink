"use client";

import type { User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Spinner } from "@/components/ui";
import { ensureProfile, watchMyShops, watchNotifications, watchProfile, watchShopOrders } from "@/lib/merchant";
import { DEFAULT_CONFIG, toWallet, watchPaymentsConfig, watchWallet } from "@/lib/money";
import { watchMyAppReview } from "@/lib/reviews";
import type { NotificationDoc, OrderDoc, PaymentsConfig, ReviewDoc, ShopDoc, UserDoc, WalletDoc } from "@/lib/types";

/** A voucher code that did not work at the counter (kept for this visit only, like the app). */
export interface FailedScan {
  code: string;
  time: number;
  reason: string;
}

interface MerchantData {
  user: User;
  profile: UserDoc;
  /** Every shop this account owns. */
  shops: ShopDoc[];
  /** The shop the merchant pages show (switch it in the sidebar). */
  shop: ShopDoc | null;
  selectShop: (id: string) => void;
  /** Orders at all of this account's shops, newest first. */
  orders: OrderDoc[];
  /** Orders at the active shop. */
  shopOrders: OrderDoc[];
  notifications: NotificationDoc[];
  unread: number;
  loaded: boolean;
  error: string | null;
  failedScans: FailedScan[];
  addFailedScan: (code: string, reason: string) => void;
  /** This account's review of Localink: null when they have not written one, undefined while loading. */
  appReview: ReviewDoc | null | undefined;
  /** Localink's accounts, prices and whether online payment is on. */
  config: PaymentsConfig;
  /** What Localink holds for the active shop (empty until it has earned something). */
  wallet: WalletDoc | null;
}

const Ctx = createContext<MerchantData | null>(null);

const activeKey = (uid: string) => `localink.activeShop.${uid}`;

function readActive(uid: string): string | null {
  try {
    return localStorage.getItem(activeKey(uid));
  } catch {
    return null;
  }
}

export function MerchantDataProvider({ user, children }: { user: User; children: ReactNode }) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [shops, setShops] = useState<ShopDoc[]>([]);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [shopsLoaded, setShopsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(() => readActive(user.uid));
  const [failedScans, setFailedScans] = useState<FailedScan[]>([]);
  const [appReview, setAppReview] = useState<ReviewDoc | null | undefined>(undefined);
  const [config, setConfig] = useState<PaymentsConfig>(DEFAULT_CONFIG);
  const [wallet, setWallet] = useState<WalletDoc | null>(null);

  // Profile first: it is created here for accounts that never used the app.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    ensureProfile(user)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        stop = watchProfile(user.uid, setProfile, () => {});
      })
      .catch((e: Error) => !cancelled && setProfileError(`Could not load your profile: ${e.message}`));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [user]);

  useEffect(() => {
    const fail = (e: Error) => setError(`Could not load your shop data: ${e.message}. Make sure the latest firestore.rules are deployed.`);
    const subs = [
      watchMyShops(
        user.uid,
        (v) => {
          setShops(v);
          setShopsLoaded(true);
        },
        fail,
      ),
      watchShopOrders(user.uid, setOrders, fail),
    ];
    return () => subs.forEach((u) => u());
  }, [user.uid]);

  // Notifications sent to the phone number need the profile; re-listen when it changes.
  const phoneDigits = profile?.phoneDigits ?? "";
  useEffect(() => watchNotifications(user.uid, phoneDigits, setNotifications, () => {}), [user.uid, phoneDigits]);

  // Shown as "Rate Localink" until they have.
  useEffect(() => watchMyAppReview(user.uid, setAppReview, () => setAppReview(null)), [user.uid]);

  useEffect(() => watchPaymentsConfig(setConfig, () => {}), []);

  const selectShop = useCallback(
    (id: string) => {
      setActiveId(id);
      try {
        localStorage.setItem(activeKey(user.uid), id);
      } catch {
        // Private window: the choice lasts for this visit only.
      }
    },
    [user.uid],
  );

  const addFailedScan = useCallback((code: string, reason: string) => setFailedScans((l) => [{ code: code || "Unknown code", time: Date.now(), reason }, ...l]), []);

  const shop = shops.find((s) => s.id === activeId) ?? shops[0] ?? null;
  const shopId = shop?.id;
  useEffect(() => {
    if (!shopId) return setWallet(null);
    setWallet(toWallet(shopId));
    return watchWallet(shopId, setWallet, () => {});
  }, [shopId]);
  const shopOrders = useMemo(() => (shop ? orders.filter((o) => o.stallId === shop.id) : []), [orders, shop]);
  const unread = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    document.title = `${unread ? `(${unread}) ` : ""}Localink Merchant`;
  }, [unread]);

  if (profileError) {
    return (
      <Gate>
        <p className="text-sm text-red-800">{profileError}</p>
        <Button variant="secondary" className="mt-4 w-full" onClick={signOut}>Sign out</Button>
      </Gate>
    );
  }
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (profile.suspended) {
    return (
      <Gate>
        <h1 className="text-xl font-bold">Account suspended</h1>
        <p className="mt-2 text-sm text-ink-2">This account has been suspended. Contact Localink support if you think this is a mistake.</p>
        <Button variant="secondary" className="mt-5 w-full" onClick={signOut}>Sign out</Button>
      </Gate>
    );
  }

  return (
    <Ctx.Provider
      value={{ user, profile, shops, shop, selectShop, orders, shopOrders, notifications, unread, loaded: shopsLoaded, error, failedScans, addFailedScan, appReview, config, wallet }}
    >
      {children}
    </Ctx.Provider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-surface to-brand-50 px-4">
      <Card className="w-full max-w-md p-7">{children}</Card>
    </main>
  );
}

export function useMerchant(): MerchantData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMerchant must be used inside the merchant console.");
  return v;
}
