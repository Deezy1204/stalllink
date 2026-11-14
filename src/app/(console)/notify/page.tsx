"use client";

import { useEffect, useMemo, useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { Icon } from "@/components/icons";
import { Badge, Button, Card, Empty, Input, PageHeader, Pill, SearchInput, Textarea, useConfirm, useToast } from "@/components/ui";
import { accountType, audienceOf, sendBroadcast, shopOwners, watchBroadcasts } from "@/lib/broadcasts";
import { digitsOnly } from "@/lib/catalog";
import { shortDate, type BroadcastDoc, type UserDoc } from "@/lib/types";

const KINDS: { value: BroadcastDoc["kind"]; label: string; hint: string }[] = [
  { value: "announcement", label: "Announcement", hint: "News and updates" },
  { value: "offer", label: "Offer", hint: "Promotions and discounts" },
  { value: "important", label: "Important", hint: "Changes people must know about" },
];

const AUDIENCE_LABEL: Record<BroadcastDoc["audience"], string> = { all: "All users", merchants: "Merchants", customers: "Customers", selected: "Chosen people" };

const TITLE_MAX = 80;
const BODY_MAX = 500;

/**
 * Admins send a notification to app users: everyone, merchants, customers,
 * or people they pick. Each person gets it in the app's Notifications and,
 * with the app installed and notifications allowed, as a push message.
 */
export default function NotifyPage() {
  const { users, shops, admins } = useAdminData();
  const { user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [kind, setKind] = useState<BroadcastDoc["kind"]>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<BroadcastDoc["audience"]>("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<BroadcastDoc[]>([]);

  useEffect(() => watchBroadcasts(setHistory, () => setHistory([])), []);

  const owners = useMemo(() => shopOwners(shops), [shops]);
  const adminIds = useMemo(() => new Set(admins.map((a) => a.uid)), [admins]);
  const shopsOf = (u: UserDoc) => shops.filter((s) => s.ownerId === u.id);
  const count = (a: BroadcastDoc["audience"]) => audienceOf(a, users, owners).length;
  const reach = audienceOf(audience, users, owners, picked);

  // People search: every word in the name or email, or the digits of the phone number.
  const matches = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (text.length < 2) return [];
    const digits = digitsOnly(text);
    const words = text.split(/\s+/).filter(Boolean);
    return users
      .filter((u) => (digits.length >= 3 && digitsOnly(u.phone ?? "").includes(digits)) || words.every((w) => `${u.name} ${u.email}`.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [q, users]);

  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const titleErr = !title.trim() ? "Enter a title" : title.length > TITLE_MAX ? `${TITLE_MAX} characters at most` : null;
  const bodyErr = !body.trim() ? "Enter the message" : body.length > BODY_MAX ? `${BODY_MAX} characters at most` : null;

  async function send() {
    setTried(true);
    if (titleErr || bodyErr) return;
    if (reach.length === 0) return toast(audience === "selected" ? "Choose at least one person." : "Nobody is in that group yet.", "error");
    const ok = await confirm({
      title: `Send to ${reach.length} ${reach.length === 1 ? "person" : "people"}?`,
      message: `“${title.trim()}” goes to ${audience === "selected" ? reach.map((u) => u.name || u.email).slice(0, 5).join(", ") + (reach.length > 5 ? ` and ${reach.length - 5} more` : "") : AUDIENCE_LABEL[audience].toLowerCase()} in the app and as a push message. It cannot be taken back.`,
      confirm: "Send now",
    });
    if (!ok || !user) return;
    setBusy(true);
    const me = admins.find((a) => a.uid === user.uid);
    const r = await sendBroadcast({ uid: user.uid, name: me?.name || user.displayName || user.email || "Admin" }, { title, body, kind, audience, userIds: picked });
    setBusy(false);
    if (r.error) return toast(r.error, "error");
    toast(`Sent to ${r.recipients} ${r.recipients === 1 ? "person" : "people"}.`);
    setTitle("");
    setBody("");
    setPicked([]);
    setQ("");
    setTried(false);
  }

  const personRow = (u: UserDoc) => {
    const type = accountType(u, owners);
    const own = shopsOf(u);
    const chosen = picked.includes(u.id);
    return (
      <button
        key={u.id}
        type="button"
        onClick={() => toggle(u.id)}
        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${chosen ? "border-brand bg-brand-50" : "border-line hover:bg-surface"}`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand">{(u.name || u.email || "?")[0]?.toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">{u.name || "(no name)"}</span>
            <Badge tone={type === "merchant" ? "brand" : "neutral"}>{type === "merchant" ? "Merchant" : "Customer"}</Badge>
            {adminIds.has(u.id) && <Badge tone="dark">Admin</Badge>}
            {u.suspended && <Badge tone="danger">Suspended</Badge>}
          </span>
          <span className="block truncate text-xs text-ink-3">
            {[u.email, u.phone, u.city, own.length ? `${own.length} shop${own.length === 1 ? "" : "s"}: ${own.map((s) => s.name).join(", ")}` : null].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${chosen ? "border-brand bg-brand text-white" : "border-line"}`}>{chosen && <Icon name="check" className="size-3.5" strokeWidth={3} />}</span>
      </button>
    );
  };

  return (
    <>
      <PageHeader title="Send notification" subtitle="To app users, in the app and as a push message on their phones." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div>
              <p className="mb-1.5 text-sm font-semibold">Kind</p>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => <Pill key={k.value} selected={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</Pill>)}
              </div>
              <p className="mt-1 text-xs text-ink-3">{KINDS.find((k) => k.value === kind)?.hint}</p>
            </div>
            <Input label="Title" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Free delivery this weekend" error={tried ? titleErr : null} hint={`${title.length}/${TITLE_MAX}`} />
            <Textarea label="Message" value={body} maxLength={BODY_MAX} rows={4} onChange={(e) => setBody(e.target.value)} placeholder="What do you want people to know?" error={tried ? bodyErr : null} hint={`${body.length}/${BODY_MAX}`} />
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <p className="mb-1.5 text-sm font-semibold">Send to</p>
              <div className="flex flex-wrap gap-2">
                {(["all", "merchants", "customers"] as const).map((a) => (
                  <Pill key={a} selected={audience === a} onClick={() => setAudience(a)}>{AUDIENCE_LABEL[a]} ({count(a)})</Pill>
                ))}
                <Pill selected={audience === "selected"} onClick={() => setAudience("selected")}>Choose people{picked.length ? ` (${picked.length})` : ""}</Pill>
              </div>
              <p className="mt-1 text-xs text-ink-3">
                {audience === "selected"
                  ? "Search by name, email or phone and tick the people to send it to."
                  : audience === "merchants"
                    ? "Accounts in Merchant mode or owning a shop. Suspended accounts are left out."
                    : audience === "customers"
                      ? "Everyone who does not sell on Localink. Suspended accounts are left out."
                      : "Every account except suspended ones."}
              </p>
            </div>

            {audience === "selected" && (
              <div className="space-y-3">
                {picked.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {users.filter((u) => picked.includes(u.id)).map((u) => (
                      <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-brand">
                        {u.name || u.email}
                        <span className="font-normal text-ink-3">· {accountType(u, owners) === "merchant" ? "Merchant" : "Customer"}</span>
                        <button type="button" onClick={() => toggle(u.id)} className="rounded-full px-1 text-ink-3 hover:bg-white hover:text-ink" aria-label={`Remove ${u.name}`}>×</button>
                      </span>
                    ))}
                    <button type="button" onClick={() => setPicked([])} className="text-xs font-semibold text-ink-3 hover:underline">Clear</button>
                  </div>
                )}
                <SearchInput placeholder="Search people by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
                {q.trim().length >= 2 && (matches.length ? <div className="space-y-2">{matches.map(personRow)}</div> : <p className="text-sm text-ink-3">Nobody matches “{q.trim()}”.</p>)}
              </div>
            )}
          </Card>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-ink-3">{reach.length} {reach.length === 1 ? "person" : "people"} will get it</p>
            <Button loading={busy} onClick={send}><Icon name="bell" className="size-4" /> Send notification</Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold">Preview</p>
            <div className="mt-3 rounded-2xl bg-ink p-3 text-white">
              <div className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-extrabold">L</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-xs text-white/60">Localink · now</span>
                  <span className="block truncate text-sm font-bold">{title.trim() || "Your title"}</span>
                  <span className="block text-sm text-white/80 [overflow-wrap:anywhere]">{body.trim() || "Your message shows here."}</span>
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-3">
              Everyone gets it in the app&apos;s Notifications. People with the app installed and notifications allowed also get it as a push message; tapping it opens their Notifications.
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold">Sent</p>
            {history.length === 0 ? (
              <div className="mt-2"><Empty title="Nothing sent yet" /></div>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {history.map((b) => (
                  <li key={b.id} className="py-2.5 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 font-semibold">{b.title}</span>
                      <Badge tone={b.status === "sent" ? "success" : b.status === "failed" ? "danger" : "warning"}>{b.status === "sent" ? `${b.recipients ?? 0} people` : b.status === "failed" ? "Failed" : "Sending"}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-ink-2">{b.body}</p>
                    <p className="text-xs text-ink-3">
                      {[AUDIENCE_LABEL[b.audience], KINDS.find((k) => k.value === b.kind)?.label, shortDate(b.createdAt), b.createdByName && `by ${b.createdByName}`, b.error].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
