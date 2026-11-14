// Notifications admins send to app users. The console files a `broadcasts`
// doc; the Cloud Functions (Localink/functions/src/broadcasts.ts) write one
// notification per person, and each is pushed to that person's phones.

import { addDoc, collection, limit, onSnapshot, orderBy, query, type Unsubscribe } from "firebase/firestore";

import { db } from "./firebase";
import type { BroadcastDoc, ShopDoc, UserDoc } from "./types";

export type AccountType = "merchant" | "customer";

/** A merchant sells on Localink: in Merchant mode or owning a shop (same rule as the functions). */
export const accountType = (u: UserDoc, owners: Set<string>): AccountType => (owners.has(u.id) || u.role === "merchant" ? "merchant" : "customer");

export const shopOwners = (shops: ShopDoc[]) => new Set(shops.map((s) => s.ownerId).filter(Boolean));

/** Who an audience reaches now (the functions work it out again when sending). Suspended accounts are left out. */
export function audienceOf(audience: BroadcastDoc["audience"], users: UserDoc[], owners: Set<string>, selected: string[] = []): UserDoc[] {
  if (audience === "selected") return users.filter((u) => selected.includes(u.id));
  return users.filter((u) => !u.suspended && (audience === "all" || accountType(u, owners) === (audience === "merchants" ? "merchant" : "customer")));
}

/** Sends it and waits for the functions to deliver it: the number of people reached, or why not. */
export async function sendBroadcast(
  admin: { uid: string; name: string },
  b: Pick<BroadcastDoc, "title" | "body" | "kind" | "audience"> & { userIds?: string[] },
): Promise<{ recipients?: number; error?: string }> {
  const ref = await addDoc(collection(db(), "broadcasts"), {
    title: b.title.trim(),
    body: b.body.trim(),
    kind: b.kind,
    audience: b.audience,
    ...(b.audience === "selected" ? { userIds: b.userIds ?? [] } : {}),
    createdBy: admin.uid,
    createdByName: admin.name,
    status: "pending",
    createdAt: Date.now(),
  });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve({ error: "Still sending. It goes out as soon as Localink has processed it; check the list below in a minute." });
    }, 60_000);
    const stop = onSnapshot(ref, (s) => {
      const d = s.data();
      if (!d || d.status === "pending") return;
      clearTimeout(timer);
      stop();
      resolve(d.status === "sent" ? { recipients: d.recipients ?? 0 } : { error: String(d.error ?? "Could not send it.") });
    });
  });
}

export const watchBroadcasts = (on: (v: BroadcastDoc[]) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(query(collection(db(), "broadcasts"), orderBy("createdAt", "desc"), limit(50)), (s) => on(s.docs.map((d) => ({ ...(d.data() as BroadcastDoc), id: d.id }))), onError);
