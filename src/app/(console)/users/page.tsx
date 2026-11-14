"use client";

import { useMemo, useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, Empty, PageHeader, SearchInput, Tabs, useConfirm, useToast } from "@/components/ui";
import { addAdmin, setUserSuspended } from "@/lib/data";
import { kycLabel, shortDate, type UserDoc } from "@/lib/types";

type Filter = "all" | "merchants" | "admins" | "suspended";

export default function UsersPage() {
  const { users, shops, admins } = useAdminData();
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const adminIds = useMemo(() => new Set(admins.map((a) => a.uid)), [admins]);
  const shopCount = (u: UserDoc) => shops.filter((s) => s.ownerId === u.id).length;

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return users
      .filter((u) => {
        if (filter === "merchants" && !shops.some((s) => s.ownerId === u.id)) return false;
        if (filter === "admins" && !adminIds.has(u.id)) return false;
        if (filter === "suspended" && !u.suspended) return false;
        return !text || `${u.name} ${u.email} ${u.phone} ${u.city}`.toLowerCase().includes(text);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, shops, adminIds, q, filter]);

  async function act(id: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(id);
    try {
      const r = await fn();
      toast(typeof r === "string" ? r : ok ?? "Done.");
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  const suspend = async (u: UserDoc) => {
    if (!u.suspended && !(await confirm({ title: `Suspend ${u.name || u.email}?`, message: "They will be signed out of the app and cannot sign in until you restore the account.", confirm: "Suspend", danger: true }))) return;
    act(u.id, () => setUserSuspended(u.id, !u.suspended), u.suspended ? "Account restored." : "Account suspended.");
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone with a Localink account. Any account can buy and run shops." />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <SearchInput placeholder="Search name, email, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: users.length },
            { value: "merchants", label: "Shop owners" },
            { value: "admins", label: "Admins", count: admins.length },
            { value: "suspended", label: "Suspended" },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Empty title="No users match" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">Shops</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="stagger divide-y divide-line">
                {list.map((u, i) => (
                  <tr key={u.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties} className="hover:bg-surface">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand">{(u.name || u.email || "?")[0]?.toUpperCase()}</div>
                        <div>
                          <p className="font-semibold">{u.name || "(no name)"}</p>
                          <div className="mt-0.5 flex gap-1">
                            {adminIds.has(u.id) && <Badge tone="dark">Admin</Badge>}
                            {u.suspended && <Badge tone="danger">Suspended</Badge>}
                            {(u.role === "merchant" || u.kyc?.status !== "none") && (
                              <Badge tone={u.kyc?.status === "approved" ? "success" : u.kyc?.status === "declined" ? "danger" : "neutral"}>{kycLabel[u.kyc?.status ?? "none"]}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-2">
                      <p>{u.email || "—"}</p>
                      <p className="text-xs text-ink-3">{u.phone}</p>
                    </td>
                    <td className="px-5 py-3"><Badge tone={u.role === "merchant" ? "brand" : "neutral"}>{u.role === "merchant" ? "Merchant" : "General"}</Badge></td>
                    <td className="px-5 py-3">{shopCount(u) || "—"}</td>
                    <td className="px-5 py-3 text-ink-3">{shortDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {!adminIds.has(u.id) && u.email && (
                          <Button variant="secondary" disabled={busy === u.id} onClick={() => act(u.id, () => addAdmin(u.email, me?.email ?? ""))}>Make admin</Button>
                        )}
                        {u.id !== me?.uid && (
                          <Button variant={u.suspended ? "secondary" : "danger"} loading={busy === u.id} onClick={() => suspend(u)}>{u.suspended ? "Restore" : "Suspend"}</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
