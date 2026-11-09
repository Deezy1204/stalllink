"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { watchAdminData } from "@/lib/data";
import { DEFAULT_CONFIG, watchAllPayouts, watchAllPlanPayments, watchPaymentsConfig } from "@/lib/money";
import type { AdminDoc, InviteDoc, NominationDoc, OrderDoc, PaymentsConfig, PayoutDoc, PlanPaymentDoc, ReviewDoc, ShopDoc, UserDoc } from "@/lib/types";

interface AdminData {
  users: UserDoc[];
  shops: ShopDoc[];
  orders: OrderDoc[];
  nominations: NominationDoc[];
  admins: AdminDoc[];
  invites: InviteDoc[];
  shopReviews: ReviewDoc[];
  appReviews: ReviewDoc[];
  payouts: PayoutDoc[];
  planPayments: PlanPaymentDoc[];
  config: PaymentsConfig;
  loaded: boolean;
  error: string | null;
}

const empty: AdminData = { users: [], shops: [], orders: [], nominations: [], admins: [], invites: [], shopReviews: [], appReviews: [], payouts: [], planPayments: [], config: DEFAULT_CONFIG, loaded: false, error: null };
const Ctx = createContext<AdminData>(empty);

/** Subscribes once to every collection the console needs; pages read from it. */
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>(empty);

  useEffect(() => {
    const set = <K extends keyof AdminData>(key: K) => (v: AdminData[K]) => setData((d) => ({ ...d, [key]: v, loaded: true }));
    const fail = (e: Error) => setData((d) => ({ ...d, loaded: true, error: `Could not load data: ${e.message}. Make sure the latest firestore.rules are deployed.` }));
    const money = [watchAllPayouts(set("payouts"), fail), watchAllPlanPayments(set("planPayments"), fail), watchPaymentsConfig(set("config"), fail)];
    const rest = watchAdminData(
      {
        users: set("users"),
        shops: set("shops"),
        orders: set("orders"),
        nominations: set("nominations"),
        admins: set("admins"),
        invites: set("invites"),
        shopReviews: set("shopReviews"),
        appReviews: set("appReviews"),
      },
      fail,
    );
    return () => {
      rest();
      money.forEach((u) => u());
    };
  }, []);

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export const useAdminData = () => useContext(Ctx);
