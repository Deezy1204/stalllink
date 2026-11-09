// Everything a merchant does, written to Firestore the way the mobile app
// does it (Localink/lib/state/app_store.dart), so the app and the web stay
// interchangeable: notifications carry `fromUser` for the push function, and
// shop writes never touch the admin-only `verified` / `suspended` flags.

import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { digitsOnly, dollars, hoursSummary, legacyCategory } from "./catalog";
import { db, storage } from "./firebase";
import { orderTotal, type Discount, type NotificationDoc, type OrderDoc, type Product, type ShopDoc, type ShopPromo, type UserDoc } from "./types";

/** Firestore refuses `undefined` values: drop them (deeply) before writing. */
function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clean) as T;
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, clean(x)])) as T;
  }
  return v;
}

// ---- profile ------------------------------------------------------------------------

const toProfile = (id: string, d: Record<string, unknown>): UserDoc => ({
  id,
  name: (d.name as string) ?? "",
  email: (d.email as string) ?? "",
  phone: (d.phone as string) ?? "",
  phoneDigits: (d.phoneDigits as string) ?? digitsOnly((d.phone as string) ?? ""),
  role: d.role === "merchant" ? "merchant" : "customer",
  city: (d.city as string) ?? "",
  suspended: d.suspended === true,
  findable: d.findable !== false,
});

/**
 * Loads the signed-in account's profile, creating it (in Merchant mode) for an
 * account that has never used the app, as the app does on first sign-in.
 * A transaction, so it never overwrites a profile the sign-up form is writing.
 */
export async function ensureProfile(u: User): Promise<UserDoc> {
  const refDoc = doc(db(), "users", u.uid);
  return runTransaction(db(), async (t) => {
    const snap = await t.get(refDoc);
    if (snap.exists()) return toProfile(u.uid, snap.data());
    const created = {
      name: u.displayName || (u.email ?? "").split("@")[0],
      email: u.email ?? "",
      emailLower: (u.email ?? "").trim().toLowerCase(),
      phone: u.phoneNumber ?? "",
      phoneDigits: digitsOnly(u.phoneNumber ?? ""),
      role: "merchant",
      city: "",
      findable: true,
      createdAt: serverTimestamp(),
    };
    t.set(refDoc, created);
    return toProfile(u.uid, created);
  });
}

export const watchProfile = (uid: string, on: (u: UserDoc) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(doc(db(), "users", uid), (s) => s.exists() && on(toProfile(uid, s.data())), onError);

/** The public part of a profile that people search reads (Localink serialization.dart directoryToMap). */
async function syncDirectory(uid: string, p: { name: string; phone: string; city: string; findable: boolean }) {
  const d = doc(db(), "directory", uid);
  if (!p.findable || !p.name.trim() || !digitsOnly(p.phone)) return deleteDoc(d);
  const lower = p.name.trim().toLowerCase();
  const digits = digitsOnly(p.phone);
  await setDoc(d, {
    name: p.name,
    nameLower: lower,
    nameWords: [...new Set(lower.split(/\s+/).filter(Boolean))],
    phone: p.phone,
    phoneKey: digits.length <= 9 ? digits : digits.slice(-9),
    city: p.city,
  });
}

/** Fields a user may change on their own profile (never the suspension flag). */
export async function saveProfile(uid: string, p: { name: string; phone: string; city: string; findable: boolean }) {
  await setDoc(doc(db(), "users", uid), { name: p.name, phone: p.phone, phoneDigits: digitsOnly(p.phone), city: p.city, findable: p.findable }, { merge: true });
  await syncDirectory(uid, p);
}

/** Profile for an account created on the web (merged, in case first sign-in created a default one). */
export async function createProfile(u: User, p: { name: string; phone: string }) {
  await setDoc(
    doc(db(), "users", u.uid),
    {
      name: p.name,
      email: u.email ?? "",
      emailLower: (u.email ?? "").trim().toLowerCase(),
      phone: p.phone,
      phoneDigits: digitsOnly(p.phone),
      role: "merchant",
      city: "",
      findable: true,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  await syncDirectory(u.uid, { name: p.name, phone: p.phone, city: "", findable: true }).catch(() => {});
}

// ---- live data ------------------------------------------------------------------------

export const watchMyShops = (uid: string, on: (v: ShopDoc[]) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "shops"), where("ownerId", "==", uid)),
    (s) => on(s.docs.map((d) => ({ ...(d.data() as ShopDoc), id: d.id })).sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  );

/** Orders placed at any of this account's shops, newest first. */
export const watchShopOrders = (uid: string, on: (v: OrderDoc[]) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "orders"), where("shopOwnerId", "==", uid)),
    (s) => on(s.docs.map((d) => ({ ...(d.data() as OrderDoc), id: d.id })).sort((a, b) => b.createdAt - a.createdAt)),
    onError,
  );

/** Notifications addressed to the account and to its phone number, newest first. */
export function watchNotifications(uid: string, phoneDigits: string, on: (v: NotificationDoc[]) => void, onError: (e: Error) => void): Unsubscribe {
  const f = db();
  const latest: Record<string, NotificationDoc>[] = [{}, {}];
  const emit = () => on(Object.values({ ...latest[0], ...latest[1] }).sort((a, b) => b.time - a.time));
  const listen = (i: number, field: "toUser" | "toPhone", value: string) =>
    onSnapshot(
      query(collection(f, "notifications"), where(field, "==", value)),
      (s) => {
        latest[i] = Object.fromEntries(s.docs.map((d) => [d.id, { ...(d.data() as NotificationDoc), id: d.id, unread: d.data().unread !== false }]));
        emit();
      },
      onError,
    );
  const subs = [listen(0, "toUser", uid), ...(phoneDigits ? [listen(1, "toPhone", phoneDigits)] : [])];
  return () => subs.forEach((u) => u());
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  const batch = writeBatch(db());
  ids.forEach((id) => batch.update(doc(db(), "notifications", id), { unread: false }));
  await batch.commit();
}

/** Sends an in-app notification; the Cloud Function pushes it to the addressee's devices. */
async function notify(
  fromUid: string,
  n: { title: string; body: string; icon: string; color: "primary" | "secondary" | "neutral"; orderId: string },
  to: { userId?: string; phone?: string },
) {
  const phone = digitsOnly(to.phone ?? "");
  if (!to.userId && !phone) return;
  await addDoc(collection(db(), "notifications"), { ...n, time: Date.now(), unread: true, toUser: to.userId ?? "", toPhone: phone, fromUser: fromUid });
}

// ---- shops ------------------------------------------------------------------------------

/**
 * Saves the shop's settings. Products are left out (they are saved one at a
 * time, below) and so are the admin-only flags and the rating (the Cloud
 * Functions keep it); the rest is merged.
 */
export async function saveShop(uid: string, shop: ShopDoc, isNew: boolean) {
  // `proUntil` too: only Localink sets the plan.
  const { products: _products, verified: _verified, suspended: _suspended, rating: _rating, reviewCount: _reviewCount, proUntil: _proUntil, ...settings } = shop;
  const categories = settings.categories ?? [];
  const hours = hoursSummary(settings.schedule ?? []);
  const data: Record<string, unknown> = {
    ...settings,
    ownerId: uid,
    categories,
    category: legacyCategory(categories),
    hours,
    branches: (settings.branches ?? []).map((b) => ({ ...b, hours })),
  };
  if (isNew) {
    Object.assign(data, { country: settings.country || "Zimbabwe", isOpen: true, logoAsset: settings.logoAsset ?? null, products: [] });
  }
  await setDoc(doc(db(), "shops", shop.id), clean(data), { merge: true });
}

/** Rewrites one product inside the shop document, reading the latest copy first so edits made elsewhere are kept. */
async function editProducts(shopId: string, change: (products: Product[]) => Product[]) {
  const shopRef = doc(db(), "shops", shopId);
  await runTransaction(db(), async (t) => {
    const snap = await t.get(shopRef);
    if (!snap.exists()) throw new Error("This shop no longer exists.");
    const products = ((snap.data().products as Product[] | undefined) ?? []).map((p) => ({ ...p }));
    t.update(shopRef, { products: clean(change(products)) });
  });
}

/** Adds the product (new ones go first, as in the app) or replaces the one with the same id. */
export const saveProduct = (shopId: string, product: Product) =>
  editProducts(shopId, (list) => (list.some((p) => p.id === product.id) ? list.map((p) => (p.id === product.id ? product : p)) : [product, ...list]));

export const deleteProduct = (shopId: string, productId: string) => editProducts(shopId, (list) => list.filter((p) => p.id !== productId));

export const patchProduct = (shopId: string, productId: string, patch: (p: Product) => Partial<Product>) =>
  editProducts(shopId, (list) => list.map((p) => (p.id === productId ? { ...p, ...patch(p) } : p)));

/** Puts a product on sale, or ends its sale (null). */
export const setDiscount = (shopId: string, productId: string, discount: Discount | null) => patchProduct(shopId, productId, () => ({ discount }));

/** Sets (or with null, ends) the shop's offer on the whole basket. */
export const savePromo = (shopId: string, promo: ShopPromo | null) => updateDoc(doc(db(), "shops", shopId), { promo: promo ? clean(promo) : null });

// ---- orders -------------------------------------------------------------------------------

/**
 * The shop has checked the buyer's proof (or the money arrived). Tells the
 * buyer. Only for payments to the shop itself: Localink confirms payments made to it.
 */
export async function confirmPayment(uid: string, o: OrderDoc, shopName: string) {
  if (o.payTo === "localink") throw new Error("Localink confirms payments made through Localink.");
  await updateDoc(doc(db(), "orders", o.id), { paymentStatus: "confirmed" });
  if (o.senderId) {
    await notify(
      uid,
      { title: "Payment confirmed", body: `${shopName} confirmed your ${dollars(orderTotal(o))} payment for #${o.id}.`, icon: "verified", color: "secondary", orderId: o.id },
      { userId: o.senderId },
    ).catch(() => {});
  }
}

/** The groceries were handed over. Tells the buyer and the recipient. */
export async function releaseOrder(uid: string, o: OrderDoc, shopName: string, handoverUrl: string | null) {
  // Handing over means a shop-paid order is paid; a Localink-paid one must
  // already be confirmed by Localink (the rules refuse it otherwise).
  await updateDoc(doc(db(), "orders", o.id), {
    handoverUrl,
    status: "collected",
    collectedAt: Date.now(),
    collectedBy: o.recipient.name,
    ...(o.payTo === "localink" ? {} : { paymentStatus: "confirmed" }),
  });
  const done = { title: "Groceries collected", body: `${o.recipient.name} collected order #${o.id} at ${shopName}.`, icon: "check_circle", color: "secondary" as const, orderId: o.id };
  await Promise.all([
    o.senderId ? notify(uid, done, { userId: o.senderId }) : null,
    digitsOnly(o.recipient.phone) ? notify(uid, done, { phone: o.recipient.phone }) : null,
  ]).catch(() => {});
}

// ---- photos -------------------------------------------------------------------------------

/** Scales a photo down to at most 1600 px and re-encodes it as JPEG, like the app's picker. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch {
    // The browser cannot decode it (e.g. HEIC outside Safari): upload as is.
  }
  return file;
}

/** Uploads a shop, product or handover photo to the owner's folder; returns its URL. */
export async function uploadPhoto(uid: string, file: File, onProgress?: (fraction: number) => void): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPG or PNG).");
  const blob = await shrink(file);
  if (blob.size >= 8 * 1024 * 1024) throw new Error("That photo is too large (8 MB at most).");
  const type = blob.type || file.type || "image/jpeg";
  const ext = type === "image/png" ? "png" : "jpg";
  const target = ref(storage(), `shops/${uid}/img_${Date.now() * 1000 + Math.floor(Math.random() * 1000)}.${ext}`);
  const task = uploadBytesResumable(target, blob, { contentType: type });
  await new Promise<void>((resolve, reject) =>
    task.on("state_changed", (s) => s.totalBytes && onProgress?.(s.bytesTransferred / s.totalBytes), reject, () => resolve()),
  );
  return getDownloadURL(target);
}
