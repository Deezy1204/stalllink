import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "./firebase";
import type { AdminDoc, InviteDoc, NominationDoc, OrderDoc, ShopDoc, UserDoc } from "./types";

const date = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null);

const toUser = (id: string, d: DocumentData): UserDoc => ({
  id,
  name: d.name ?? "",
  email: d.email ?? "",
  phone: d.phone ?? "",
  role: d.role === "merchant" ? "merchant" : "customer",
  city: d.city ?? "",
  suspended: d.suspended === true,
  createdAt: date(d.createdAt),
});

/** Live view of everything the admin console shows. Returns an unsubscribe function. */
export function watchAdminData(
  on: {
    users: (v: UserDoc[]) => void;
    shops: (v: ShopDoc[]) => void;
    orders: (v: OrderDoc[]) => void;
    nominations: (v: NominationDoc[]) => void;
    admins: (v: AdminDoc[]) => void;
    invites: (v: InviteDoc[]) => void;
  },
  onError: (e: Error) => void,
): Unsubscribe {
  const f = db();
  const subs = [
    onSnapshot(collection(f, "users"), (s) => on.users(s.docs.map((d) => toUser(d.id, d.data()))), onError),
    onSnapshot(collection(f, "shops"), (s) => on.shops(s.docs.map((d) => ({ ...(d.data() as ShopDoc), id: d.id }))), onError),
    onSnapshot(query(collection(f, "orders"), orderBy("createdAt", "desc"), limit(1000)), (s) => on.orders(s.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id }))), onError),
    onSnapshot(
      collection(f, "shopNominations"),
      (s) =>
        on.nominations(
          s.docs
            .map((d) => ({ id: d.id, name: d.data().name ?? "", phone: d.data().phone ?? "", userId: d.data().userId ?? "", status: d.data().status ?? "new", createdAt: date(d.data().createdAt) }) as NominationDoc)
            .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
        ),
      onError,
    ),
    onSnapshot(collection(f, "admins"), (s) => on.admins(s.docs.map((d) => ({ uid: d.id, email: d.data().email ?? "", name: d.data().name ?? "", addedBy: d.data().addedBy ?? "", addedAt: date(d.data().addedAt) }))), onError),
    onSnapshot(collection(f, "adminInvites"), (s) => on.invites(s.docs.map((d) => ({ email: d.id, invitedBy: d.data().invitedBy ?? "", createdAt: date(d.data().createdAt) }))), onError),
  ];
  return () => subs.forEach((u) => u());
}

// ---- admin status -----------------------------------------------------------

/** True when [uid] is an admin. Claims a pending invite for [email] first. */
export async function checkAdmin(uid: string, email: string | null, name: string | null): Promise<boolean> {
  const f = db();
  if ((await getDoc(doc(f, "admins", uid))).exists()) return true;
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  const invite = await getDoc(doc(f, "adminInvites", e));
  if (!invite.exists()) return false;
  await setDoc(doc(f, "admins", uid), { email: e, name: name ?? "", addedBy: invite.data().invitedBy ?? "", addedAt: serverTimestamp() });
  await deleteDoc(invite.ref);
  return true;
}

// ---- actions ------------------------------------------------------------------

export const setShopFlags = (shopId: string, flags: { verified?: boolean; suspended?: boolean }) => updateDoc(doc(db(), "shops", shopId), flags);

export const deleteShop = (shopId: string) => deleteDoc(doc(db(), "shops", shopId));

export const setUserSuspended = (uid: string, suspended: boolean) => setDoc(doc(db(), "users", uid), { suspended }, { merge: true });

export const setNominationStatus = (id: string, status: NominationDoc["status"]) => updateDoc(doc(db(), "shopNominations", id), { status });

/** Makes the account with [email] an admin, or invites the email. Returns a message. */
export async function addAdmin(email: string, invitedBy: string): Promise<string> {
  const f = db();
  const e = email.trim().toLowerCase();
  let found = await getDocs(query(collection(f, "users"), where("emailLower", "==", e), limit(1)));
  if (found.empty) found = await getDocs(query(collection(f, "users"), where("email", "==", email.trim()), limit(1)));
  if (!found.empty) {
    const d = found.docs[0];
    await setDoc(doc(f, "admins", d.id), { email: e, name: d.data().name ?? "", addedBy: invitedBy, addedAt: serverTimestamp() });
    return `${d.data().name || e} is now an admin.`;
  }
  await setDoc(doc(f, "adminInvites", e), { invitedBy, createdAt: serverTimestamp() });
  return `No account uses ${e} yet. They become an admin as soon as they sign in with it (app or web).`;
}

export const removeAdmin = (uid: string) => deleteDoc(doc(db(), "admins", uid));
export const cancelInvite = (email: string) => deleteDoc(doc(db(), "adminInvites", email));
