"use client";

import { useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Tabs, Textarea, useToast } from "@/components/ui";
import { declineDeletion, dueBy, processAccountDeletion, reopenDeletion, type DeletionDoc } from "@/lib/deletions";
import { shortDate } from "@/lib/types";

const DAY = 864e5;
const STATUS: Record<DeletionDoc["status"], { label: string; tone: "brand" | "success" | "neutral" }> = {
  new: { label: "To do", tone: "brand" },
  done: { label: "Deleted", tone: "success" },
  declined: { label: "Not deleted", tone: "neutral" },
};

type Step =
  | { kind: "confirm"; d: DeletionDoc }
  | { kind: "blocked"; d: DeletionDoc; blockers: string[] }
  | { kind: "done"; d: DeletionDoc; counts: Record<string, number>; diditSession: string | null; email: string }
  | { kind: "decline"; d: DeletionDoc };

/**
 * People who asked in the app (Profile → Delete my account) for their account
 * and its data to be deleted. LocalinkGo must do it within 30 days of the
 * request and tell them (localinkgo.com/datadeletion). "Delete the account
 * now" runs processAccountDeletion, which first checks nothing is left to
 * settle (paid orders not collected, earnings held, payouts not sent).
 */
export default function DeletionsPage() {
  const { deletions, shops } = useAdminData();
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<DeletionDoc["status"] | "all">("new");
  const [step, setStep] = useState<Step | null>(null);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const list = deletions.filter((d) => tab === "all" || d.status === tab);
  const shopNames = (d: DeletionDoc) => d.shopIds.map((id) => shops.find((s) => s.id === id)?.name).filter(Boolean) as string[];

  const open = (s: Step) => {
    setTyped("");
    setNote("");
    setStep(s);
  };

  async function run(d: DeletionDoc, force: boolean) {
    setBusy(true);
    try {
      const r = await processAccountDeletion(d.uid, force);
      if (r.ok) {
        setStep({ kind: "done", d, counts: r.counts, diditSession: r.diditSession, email: r.email || d.email });
        toast(`${d.name || d.email || "The account"} was deleted.`);
      } else {
        setStep({ kind: "blocked", d, blockers: r.blockers });
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function decline(d: DeletionDoc) {
    setBusy(true);
    try {
      await declineDeletion(d.uid, note.trim(), user?.uid ?? "");
      toast("Marked as not deleted. They see your note in the app.");
      setStep(null);
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function reopen(d: DeletionDoc) {
    try {
      await reopenDeletion(d.uid);
      toast("Back in To do.");
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
    }
  }

  return (
    <>
      <PageHeader title="Account deletions" subtitle="People who asked in the app to delete their account. Delete it within 30 days of the request, then email them that it is done." />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "new", label: "To do", count: deletions.filter((d) => d.status === "new").length },
            { value: "done", label: "Deleted", count: deletions.filter((d) => d.status === "done").length },
            { value: "declined", label: "Not deleted", count: deletions.filter((d) => d.status === "declined").length },
            { value: "all", label: "All", count: deletions.length },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Empty title="Nothing here" message="When someone taps Profile → Delete my account in the app, their request appears here." />
      ) : (
        <div className="stagger grid gap-3 md:grid-cols-2">
          {list.map((d, i) => {
            const daysLeft = Math.ceil((dueBy(d) - Date.now()) / DAY);
            const names = shopNames(d);
            return (
              <Card key={d.uid} index={i} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{d.name || "No name"}</p>
                    {d.email && (
                      <a href={`mailto:${d.email}`} className="block truncate text-sm font-semibold text-brand hover:underline">
                        {d.email}
                      </a>
                    )}
                    {d.phone && <p className="text-sm text-ink-2">{d.phone}</p>}
                  </div>
                  <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                </div>

                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-ink-3">Asked</dt>
                  <dd>{shortDate(d.createdAt)}</dd>
                  {d.status === "new" && (
                    <>
                      <dt className="text-ink-3">Due by</dt>
                      <dd className={daysLeft <= 7 ? "font-semibold text-red-700" : ""}>
                        {shortDate(dueBy(d))} · {daysLeft < 0 ? `${-daysLeft} day${daysLeft === -1 ? "" : "s"} late` : daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                      </dd>
                    </>
                  )}
                  <dt className="text-ink-3">Account</dt>
                  <dd>{d.role === "merchant" ? "Shop owner" : "Buyer"}{d.shopIds.length > 0 && ` · ${d.shopIds.length} shop${d.shopIds.length === 1 ? "" : "s"}${names.length ? `: ${names.join(", ")}` : ""}`}</dd>
                  {d.handledAt && (
                    <>
                      <dt className="text-ink-3">{d.status === "done" ? "Deleted" : "Handled"}</dt>
                      <dd>{shortDate(d.handledAt)}</dd>
                    </>
                  )}
                </dl>

                {d.reason && <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">&ldquo;{d.reason}&rdquo;</p>}
                {d.note && <p className="mt-3 text-xs text-ink-3">{d.note}</p>}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {d.status === "new" && (
                    <>
                      <Button variant="danger" onClick={() => open({ kind: "confirm", d })}>Delete the account now</Button>
                      <Button variant="ghost" onClick={() => open({ kind: "decline", d })}>Do not delete</Button>
                    </>
                  )}
                  {d.status === "declined" && <Button variant="secondary" onClick={() => reopen(d)}>Back to To do</Button>}
                  {d.status === "done" && d.email && (
                    <a href={`mailto:${d.email}?subject=${encodeURIComponent("Your LocalinkGo account was deleted")}`} className="text-sm font-semibold text-brand hover:underline">
                      Email them
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {step?.kind === "confirm" && (
        <Modal
          open
          onClose={() => !busy && setStep(null)}
          title={`Delete ${step.d.name || "this account"}?`}
          footer={
            <>
              <Button variant="secondary" disabled={busy} onClick={() => setStep(null)}>Cancel</Button>
              <Button variant="danger" loading={busy} disabled={typed.trim().toUpperCase() !== "DELETE"} onClick={() => run(step.d, false)}>
                Delete the account
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-ink-2">
            <p>This cannot be undone. LocalinkGo deletes:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>the profile and sign-in, people search entry and saved recipients</li>
              <li>the identity check details, reviews they wrote, shops they recommended, notifications and push registrations</li>
              {step.d.shopIds.length > 0 && <li>their shops (products, photos, branches, payment accounts) and payout account details</li>}
              <li>unpaid orders still open are cancelled</li>
            </ul>
            <p>Kept for records: orders, proofs of payment, wallets, payouts and plan payments. If something is still to settle (paid orders not collected, earnings held, payouts not sent), nothing is deleted and you see what first.</p>
            <Input label='Type "DELETE" to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        </Modal>
      )}

      {step?.kind === "blocked" && (
        <Modal
          open
          onClose={() => !busy && setStep(null)}
          title="Settle these first"
          footer={
            <>
              <Button variant="secondary" disabled={busy} onClick={() => setStep(null)}>Close</Button>
              <Button variant="danger" loading={busy} onClick={() => run(step.d, true)}>I have settled these: delete anyway</Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-ink-2">
            <p>Nothing was deleted. So no one loses money, these need sorting out first:</p>
            <ul className="list-disc space-y-1 pl-5">
              {step.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="text-xs text-ink-3">Deleting anyway keeps the orders, wallets and payouts on record, but the person can no longer sign in to follow them.</p>
          </div>
        </Modal>
      )}

      {step?.kind === "done" && (
        <Modal open onClose={() => setStep(null)} title="Account deleted" footer={<Button onClick={() => setStep(null)}>Done</Button>}>
          <div className="space-y-3 text-sm text-ink-2">
            <p>
              <b>Next:</b>{" "}
              {step.email ? (
                <>
                  email <a className="font-semibold text-brand hover:underline" href={`mailto:${step.email}?subject=${encodeURIComponent("Your LocalinkGo account was deleted")}`}>{step.email}</a> to tell them it is done.
                </>
              ) : (
                "tell them it is done."
              )}
            </p>
            {step.diditSession && (
              <p>
                They did an identity check: ask Didit to delete session <code className="rounded bg-surface-2 px-1">{step.diditSession}</code> (Didit console → Sessions).
              </p>
            )}
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-3">
              {Object.entries(step.counts)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <li key={k}>
                    {k}: {n}
                  </li>
                ))}
            </ul>
          </div>
        </Modal>
      )}

      {step?.kind === "decline" && (
        <Modal
          open
          onClose={() => !busy && setStep(null)}
          title="Do not delete this account"
          footer={
            <>
              <Button variant="secondary" disabled={busy} onClick={() => setStep(null)}>Cancel</Button>
              <Button loading={busy} disabled={note.trim().length < 5} onClick={() => decline(step.d)}>Save</Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-ink-2">
            <p>Only when the law lets LocalinkGo keep it, for example a fraud check or a dispute still open. They see this note in the app.</p>
            <Textarea label="Why" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="We are checking a payment dispute on order #… and will delete your account once it is closed." />
          </div>
        </Modal>
      )}
    </>
  );
}
