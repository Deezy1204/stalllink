"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { watchAdminData } from "@/lib/data";
import type { AdminDoc, InviteDoc, NominationDoc, OrderDoc, ShopDoc, UserDoc } from "@/lib/types";

interface AdminData {
  users: UserDoc[];
  shops: ShopDoc[];
  orders: OrderDoc[];
  nominations: NominationDoc[];
  admins: AdminDoc[];
  invites: InviteDoc[];
  loaded: boolean;
  error: string | null;
}

const empty: AdminData = { users: [], shops: [], orders: [], nominations: [], admins: [], invites: [], loaded: false, error: null };
const Ctx = createContext<AdminData>(empty);

/** Subscribes once to every collection the console needs; pages read from it. */
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>(empty);

  useEffect(() => {
    const set = <K extends keyof AdminData>(key: K) => (v: AdminData[K]) => setData((d) => ({ ...d, [key]: v, loaded: true }));
    return watchAdminData(
      { users: set("users"), shops: set("shops"), orders: set("orders"), nominations: set("nominations"), admins: set("admins"), invites: set("invites") },
      (e) => setData((d) => ({ ...d, loaded: true, error: `Could not load data: ${e.message}. Make sure the latest firestore.rules are deployed.` })),
    );
  }, []);

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export const useAdminData = () => useContext(Ctx);
