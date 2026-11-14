// Localink's money on the web, the same way the app does it
// (Localink/lib/data/firebase_repository.dart): balances, plans and payouts
// are only changed by the Cloud Functions (functions/src/payments.ts). Pages
// read them, and ask for changes with request documents.

import {
  addDoc,
  collection,
  deleteField,
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
import { DEFAULT_LIMITS, PLANS, payoutDays, type Plan } from "./plans";
import {
  cents,
  type Discount,
  type LedgerDoc,
  type OrderDoc,
  type PaymentOption,
  type PaymentsConfig,
  type PayoutDoc,
  type PlanLimit,
  type PlanPaymentDoc,
  type RewardsConfig,
  type ShopDoc,
  type ShopPromo,
  type WalletDoc,
} from "./types";

export const PRO_DAYS = 30;
export const MIN_PAYOUT = 1;
export const DEFAULT_REWARDS: RewardsConfig = { enabled: false, basis: "order", tiers: [], capPer30Days: 0, label: "Localink bulk discount" };
export const DEFAULT_CONFIG: PaymentsConfig = {
  options: [],
  onlineEnabled: false,
  proMonthly: 20,
  standardMonthly: 10,
  maxMonthly: 40,
  serviceFeePercent: 5,
  standardFeePercent: 2.5,
  rewards: DEFAULT_REWARDS,
  limits: DEFAULT_LIMITS,
};

/** Same as limitsFromMap in the app: null is no limit; a missing or invalid value keeps the default. */
function toLimits(v: unknown): PaymentsConfig["limits"] {
  const out = { ...DEFAULT_LIMITS };
  if (!v || typeof v !== "object") return out;
  const read = (e: DocumentData, key: keyof PlanLimit, fallback: number | null) => {
    if (!(key in e)) return fallback;
    const x = e[key];
    if (x === null) return null;
    return typeof x === "number" && x >= 0 ? Math.trunc(x) : fallback;
  };
  for (const p of PLANS) {
    const e = (v as DocumentData)[p];
    if (!e || typeof e !== "object") continue;
    out[p] = { products: read(e, "products", DEFAULT_LIMITS[p].products), branches: read(e, "branches", DEFAULT_LIMITS[p].branches) };
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function toRewards(v: unknown): RewardsConfig {
  if (!v || typeof v !== "object") return DEFAULT_REWARDS;
  const r = v as DocumentData;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  return {
    enabled: r.enabled === true,
    basis: r.basis === "month" ? "month" : "order",
    tiers: ((r.tiers as DocumentData[] | undefined) ?? [])
      .map((t) => ({ minSpend: n(t?.minSpend), amount: clamp(n(t?.amount), 0, 100000), percent: clamp(n(t?.percent), 0, 50) }))
      .filter((t) => t.minSpend > 0 && (t.amount > 0 || t.percent > 0))
      .sort((a, b) => a.minSpend - b.minSpend),
    capPer30Days: clamp(n(r.capPer30Days), 0, 100000),
    label: (typeof r.label === "string" && r.label.trim()) || "Localink bulk discount",
  };
}

/** Same rules as paymentsConfigFromMap in the app and paymentsConfig in the functions. */
export function toConfig(d?: DocumentData): PaymentsConfig {
  if (!d) return DEFAULT_CONFIG;
  const price = (v: unknown, fallback: number) => (typeof v === "number" && v > 0 ? v : fallback);
  const fee = (v: unknown, fallback: number) => (typeof v === "number" ? clamp(v, 0, 50) : fallback);
  return {
    options: (d.options as PaymentOption[] | undefined) ?? [],
    onlineEnabled: d.onlineEnabled === true,
    proMonthly: price(d.proMonthly, 20),
    standardMonthly: price(d.standardMonthly, 10),
    maxMonthly: price(d.maxMonthly, 40),
    serviceFeePercent: fee(d.serviceFeePercent, 5),
    standardFeePercent: fee(d.standardFeePercent, 2.5),
    rewards: toRewards(d.rewards),
    limits: toLimits(d.limits),
  };
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
  localinkDiscounts: d?.localinkDiscounts ?? 0,
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

/** When the shop's next payout is due on its plan's schedule (06:00 Zimbabwe time). */
export function nextPayoutAt(plan: Plan, from = Date.now()): Date {
  const zw = new Date(from + 2 * 3600e3); // UTC+2, read with getUTC*
  let day = Date.UTC(zw.getUTCFullYear(), zw.getUTCMonth(), zw.getUTCDate(), 6);
  if (day <= zw.getTime()) day += 864e5;
  const days = payoutDays(plan);
  // getUTCDay: 0 = Sunday; ours: 1 = Monday … 7 = Sunday.
  while (days.length && !days.includes(new Date(day).getUTCDay() || 7)) day += 864e5;
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

export const renewWithCredits = (uid: string, shopId: string, plan: Plan, months: number) => walletRequest({ uid, type: "renewPlan", shopId, plan, months });

/** Starts the shop's free trial of [plan] (7 days or 10 orders). Null when done, else the reason. */
export const startTrial = (uid: string, shopId: string, plan: Plan) => walletRequest({ uid, type: "startTrial", shopId, plan });

/** Starts an online payment for a plan and returns the payment page (or why it could not start). */
export async function startOnlinePlanPayment(uid: string, shopId: string, plan: Plan, months: number): Promise<{ url?: string; error?: string }> {
  const r = await addDoc(collection(db(), "onlinePayments"), { uid, kind: "plan", shopId, plan, months, method: "web", status: "new", createdAt: Date.now() });
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

/** Proof of paying Localink for a plan by transfer; an admin approves it. */
export async function submitPlanPayment(uid: string, shop: ShopDoc, plan: Plan, months: number, amount: number, payment: PaymentOption, file: File, reference: string, payerName: string) {
  if (file.size >= 8 * 1024 * 1024) throw new Error("That file is too large (8 MB at most).");
  const target = doc(collection(db(), "planPayments"));
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const slip = ref(storage(), `planSlips/${uid}/${target.id}/proof.${ext}`);
  const task = uploadBytesResumable(slip, file, { contentType: file.type || "image/jpeg" });
  await new Promise<void>((res, rej) => task.on("state_changed", undefined, rej, () => res()));
  await setDoc(target, {
    shopId: shop.id,
    ownerId: uid,
    plan,
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

/** Write-only: the Didit API key and webhook secret (and workflow ID) for the identity checks. Empty fields are left as they are. */
export async function saveDiditSettings(s: { apiKey?: string; workflowId?: string; webhookSecret?: string }) {
  const fields = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, (v ?? "").trim()]).filter(([, v]) => v));
  if (!Object.keys(fields).length) throw new Error("Enter at least one of the Didit settings.");
  await setDoc(doc(db(), "private", "didit"), { ...fields, updatedAt: Date.now() }, { merge: true });
  // Public, so the console can say whether identity checks are set up (never the values).
  await setDoc(
    doc(db(), "config", "kyc"),
    { ...(fields.apiKey ? { apiKeySet: true } : {}), ...(fields.workflowId ? { workflowSet: true } : {}), ...(fields.webhookSecret ? { webhookSet: true } : {}), updatedAt: Date.now() },
    { merge: true },
  );
}

export const watchKycConfig = (on: (c: { apiKeySet?: boolean; workflowSet?: boolean; webhookSet?: boolean; updatedAt?: number }) => void): Unsubscribe =>
  onSnapshot(doc(db(), "config", "kyc"), (s) => on(s.data() ?? {}), () => on({}));

/**
 * Gives a shop [days] of [plan] (e.g. a free month), on top of any time it
 * has left on that plan. Other paid time is replaced. Admins only.
 */
export const grantPlan = (shop: ShopDoc, plan: Plan, days: number) => {
  const now = Date.now();
  const sameLeft = shop.plan === plan && (shop.planUntil ?? 0) > now ? shop.planUntil! : plan === "pro" && !shop.plan && (shop.proUntil ?? 0) > now ? shop.proUntil! : now;
  return updateDoc(doc(db(), "shops", shop.id), { plan, planUntil: sameLeft + days * 864e5, proUntil: deleteField() });
};

/** Ends the shop's paid plan now (it goes back to Basic; nothing it set up is deleted). */
export const endPlan = (shop: ShopDoc) => updateDoc(doc(db(), "shops", shop.id), { planUntil: Date.now(), proUntil: deleteField() });

// ---- identity checks (Didit, run by the Cloud Functions) ---------------------------------------

/** Files a `kycRequests` doc and waits for the functions' answer. */
async function kycRequest(uid: string, action: "start" | "check"): Promise<{ url?: string; error?: string }> {
  const r = await addDoc(collection(db(), "kycRequests"), { uid, action, status: "pending", source: "web", createdAt: Date.now() });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve({ error: "Localink did not answer. Check your connection and try again." });
    }, 40_000);
    const stop = onSnapshot(r, (s) => {
      const d = s.data();
      if (!d || d.status === "pending") return;
      clearTimeout(timer);
      stop();
      resolve(d.status === "done" ? { url: d.url } : { error: String(d.error ?? "Could not start the identity check.") });
    });
  });
}

/** Starts (or continues) the identity check and returns Didit's page. */
export const startKyc = (uid: string) => kycRequest(uid, "start");

/** Asks Localink to fetch the latest answer from Didit. */
export const recheckKyc = (uid: string) => kycRequest(uid, "check");
