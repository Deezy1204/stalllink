"use client";

import { useEffect, useState } from "react";

import { useMerchant } from "@/components/merchant/MerchantData";
import { RatingSummary, ReviewForm, ReviewItem } from "@/components/Reviews";
import { Card, Empty, PageHeader, Spinner, Tabs, useConfirm, useToast } from "@/components/ui";
import { deleteAppReview, saveAppReview, watchAppReviews } from "@/lib/reviews";
import type { ReviewDoc } from "@/lib/types";

type Filter = "all" | "merchant" | "customer";

/** Shop owners rate and review Localink itself; everyone's reviews of it are public. */
export default function RateLocalinkPage() {
  const { user, profile, appReview } = useMerchant();
  const confirm = useConfirm();
  const toast = useToast();
  const [reviews, setReviews] = useState<ReviewDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => watchAppReviews(setReviews, (e) => setError(`Could not load reviews: ${e.message}. Make sure the latest firestore.rules are deployed.`)), []);

  const all = reviews ?? [];
  const list = all.filter((r) => filter === "all" || r.role === filter);

  async function save(rating: number, comment: string) {
    await saveAppReview(user.uid, appReview ?? null, { authorName: profile.name || user.displayName || "Shop owner", rating, comment, role: "merchant" });
    toast(appReview ? "Your review is updated." : "Thank you! Your review is posted.");
  }

  async function remove() {
    if (!(await confirm({ title: "Delete your review?", message: "It is removed from Localink's reviews. You can write a new one any time.", confirm: "Delete", danger: true }))) return;
    await deleteAppReview(user.uid);
    toast("Your review is deleted.");
  }

  return (
    <>
      <PageHeader title="Rate Localink" subtitle="Tell us how Localink works for your shop. Your review is public and helps other merchants and buyers." />
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-bold">{appReview ? "Your review" : "Write a review"}</h2>
            <p className="mb-4 mt-0.5 text-sm text-ink-3">Posted as {profile.name || user.email} · shop owner</p>
            {appReview === undefined ? (
              <div className="flex justify-center py-6"><Spinner className="size-6" /></div>
            ) : (
              <>
                {appReview?.hidden && (
                  <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">An admin has hidden this review, so only you can see it. You can still edit or delete it.</p>
                )}
                <ReviewForm
                  initial={appReview}
                  onSave={save}
                  onDelete={remove}
                  placeholder="What works well? What should Localink do better for shops?"
                />
              </>
            )}
          </Card>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">What people say about Localink</h2>
              <Tabs
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: all.length },
                  { value: "merchant", label: "Shop owners", count: all.filter((r) => r.role === "merchant").length },
                  { value: "customer", label: "Buyers", count: all.filter((r) => r.role === "customer").length },
                ]}
              />
            </div>
            {reviews == null && !error ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : list.length === 0 ? (
              <Empty title="No reviews yet" message="Be the first to review Localink." />
            ) : (
              <div className="stagger space-y-3">
                {list.map((r, i) => <ReviewItem key={r.id} review={r} mine={r.authorId === user.uid} index={i} />)}
              </div>
            )}
          </section>
        </div>
        <div>
          <RatingSummary reviews={all} title="Localink" />
        </div>
      </div>
    </>
  );
}
