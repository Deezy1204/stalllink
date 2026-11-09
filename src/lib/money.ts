// Localink's money on the web, the same way the app does it
// (Localink/lib/data/firebase_repository.dart): balances, plans and payouts
// are only changed by the Cloud Functions (functions/src/payments.ts). Pages
// read them, and ask for changes with request documents.

import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { db, storage } from "./firebase";
import {
  cents,
  type Discount,
  type LedgerDoc,
  type OrderDoc,
  type PaymentOption,
  type PaymentsConfig,
  type PayoutDoc,
  type PlanPaymentDoc,
  type ShopDoc,
  type ShopPromo,
  type WalletDoc,
} from "./types";

export const PRO_DAYS = 30;
export const MIN_PAYOUT = 1;
export const DEFAULT_CONFIG: PaymentsConfig = { options: [], onlineEnabled: false, proMonthly: 20, serviceFeePercent: 5 };

/** Same rules as paymentsConfigFromMap in the app. */
export function toConfig(d?: DocumentData): PaymentsConfig {
  if (!d) return DEFAULT_CONFIG;
  const pro = typeof d.proMonthly === "number" && d.proMonthly > 0 ? d.proMonthly : 20;
  const fee = typeof d.serviceFeePercent === "number" ? Math.min(Math.max(d.serviceFeePercent, 0), 50) : 5;
  return { options: (d.options as PaymentOption[] | undefined) ?? [], onlineEnabled: d.onlineEnabled === true, proMonthly: pro, serviceFeePercent: fee };
}

export const watchPaymentsConfig = (on: (c: PaymentsConfig) => void, onError?: (e: Error) => void): Unsubscribe =>
  onSnapshot(doc(db(), "config", "payments"), (s) => on(toConfig(s.data())), onError);

export const toWallet = (shopId: string, d?: DocumentData): WalletDoc => ({
  shopId,
  ownerId: d?.ownerId,
  balance: d?.balance ?? 0,
  pending: d?.pending ?? 0,
  earned: d?.earned ?? 0,
  paidOut: d?.paidOut ?? 0,
  spent: d?.spent ?? 0,
  payout: d?.payout ?? null,
  autoPayout: d?.autoPayout !== false,
  autoRenew: d?.autoRenew !== false,
  lastPayoutAt: d?.lastPayoutAt,
});

export const watchWallet = (shopId: string, on: (w: WalletDoc) => void, onError?: (e: Error) => void): Unsubscribe =>
  onSnapshot(doc(db(), "wallets", shopId), (s) => on(toWallet(shopId, s.data())), onError);

export const watchLedger = (shopId: string, on: (v: LedgerDoc[]) => void, onError?: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "wallets", shopId, "ledger"), orderBy("createdAt", "desc"), limit(60)),
    (s) => on(s.docs.map((d) => ({ ...(d.data() as LedgerDoc), id: d.id }))),
    onError,
  );

/** Filtered by owner too: the rules only let owners list their own. */
export const watchShopPayouts = (uid: string, shopId: string, on: (v: PayoutDoc[]) => void, onError?: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "payouts"), where("ownerId", "==", uid), where("shopId", "==", shopId)),
    (s) => on(s.docs.map((d) => ({ ...(d.data() as PayoutDoc), id: d.id })).sort((a, b) => b.createdAt - a.createdAt)),
    onError,
  );

export const watchShopPlanPayments = (uid: string, shopId: string, on: (v: PlanPaymentDoc[]) => void, onError?: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "planPayments"), where("ownerId", "==", uid), where("shopId", "==", shopId)),
    (s) => on(s.docs.map((d) => ({ ...(d.data() as PlanPaymentDoc), id: d.id })).sort((a, b) => b.createdAt - a.createdAt)),
    onError,
  );

// ---- prices -------------------------------------------------------------------------------

export const applyDiscount = (price: number, d: Discount) => cents((price * (100 - d.percent)) / 100);

export const promoHeadline = (p: ShopPromo) => `${p.percent}% off ${p.minSpend ? `orders over $${Number.isInteger(p.minSpend) ? p.minSpend : p.minSpend.toFixed(2)}` : "everything"}`;

/** When the shop's next payout is due: daily on Pro, Mondays on Basic (06:00 Zimbabwe time). */
export function nextPayoutAt(pro: boolean, from = Date.now()): Date {
  const zw = new Date(from + 2 * 3600e3); // UTC+2, read with getUTC*
  let day = Date.UTC(zw.getUTCFullYear(), zw.getUTCMonth(), zw.getUTCDate(), 6);
  if (day <= zw.getTime()) day += 864e5;
  while (!pro && new Date(day).getUTCDay() !== 1) day += 864e5;
  return new Date(day - 2 * 3600e3);
}

// ---- shop owners ------------------------------------------------------------------------------

/** Where payouts go, and the automatic payout / renewal choices (the only wallet fields owners may write). */
export const saveWalletSettings = (uid: string, shopId: string, s: { payout?: PaymentOption | null; autoPayout?: boolean; autoRenew?: boolean }) =>
  setDoc(doc(db(), "wallets", shopId), { ...s, ownerId: uid, updatedAt: Date.now() }, { merge: true });

/** Files a request for the functions and waits for the answer: null when done, else the reason. */
async function walletRequest(data: Record<string, unknown>): Promise<string | null> {
  const r = await addDoc(collection(db(), "walletRequests"), { ...data, status: "pending", createdAt: Date.now() });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve("Localink has not answered yet. It goes through as soon as it is processed; check again in a minute.");
    }, 40_000);
    const stop = onSnapshot(r, (s) => {
      const d = s.data();
      if (!d || d.status === "pending") return;
      clearTimeout(timer);
      stop();
      resolve(d.status === "done" ? null : String(d.error ?? "Localink could not do that."));
    });
  });
}

export const renewWithCredits = (uid: string, shopId: string, months: number) => walletRequest({ uid, type: "renewPlan", shopId, months });

/** Starts an online payment for Pro and returns the payment page (or why it could not start). */
export async function startOnlinePlanPayment(uid: string, shopId: string, months: number): Promise<{ url?: string; error?: string }> {
  const r = await addDoc(collection(db(), "onlinePayments"), { uid, kind: "plan", shopId, months, method: "web", status: "new", createdAt: Date.now() });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve({ error: "The payment service did not answer. Try again in a moment." });
    }, 40_000);
    const stop = onSnapshot(r, (s) => {
      const d = s.data();
      if (!d || d.status === "new") return;
      clearTimeout(timer);
      stop();
      resolve(d.status === "failed" ? { error: String(d.error ?? "The payment could not be started.") } : { url: d.redirectUrl });
    });
  });
}

/** Proof of paying Localink for Pro by transfer; an admin approves it. */
export async function submitPlanPayment(uid: string, shop: ShopDoc, months: number, amount: number, payment: PaymentOption, file: File, reference: string, payerName: string) {
  if (file.size >= 8 * 1024 * 1024) throw new Error("That file is too large (8 MB at most).");
  const target = doc(collection(db(), "planPayments"));
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const slip = ref(storage(), `planSlips/${uid}/${target.id}/proof.${ext}`);
  const task = uploadBytesResumable(slip, file, { contentType: file.type || "image/jpeg" });
  await new Promise<void>((res, rej) => task.on("state_changed", undefined, rej, () => res()));
  await setDoc(target, {
    shopId: shop.id,
    ownerId: uid,
    months,
    amount,
    payment,
    slipUrl: await getDownloadURL(slip),
    paymentRef: reference,
    payerName,
    status: "proofSent",
    createdAt: Date.now(),
  });
}

// ---- admins -------------------------------------------------------------------------------------

export const watchAllPayouts = (on: (v: PayoutDoc[]) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "payouts"), orderBy("createdAt", "desc"), limit(300)),
    (s) => on(s.docs.map((d) => ({ ...(d.data() as PayoutDoc), id: d.id }))),
    onError,
  );

export const watchAllPlanPayments = (on: (v: PlanPaymentDoc[]) => void, onError: (e: Error) => void): Unsubscribe =>
  onSnapshot(
    query(collection(db(), "planPayments"), orderBy("createdAt", "desc"), limit(300)),
    (s) => on(s.docs.map((d) => ({ ...(d.data() as PlanPaymentDoc), id: d.id }))),
    onError,
  );

/** The money for a Localink order arrived: the functions book the shop's earnings and tell the buyer and shop. */
export const confirmLocalinkPayment = (o: OrderDoc) => updateDoc(doc(db(), "orders", o.id), { paymentStatus: "confirmed", paidVia: "transfer", paidAt: Date.now() });

/** The proof did not match a payment: back to "awaiting proof" so the buyer can send it again, and they are told why. */
export async function rejectLocalinkProof(adminUid: string, o: OrderDoc, reason: string) {
  await updateDoc(doc(db(), "orders", o.id), { paymentStatus: "awaitingProof" });
  if (!o.senderId) return;
  await addDoc(collection(db(), "notifications"), {
    title: `Payment for #${o.id} not found`,
    body: `Localink could not match your proof${reason ? `: ${reason}` : ""}. Check the amount and reference, and send it again.`,
    time: Date.now(),
    icon: "receipt_long",
    color: "neutral",
    unread: true,
    orderId: o.id,
    toUser: o.senderId,
    toPhone: "",
    fromUser: adminUid,
  }).catch(() => {});
}

export const markPayout = (adminUid: string, id: string, status: "paid" | "failed", details: { reference?: string; note?: string }) =>
  updateDoc(doc(db(), "payouts", id), { status, ...(details.reference ? { reference: details.reference } : {}), ...(details.note ? { note: details.note } : {}), handledBy: adminUid, handledAt: Date.now() });

export const decidePlanPayment = (adminUid: string, id: string, status: "approved" | "rejected", note = "") =>
  updateDoc(doc(db(), "planPayments", id), { status, ...(note ? { note } : {}), handledBy: adminUid, handledAt: Date.now() });

export const savePaymentsConfig = (c: PaymentsConfig) => setDoc(doc(db(), "config", "payments"), c);

/** Write-only: no browser can read the key back (firestore.rules). */
export const savePaynowCredentials = (integrationId: string, integrationKey: string) =>
  setDoc(doc(db(), "private", "paynow"), { integrationId: integrationId.trim(), integrationKey: integrationKey.trim(), updatedAt: Date.now() });

/** Gives a shop Pro for [days] (e.g. a free month), added to any Pro it has left. */
export const grantPro = (shop: ShopDoc, days: number) =>
  updateDoc(doc(db(), "shops", shop.id), { proUntil: Math.max(Date.now(), shop.proUntil ?? 0) + days * 864e5 });

export const endPro = (shop: ShopDoc) => updateDoc(doc(db(), "shops", shop.id), { proUntil: Date.now() });
