// Proof of payment, the same rules as the app (LocalinkGo/lib/data/models.dart
// PaymentProofs) and firestore.rules: one transaction reference (per payee)
// and one proof file back one payment only. Whoever sends proof claims both
// (`paymentRefs/{payee}_{REF}`, `proofHashes/{sha256}`) in the same batch as
// the payment; the rules refuse a claim another payment holds.

import { doc, getDoc, writeBatch, type DocumentReference, type WriteBatch } from "firebase/firestore";

import { db } from "./firebase";
import type { OrderDoc, PlanPaymentDoc, ProofCheckDoc } from "./types";

/** Upper case, letters and digits only: "mp241017.1234.a56789" = "MP241017 1234 A56789". */
export const normRef = (r: string) => r.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Why [ref] is not a transaction reference, or null. [notThese]: references LocalinkGo showed to type on the transfer. */
export function refProblem(ref: string, notThese: string[] = []): string | null {
  const r = normRef(ref);
  if (!r) return "Enter the transaction reference from the payment SMS or receipt";
  if (r.length < 5) return "That reference is too short. Copy the whole reference from the SMS or receipt";
  if (r.length > 40) return "That reference is too long";
  if (!/[0-9]/.test(r)) return "A transaction reference has digits in it. Copy it from the SMS or receipt";
  if (notThese.some((x) => normRef(x) === r)) return "That is the reference typed on the payment. Enter the one the bank or wallet gave it";
  return null;
}

/** Why [amount] does not cover [due], or null. */
export function amountProblem(amount: number | null, due: number): string | null {
  if (amount == null || !(amount > 0)) return "Enter the amount sent";
  if (amount + 0.005 < due) return `The amount due is $${due.toFixed(2)}. Send the rest before uploading proof`;
  return null;
}

export const parseAmount = (s: string): number | null => {
  const n = Number(s.trim().replace(/[$\s]/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : null;
};

/** Payments to LocalinkGo share one set of references; each shop has its own. */
export const refKey = (toLocalink: boolean, shopId: string, ref: string) => `${toLocalink ? "localink" : shopId}_${normRef(ref)}`;

/** SHA-256 of a file, as hex: the same file always gives the same value. */
export async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Smaller than this, a file cannot show a readable payment. */
export const MIN_PROOF_BYTES = 3 * 1024;

export function proofFileProblem(file: File | null): string | null {
  if (!file) return "Attach the proof of payment.";
  if (!/^image\/|^application\/pdf$/.test(file.type)) return "Attach a photo, screenshot or PDF of the receipt.";
  if (file.size >= 8 * 1024 * 1024) return "That file is too large (8 MB at most).";
  if (file.size < MIN_PROOF_BYTES) return "That file is too small to show a payment. Attach a clear screenshot, photo or PDF of the receipt.";
  return null;
}

const claim = (kind: "order" | "plan", id: string, uid: string) => ({ kind, id, uid, createdAt: Date.now() });

/** Adds the claims for payment [kind]/[id] to [batch]. */
export function addClaims(batch: WriteBatch, kind: "order" | "plan", id: string, uid: string, key: string, hash: string) {
  batch.set(doc(db(), "paymentRefs", key), claim(kind, id, uid));
  batch.set(doc(db(), "proofHashes", hash), claim(kind, id, uid));
}

/**
 * Commits a proof with its claims. When the rules refuse it, the claims say
 * which one belongs to another payment (each claim can be read alone).
 */
export async function commitProof(batch: WriteBatch, kind: "order" | "plan", id: string, key: string, hash: string) {
  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string }).code !== "permission-denied") throw e;
    const other = async (ref: DocumentReference) => {
      const s = await getDoc(ref).catch(() => null);
      return !!s?.exists() && !(s.get("kind") === kind && s.get("id") === id);
    };
    if (await other(doc(db(), "paymentRefs", key))) {
      throw new Error("This transaction reference was already used for another payment. Check it is the reference of this payment; if it is, contact LocalinkGo support.");
    }
    if (await other(doc(db(), "proofHashes", hash))) {
      throw new Error("This exact proof file was already sent for another payment. Attach the proof of this payment.");
    }
    throw new Error("LocalinkGo could not accept this proof. Check the transaction reference and try again.");
  }
}

export const newBatch = () => writeBatch(db());

/** What LocalinkGo found in a proof, in plain words (empty = nothing). */
export function proofWarnings(c?: ProofCheckDoc | null): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (c.unreadable) out.push("LocalinkGo could not open the proof file.");
  if (c.sameFileAs?.length) out.push(`This proof file was already used for ${c.sameFileAs.map((x) => (x.kind === "order" ? `order #${x.id}` : "a plan payment")).join(", ")}.`);
  if (!c.unreadable && c.hashOk === false) out.push("The file stored is not the one the app checked.");
  if (c.wrongPlace) out.push("The proof file belongs to another payment.");
  if (c.notImage) out.push("The file is not a photo or PDF.");
  else if (c.small) out.push("The image is too small to read.");
  if (c.short) out.push("The payer says they sent less than is due.");
  return out;
}

type Paid = { kind: "order"; doc: OrderDoc } | { kind: "plan"; doc: PlanPaymentDoc };

/**
 * For admins: other payments among [all] with the same reference (same
 * payee) or the very same file as [p], including ones sent before claims
 * existed. Returns plain warnings.
 */
export function duplicatesOf(p: Paid, all: Paid[]): string[] {
  const keyOf = (x: Paid) => {
    const ref = x.doc.paymentRef ?? "";
    if (!normRef(ref)) return "";
    if (x.kind === "plan") return refKey(true, "", ref);
    return refKey(x.doc.payTo === "localink", x.doc.stallId, ref);
  };
  const label = (x: Paid) => (x.kind === "order" ? `order #${x.doc.id}` : "a plan payment");
  const key = keyOf(p);
  const hash = p.doc.slipHash || p.doc.proofCheck?.sha256 || "";
  const same = (x: Paid) => x.kind === p.kind && x.doc.id === p.doc.id;
  const refs = key ? all.filter((x) => !same(x) && keyOf(x) === key) : [];
  const files = hash ? all.filter((x) => !same(x) && (x.doc.slipHash === hash || x.doc.proofCheck?.sha256 === hash)) : [];
  return [
    ...(refs.length ? [`Reference ${p.doc.paymentRef} was also given for ${refs.map(label).join(", ")}.`] : []),
    ...(files.length ? [`The same proof file was also sent for ${files.map(label).join(", ")}.`] : []),
    ...(!normRef(p.doc.paymentRef ?? "") ? ["No transaction reference was given."] : []),
  ];
}
