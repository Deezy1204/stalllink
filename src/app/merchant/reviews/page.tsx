"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { RatingSummary, ReviewItem } from "@/components/Reviews";
import { Empty, PageHeader, Spinner, Tabs } from "@/components/ui";
import { watchShopReviews } from "@/lib/reviews";
import type { ReviewDoc } from "@/lib/types";

type Filter = "all" | "comments" | "low";

/** What buyers say about the active shop. Reviews are public; owners cannot review their own shop. */
export default function ShopReviewsPage() {
  const { shop, loaded } = useMerchant();
  const [reviews, setReviews] = useState<ReviewDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const shopId = shop?.id;
  useEffect(() => {
    if (!shopId) return;
    setReviews(null);
    setError(null);
    return watchShopReviews(shopId, setReviews, (e) => setError(`Could not load reviews: ${e.message}. Make sure the latest firestore.rules are deployed.`));
  }, [shopId]);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="collect reviews from buyers" />;

  const all = reviews ?? [];
  const list = all.filter((r) => (filter === "comments" ? r.comment.trim() !== "" : filter === "low" ? r.rating <= 2 : true));

  return (
    <>
      <PageHeader title="Reviews" subtitle={`What buyers say about ${shop.name}. Reviews are public on Localink.`} />
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {reviews == null && !error ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="order-2 lg:order-1">
            <div className="mb-4">
              <Tabs
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: all.length },
                  { value: "comments", label: "With comments", count: all.filter((r) => r.comment.trim()).length },
                  { value: "low", label: "1–2 stars", count: all.filter((r) => r.rating <= 2).length },
                ]}
              />
            </div>
            {list.length === 0 ? (
              <Empty
                title={all.length ? "Nothing in this view" : "No reviews yet"}
                message={all.length ? "Try another filter." : "Buyers can rate your shop in the Localink app, for example after they collect an order."}
              />
            ) : (
              <div className="stagger space-y-3">
                {list.map((r, i) => <ReviewItem key={r.id} review={r} index={i} />)}
              </div>
            )}
          </div>
          <div className="order-1 space-y-3 lg:order-2">
            <RatingSummary reviews={all} title={shop.name} />
            <p className="px-1 text-xs text-ink-3">
              Every signed-in buyer can leave one review per shop and change it later. <b>Ordered here</b> marks people who collected an order at your shop.
              Something abusive? Contact Localink support and an admin can hide it.
            </p>
            <Link href="/merchant/feedback" className="group block rounded-2xl border border-line bg-white p-4 text-sm transition hover:bg-surface">
              <span className="font-semibold">How is Localink working for you?</span>
              <span className="mt-0.5 block text-ink-3">Rate and review Localink itself ›</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
