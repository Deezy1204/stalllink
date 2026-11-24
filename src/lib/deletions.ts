/**
 * Requests to delete an account (app: Profile → Delete my account), in
 * `deletionRequests/{uid}`. An admin carries one out with the
 * processAccountDeletion function (Localink/functions/src/accounts.ts).
 */
import { collection, doc, onSnapshot, updateDoc, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "./firebase";

export interface DeletionDoc {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "merchant";
  shopIds: string[];
  reason: string;
  source: string;
  status: "new" | "done" | "declined";
  createdAt: number;
  note: string;
  handledBy: string;
  handledAt: number | null;
}

/** LocalinkGo deletes an account within 30 days of the request (the website says so). */
export const DELETION_DAYS = 30;
export const dueBy = (d: DeletionDoc) => d.createdAt + DELETION_DAYS * 864e5;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function watchDeletionRequests(on: (v: DeletionDoc[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    collection(db(), "deletionRequests"),
    (s) =>
      on(
        s.docs
          .map((d) => {
            const x = d.data();
            const status = x.status === "done" || x.status === "declined" ? x.status : "new";
            return {
              uid: d.id,
              name: str(x.name),
              email: str(x.email),
              phone: str(x.phone),
              role: x.role === "merchant" ? "merchant" : "customer",
              shopIds: Array.isArray(x.shopIds) ? x.shopIds.map(String) : [],
              reason: str(x.reason),
              source: str(x.source),
              status,
              createdAt: num(x.createdAt),
              note: str(x.note),
              handledBy: str(x.handledBy),
              handledAt: num(x.handledAt) || null,
            } satisfies DeletionDoc;
          })
          .sort((a, b) => b.createdAt - a.createdAt),
      ),
    onError,
  );
}

export type DeletionResult =
  | { ok: false; blockers: string[] }
  | { ok: true; counts: Record<string, number>; diditSession: string | null; email: string };

/**
 * Deletes the account of request [uid]. Without [force], the function refuses
 * while something still has to be settled and returns what.
 */
export async function processAccountDeletion(uid: string, force = false): Promise<DeletionResult> {
  try {
    const r = await httpsCallable(functions(), "processAccountDeletion", { timeout: 300_000 })({ uid, force });
    return r.data as DeletionResult;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "functions/not-found" || err.code === "functions/unavailable" || (err.code === "functions/internal" && err.message === "internal")) {
      throw new Error("The account deletion service did not answer. If this keeps happening, the Cloud Functions need deploying.");
    }
    throw new Error(err.message || "Could not delete the account.");
  }
}

/** Not deleting (e.g. an open dispute or fraud check): the person sees [note] in the app. */
export const declineDeletion = (uid: string, note: string, by: string) =>
  updateDoc(doc(db(), "deletionRequests", uid), { status: "declined", note, handledBy: by, handledAt: Date.now() });

/** Back to "to do" (after a decline). */
export const reopenDeletion = (uid: string) => updateDoc(doc(db(), "deletionRequests", uid), { status: "new", note: "", handledBy: "", handledAt: 0 });
