"use client";

import { useMemo, useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { Icon } from "@/components/icons";
import { LocationList, LocationsMap, shopPlaces } from "@/components/Locations";
import { Badge, Button, Card, Empty, Modal, PageHeader, SearchInput, Tabs, useConfirm, useToast } from "@/components/ui";
import { deleteShop, setShopFlags } from "@/lib/data";
import { orderTotal, paymentTitle, shopCategories, usd, type ShopDoc } from "@/lib/types";

type Filter = "all" | "verify" | "verified" | "suspended";

const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default function ShopsPage() {
  const { shops, users, orders } = useAdminData();
  const confirm = useConfirm();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<ShopDoc | null>(null);

  const owner = (s: ShopDoc) => users.find((u) => u.id === s.ownerId);
  const sales = (s: ShopDoc) => orders.filter((o) => o.stallId === s.id && o.status !== "cancelled");

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return shops
      .filter((s) => {
        if (filter === "verify" && (s.verified || s.suspended)) return false;
        if (filter === "verified" && !s.verified) return false;
        if (filter === "suspended" && !s.suspended) return false;
        const o = users.find((u) => u.id === s.ownerId);
        const branches = (s.branches ?? []).map((b) => `${b.name} ${b.suburb} ${b.city} ${b.address}`).join(" ");
        return !text || `${s.name} ${s.city} ${s.suburb} ${s.ownerName} ${o?.email} ${s.phone} ${branches}`.toLowerCase().includes(text);
      })
      .sort((a, b) => Number(a.verified) - Number(b.verified) || a.name.localeCompare(b.name));
  }, [shops, users, q, filter]);

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  const toggleVerify = (s: ShopDoc) => act(s.id, () => setShopFlags(s.id, { verified: !s.verified }), s.verified ? "Verification removed." : `${s.name} is verified.`);
  const toggleSuspend = async (s: ShopDoc) => {
    if (!s.suspended && !(await confirm({ title: `Suspend ${s.name}?`, message: "Buyers will not see this shop until you restore it.", confirm: "Suspend", danger: true }))) return;
    act(s.id, () => setShopFlags(s.id, { suspended: !s.suspended }), s.suspended ? "Shop restored." : "Shop suspended.");
  };
  const remove = async (s: ShopDoc) => {
    if (!(await confirm({ title: `Delete ${s.name}?`, message: "This removes the shop and its products for good. Past orders stay in the records.", confirm: "Delete", danger: true }))) return;
    setOpen(null);
    act(s.id, () => deleteShop(s.id), "Shop deleted.");
  };

  return (
    <>
      <PageHeader title="Shops" subtitle="Verify new shops, pause shops that break the rules." />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <SearchInput placeholder="Search name, city, owner, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: shops.length },
            { value: "verify", label: "To verify", count: shops.filter((s) => !s.verified && !s.suspended).length },
            { value: "verified", label: "Verified" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Empty title="No shops match" message="Try another search or filter." />
      ) : (
        <div className="stagger grid gap-3 md:grid-cols-2">
          {list.map((s, i) => {
            const o = owner(s);
            const total = sales(s).reduce((a, x) => a + orderTotal(x), 0);
            return (
              <Card key={s.id} index={i} className="p-4">
                <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(s)}>
                  {s.bannerAsset?.startsWith("http") ? (
                    <img src={s.bannerAsset} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold text-brand">{s.name[0]}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.name}</p>
                    <p className="truncate text-sm text-ink-3">{[s.standNo, s.suburb, s.city].filter(Boolean).join(" · ")}</p>
                    <p className="truncate text-sm text-ink-3">{o?.name || s.ownerName} {o?.email && `· ${o.email}`}</p>
                  </div>
                </button>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={s.verified ? "success" : "warning"}>{s.verified ? "Verified" : "Not verified"}</Badge>
                  {s.suspended && <Badge tone="danger">Suspended</Badge>}
                  <Badge>{s.products?.length ?? 0} products</Badge>
                  {!!s.branches?.length && (
                    <Badge tone="brand">
                      <Icon name="store" className="size-3.5" strokeWidth={2} /> {s.branches.length + 1} locations
                    </Badge>
                  )}
                  <Badge>{sales(s).length} orders · {usd(total)}</Badge>
                  <Badge tone={s.paymentOptions?.length ? "neutral" : "danger"}>{s.paymentOptions?.length ?? 0} payment methods</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button variant={s.verified ? "secondary" : "primary"} loading={busy === s.id} onClick={() => toggleVerify(s)}>{s.verified ? "Unverify" : "Verify"}</Button>
                  <Button variant="secondary" disabled={busy === s.id} onClick={() => toggleSuspend(s)}>{s.suspended ? "Restore" : "Suspend"}</Button>
                  <Button variant="ghost" onClick={() => setOpen(s)}>Details</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open != null}
        onClose={() => setOpen(null)}
        title={open?.name ?? ""}
        wide
        footer={open && <Button variant="danger" onClick={() => remove(open)}>Delete shop</Button>}
      >
        {open && (
          <div className="space-y-5 text-sm">
            {(() => {
              const photos = [open.bannerAsset, ...(open.gallery ?? [])].filter((u): u is string => !!u?.startsWith("http"));
              return photos.length > 0 && (
                <section>
                  <p className="font-semibold">Photos ({photos.length})</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {photos.map((u, i) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line" title={i === 0 ? "Front photo" : `Photo ${i + 1}`}>
                        <img src={u} alt={i === 0 ? "Front photo" : `Shop photo ${i + 1}`} className="aspect-square w-full object-cover transition hover:scale-105" />
                      </a>
                    ))}
                  </div>
                </section>
              );
            })()}
            <section>
              {(() => {
                const places = shopPlaces(open);
                return (
                  <>
                    <p className="font-semibold">
                      {places.length === 1 ? "Location" : `Locations (${places.length}): main shop and ${places.length - 1} branch${places.length === 2 ? "" : "es"}`}
                    </p>
                    <p className="mb-2 text-xs text-ink-3">Where buyers’ orders can be collected. {open.country ? `${open.country}.` : ""}</p>
                    <LocationsMap places={places} className="mb-3 h-56" />
                    <LocationList places={places} shopName={open.name} />
                  </>
                );
              })()}
            </section>
            <section>
              <p className="font-semibold">Categories</p>
              <div className="mt-1 flex flex-wrap gap-1.5">{shopCategories(open).map((c) => <Badge key={c} tone="brand">{c}</Badge>)}</div>
            </section>
            <section>
              <p className="font-semibold">How buyers pay</p>
              {open.paymentOptions?.length ? (
                <ul className="mt-1 space-y-1">
                  {open.paymentOptions.map((p) => (
                    <li key={p.id} className="rounded-lg bg-surface px-3 py-2">
                      <b>{paymentTitle(p)}</b> · {p.accountNumber} {p.accountName && `· ${p.accountName}`}
                      {p.instructions && <p className="text-xs text-ink-3">{p.instructions}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-red-700">No payment details yet: buyers cannot order.</p>
              )}
            </section>
            <section>
              <p className="font-semibold">Opening hours</p>
              {open.schedule?.length ? (
                <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5">
                  {[...open.schedule].sort((a, b) => a.day - b.day).map((d) => (
                    <p key={d.day} className="flex justify-between"><span>{day[d.day - 1]}</span><span className="text-ink-2">{d.open ? `${clock(d.opens)}–${clock(d.closes)}` : "Closed"}</span></p>
                  ))}
                </div>
              ) : (
                <p className="text-ink-2">{open.hours || "—"}</p>
              )}
            </section>
            <section>
              <p className="font-semibold">Products ({open.products?.length ?? 0})</p>
              <ul className="mt-1 divide-y divide-line">
                {(open.products ?? []).slice(0, 30).map((p) => (
                  <li key={p.id} className="flex justify-between py-1.5"><span>{p.name}{p.available === false && <span className="text-ink-3"> (hidden)</span>}</span><span className="text-ink-2">{usd(p.price)} · {p.stock} in stock</span></li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
