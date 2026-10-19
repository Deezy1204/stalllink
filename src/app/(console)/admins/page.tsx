"use client";

import { useState, type FormEvent } from "react";

import { useAdminData } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/icons";
import { Badge, Button, Card, Input, PageHeader, useConfirm, useToast } from "@/components/ui";
import { addAdmin, cancelInvite, removeAdmin } from "@/lib/data";
import { shortDate } from "@/lib/types";

export default function AdminsPage() {
  const { admins, invites } = useAdminData();
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast("Enter a valid email address.", "error");
      return;
    }
    setBusy(true);
    try {
      toast(await addAdmin(email, user?.email ?? ""));
      setEmail("");
    } catch (err) {
      toast(`Could not add that admin: ${(err as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok);
    } catch (err) {
      toast(`That did not work: ${(err as Error).message}`, "error");
    }
  }

  return (
    <>
      <PageHeader title="Admins" subtitle="Admins manage every shop, user and order, here and in the mobile app (Profile → Admin console)." />

      <Card className="mb-6 p-5">
        <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input label="Add an admin by email" type="email" placeholder="colleague@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="h-11" loading={busy}>Add admin</Button>
        </form>
        <p className="mt-2 text-xs text-ink-3">If nobody has signed up with that email yet, they become an admin the first time they sign in with it.</p>
      </Card>

      <Card className="overflow-hidden">
        <ul className="stagger divide-y divide-line">
          {admins.map((a, i) => (
            <li key={a.uid} style={{ "--i": i } as React.CSSProperties} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-bold text-white">{(a.name || a.email || "?")[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.name || a.email}</p>
                <p className="truncate text-sm text-ink-3">{a.email}{a.addedBy ? ` · added by ${a.addedBy}` : ""}{a.addedAt ? ` · ${shortDate(a.addedAt)}` : ""}</p>
              </div>
              {a.uid === user?.uid ? (
                <Badge tone="brand">You</Badge>
              ) : (
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (await confirm({ title: `Remove ${a.email}?`, message: "They lose admin access straight away.", confirm: "Remove", danger: true })) run(() => removeAdmin(a.uid), "Admin removed.");
                  }}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
          {invites.map((inv) => (
            <li key={inv.email} className="group flex items-center gap-3 px-5 py-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-line text-ink-3"><Icon name="mail" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{inv.email}</p>
                <p className="truncate text-sm text-ink-3">Invited{inv.invitedBy ? ` by ${inv.invitedBy}` : ""} · waiting for first sign-in</p>
              </div>
              <Badge tone="warning">Pending</Badge>
              <Button variant="ghost" onClick={() => run(() => cancelInvite(inv.email), "Invite cancelled.")}>Cancel</Button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
