"use client";

import { useState } from "react";

import { useAdminData } from "@/components/AdminData";
import { RatingSummary, ReviewItem } from "@/components/Reviews";
import { Button, Empty, PageHeader, SearchInput, Select, Tabs, useConfirm, useToast } from "@/components/ui";
import { deleteReview, setReviewHidden } from "@/lib/data";
import type { ReviewDoc } from "@/lib/types";

type Kind = "shops" | "localink";
type Filter = "all" | "low" | "hidden";

/** Every review of a shop or of Localink. Admins hide abusive ones (they leave public lists and ratings) or delete them. */
export default function ReviewsPage() {
  const { shopReviews, appReviews, shops, loaded } = useAdminData();
  const confirm = useConfirm();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("shops");
  const [filter, setFilter] = useState<Filter>("all");
  const [shopId, setShopId] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const shopName = (id?: string) => shops.find((s) => s.id === id)?.name ?? "Removed shop";
  const source = kind === "shops" ? shopReviews.filter((r) => !shopId || r.shopId === shopId) : appReviews;

  const text = q.trim().toLowerCase();
  const list = source.filter((r) => {
    if (filter === "low" && (r.hidden || r.rating > 2)) return false;
    if (filter === "hidden" && !r.hidden) return false;
    return !text || `${r.authorName} ${r.comment} ${r.shopId ? shopName(r.shopId) : ""}`.toLowerCase().includes(text);
  });

  async function act(r: ReviewDoc, fn: () => Promise<unknown>, ok: string) {
    setBusy(r.id);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(`That did not work: ${(e as Error).message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  const toggleHidden = (r: ReviewDoc) =>
    act(r, () => setReviewHidden(r, !r.hidden), r.hidden ? "The review is public again." : "The review is hidden from everyone but its author.");
  const remove = async (r: ReviewDoc) => {
    if (!(await confirm({ title: "Delete this review?", message: `${r.authorName || "The author"}'s review is removed for good. They can write a new one; hiding keeps it from coming back.`, confirm: "Delete", danger: true }))) return;
    act(r, () => deleteReview(r), "Review deleted.");
  };

  const ratedShops = shops.filter((s) => shopReviews.some((r) => r.shopId === s.id)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title="Reviews" subtitle="Ratings of shops and of Localink. Reviews are public; hide the abusive ones." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={kind}
          onChange={(k) => { setKind(k); setFilter("all"); }}
          options={[
            { value: "shops", label: "Shops", count: shopReviews.length },
            { value: "localink", label: "Localink", count: appReviews.length },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-2 lg:order-1">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <SearchInput placeholder={kind === "shops" ? "Search author, shop, comment…" : "Search author, comment…"} value={q} onChange={(e) => setQ(e.target.value)} />
            <Tabs
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: source.length },
                { value: "low", label: "1–2 stars", count: source.filter((r) => !r.hidden && r.rating <= 2).length },
                { value: "hidden", label: "Hidden", count: source.filter((r) => r.hidden).length },
              ]}
            />
          </div>
          {!loaded ? (
            <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />)}</div>
          ) : list.length === 0 ? (
            <Empty title="No reviews here" message={kind === "shops" ? "Buyers rate shops in the app." : "Buyers rate Localink in the app; shop owners in the merchant console."} />
          ) : (
            <div className="stagger space-y-3">
              {list.map((r, i) => (
                <ReviewItem
                  key={r.id}
                  review={r}
                  index={i}
                  about={r.shopId && <span className="font-semibold text-ink-2">· {shopName(r.shopId)}</span>}
                  actions={
                    <>
                      <Button variant="secondary" loading={busy === r.id} onClick={() => toggleHidden(r)}>{r.hidden ? "Show again" : "Hide"}</Button>
                      <Button variant="ghost" disabled={busy === r.id} onClick={() => remove(r)}>Delete</Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
        <div className="order-1 space-y-3 lg:order-2">
          {kind === "shops" && (
            <Select label="Shop" value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">All shops</option>
              {ratedShops.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {(s.rating ?? 0).toFixed(1)}★ ({s.reviewCount ?? 0})</option>
              ))}
            </Select>
          )}
          <RatingSummary
            reviews={source.filter((r) => !r.hidden)}
            title={kind === "localink" ? "Localink" : shopId ? shopName(shopId) : "All shops"}
          />
          <p className="px-1 text-xs text-ink-3">Hidden reviews are not counted. Shop ratings update a few seconds after a change.</p>
        </div>
      </div>
    </>
  );
}
