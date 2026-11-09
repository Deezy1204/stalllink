// Reviews of shops and of Localink, read and written the way the mobile app
// does it (Localink/lib/data/serialization.dart reviewToMap), so a review
// written on one shows on the other. Everyone can read visible reviews; the
// Cloud Functions keep each shop's rating in step with them.

import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where, type DocumentData, type Unsubscribe } from "firebase/firestore";

import { db } from "./firebase";
import type { Mode, ReviewDoc } from "./types";

export const MAX_COMMENT = 1000;

export const toReview = (id: string, d: DocumentData): ReviewDoc => ({
  id,
  shopId: typeof d.shopId === "string" ? d.shopId : undefined,
  authorId: d.authorId ?? "",
  authorName: d.authorName ?? "",
  rating: typeof d.rating === "number" ? d.rating : 0,
  comment: d.comment ?? "",
  hidden: d.hidden === true,
  verifiedOrder: d.verifiedOrder === true,
  role: d.role === "merchant" ? "merchant" : d.role === "customer" ? "customer" : undefined,
  source: d.source === "web" ? "web" : d.source === "app" ? "app" : undefined,
  createdAt: typeof d.createdAt === "number" ? d.createdAt : 0,
  updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
});

export const newestFirst = (a: ReviewDoc, b: ReviewDoc) => b.updatedAt - a.updatedAt;

/** Average, count and how many of each star (index 0 = one star). */
export function summarize(reviews: ReviewDoc[]) {
  const stars = [0, 0, 0, 0, 0];
  for (const r of reviews) if (r.rating >= 1 && r.rating <= 5) stars[r.rating - 1]++;
  const count = stars.reduce((a, b) => a + b, 0);
  const average = count ? stars.reduce((s, n, i) => s + n * (i + 1), 0) / count : 0;
  return { count, average, stars };
}

export const ratingWord = (n: number) => ["", "Poor", "Fair", "Good", "Very good", "Excellent"][n] ?? "";

/** "Shop owner" / "Buyer" for a review of Localink. */
export const roleLabel = (r: ReviewDoc) => (r.role === "merchant" ? "Shop owner" : r.role === "customer" ? "Buyer" : "");

// ---- shop reviews ---------------------------------------------------------------

/** The visible reviews of one shop, newest first. */
export const watchShopReviews = (shopId: string, on: (v: ReviewDoc[]) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "shopReviews"), where("shopId", "==", shopId), where("hidden", "==", false)),
    (s) => on(s.docs.map((d) => toReview(d.id, d.data())).sort(newestFirst)),
    onError,
  );

// ---- reviews of Localink ----------------------------------------------------------

/** Every visible review of Localink, newest first. */
export const watchAppReviews = (on: (v: ReviewDoc[]) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "appReviews"), where("hidden", "==", false)),
    (s) => on(s.docs.map((d) => toReview(d.id, d.data())).sort(newestFirst)),
    onError,
  );

/** The account's own review of Localink (also when an admin has hidden it), or null. */
export const watchMyAppReview = (uid: string, on: (v: ReviewDoc | null) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(doc(db(), "appReviews", uid), (s) => on(s.exists() ? toReview(s.id, s.data()) : null), onError);

/** Writes the account's review of Localink from the web console. */
export async function saveAppReview(uid: string, existing: ReviewDoc | null, r: { authorName: string; rating: number; comment: string; role: Mode }) {
  const now = Date.now();
  const fields = { authorName: r.authorName.trim().slice(0, 80), rating: r.rating, comment: r.comment.trim().slice(0, MAX_COMMENT), role: r.role, source: "web", updatedAt: now };
  const ref = doc(db(), "appReviews", uid);
  if (existing) await updateDoc(ref, fields);
  else await setDoc(ref, { ...fields, authorId: uid, hidden: false, createdAt: now });
}

export const deleteAppReview = (uid: string) => deleteDoc(doc(db(), "appReviews", uid));
