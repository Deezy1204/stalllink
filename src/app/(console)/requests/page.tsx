"use client";

import { useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { Badge, Card, Empty, PageHeader, Tabs, useToast } from "@/components/ui";
import { setNominationStatus } from "@/lib/data";
import { shortDate, type NominationDoc } from "@/lib/types";

const statuses: NominationDoc["status"][] = ["new", "contacted", "onboarded", "dismissed"];
const label = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function RequestsPage() {
  const { nominations, users } = useAdminData();
  const toast = useToast();
  const [filter, setFilter] = useState<NominationDoc["status"] | "all">("new");

  const list = nominations.filter((n) => filter === "all" || n.status === filter);

  async function set(n: NominationDoc, s: NominationDoc["status"]) {
    try {
      await setNominationStatus(n.id, s);
      toast(`Marked as ${s}.`);
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
    }
  }

  return (
    <>
      <PageHeader title="Shop requests" subtitle="Shops buyers asked StallLink to bring on board." />
      <div className="mb-4">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: nominations.length },
            ...statuses.map((s) => ({ value: s, label: label(s), count: nominations.filter((n) => n.status === s).length })),
          ]}
        />
      </div>
      {list.length === 0 ? (
        <Empty title="Nothing here" message="When buyers recommend a shop in the app, it appears here." />
      ) : (
        <div className="stagger grid gap-3 md:grid-cols-2">
          {list.map((n, i) => {
            const by = users.find((u) => u.id === n.userId);
            return (
              <Card key={n.id} index={i} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{n.name}</p>
                    <p className="text-sm text-ink-2">
                      <a href={`https://wa.me/${n.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">{n.phone}</a>
                    </p>
                    <p className="mt-1 text-xs text-ink-3">Suggested by {by?.name || by?.email || "a buyer"} · {shortDate(n.createdAt)}</p>
                  </div>
                  <Badge tone={n.status === "new" ? "brand" : n.status === "onboarded" ? "success" : "neutral"}>{label(n.status)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {statuses.filter((s) => s !== n.status).map((s) => (
                    <button key={s} onClick={() => set(n, s)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-2 transition hover:bg-surface-2 active:scale-95">
                      Mark {s}
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
