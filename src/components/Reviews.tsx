"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { Badge, Button, Card, Textarea } from "@/components/ui";
import { MAX_COMMENT, ratingWord, roleLabel, summarize } from "@/lib/reviews";
import { shortDate, type ReviewDoc } from "@/lib/types";

const STAR = "M12 2.6l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.16l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z";

/** Five stars filled up to [value] (fractions show part of a star). */
export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden>
            <defs>
              <clipPath id={`${id}-${i}`}>
                <rect width={24 * fill} height="24" />
              </clipPath>
            </defs>
            <path d={STAR} fill="#DCE5E1" />
            <path d={STAR} fill="#E69A27" clipPath={`url(#${id}-${i})`} />
          </svg>
        );
      })}
    </span>
  );
}

/** "★ 4.6 (12)" for lists, or "New" when nobody has rated it yet. */
export function RatingChip({ rating, count }: { rating?: number; count?: number }) {
  if (!count) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3"><Stars value={0} className="size-3.5" /> No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2">
      <Stars value={rating ?? 0} className="size-3.5" />
      {(rating ?? 0).toFixed(1)} <span className="font-normal text-ink-3">({count})</span>
    </span>
  );
}

/** Pick 1–5 stars; arrow keys move between them. */
export function StarInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Your rating" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}, ${ratingWord(n)}`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(5, (value || 0) + 1) : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(1, (value || 2) - 1) : 0;
              if (!next) return;
              e.preventDefault();
              onChange(next);
              (e.currentTarget.parentElement?.children[next - 1] as HTMLElement | undefined)?.focus();
            }}
            className="rounded-lg p-1 outline-none transition hover:scale-110 focus-visible:ring-4 focus-visible:ring-brand/20 active:scale-95 disabled:pointer-events-none"
          >
            <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
              <path d={STAR} fill={n <= shown ? "#E69A27" : "#DCE5E1"} className="transition-colors" />
            </svg>
          </button>
        ))}
      </div>
      <span className="min-w-20 text-sm font-semibold text-ink-2">{shown ? ratingWord(shown) : "Tap a star"}</span>
    </div>
  );
}

/** The average, how many reviews, and a bar per star. */
export function RatingSummary({ reviews, title, empty }: { reviews: ReviewDoc[]; title?: string; empty?: string }) {
  const s = summarize(reviews);
  return (
    <Card className="p-5">
      {title && <p className="mb-3 text-sm font-semibold text-ink-3">{title}</p>}
      <div className="flex flex-wrap items-center gap-6">
        <div className="text-center">
          <p className="text-4xl font-extrabold tracking-tight">{s.count ? s.average.toFixed(1) : "–"}</p>
          <Stars value={s.average} />
          <p className="mt-1 text-xs text-ink-3">{s.count ? `${s.count} review${s.count === 1 ? "" : "s"}` : (empty ?? "No reviews yet")}</p>
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((n) => {
            const k = s.stars[n - 1];
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right font-semibold text-ink-2">{n}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${s.count ? (k / s.count) * 100 : 0}%` }} />
                </span>
                <span className="w-6 text-ink-3">{k}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/** One review: who, how many stars, when, and what they said. */
export function ReviewItem({ review, about, mine, actions, index }: { review: ReviewDoc; about?: ReactNode; mine?: boolean; actions?: ReactNode; index?: number }) {
  const r = review;
  const role = roleLabel(r);
  return (
    <Card index={index} className={`p-4 ${r.hidden ? "border-dashed bg-surface" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand">{(r.authorName || "?")[0].toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold">{r.authorName || "Someone"}</p>
            {mine && <Badge tone="brand">You</Badge>}
            {role && <Badge>{role}</Badge>}
            {r.verifiedOrder && <Badge tone="success">Ordered here</Badge>}
            {r.hidden && <Badge tone="danger">Hidden</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <Stars value={r.rating} className="size-3.5" />
            <span>{shortDate(r.updatedAt || r.createdAt)}{r.updatedAt - r.createdAt > 60_000 ? " · edited" : ""}</span>
            {about}
          </div>
          {r.comment && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-2">{r.comment}</p>}
        </div>
      </div>
      {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">{actions}</div>}
    </Card>
  );
}

/** Rating + comment, for a new review or editing your own. */
export function ReviewForm({
  initial,
  onSave,
  onDelete,
  saveLabel = "Post review",
  placeholder,
}: {
  initial: ReviewDoc | null;
  onSave: (rating: number, comment: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  saveLabel?: string;
  placeholder?: string;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The saved review arrives (or changes on another device) after the form opened.
  useEffect(() => {
    setRating(initial?.rating ?? 0);
    setComment(initial?.comment ?? "");
  }, [initial?.rating, initial?.comment]);

  const dirty = !initial || rating !== initial.rating || comment.trim() !== initial.comment;

  async function run(kind: "save" | "delete", fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(`That did not work: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("Choose from 1 to 5 stars.");
        run("save", () => onSave(rating, comment));
      }}
    >
      <StarInput value={rating} onChange={(v) => { setRating(v); setError(null); }} disabled={busy != null} />
      <Textarea
        label="Your review (optional)"
        value={comment}
        maxLength={MAX_COMMENT}
        onChange={(e) => setComment(e.target.value)}
        placeholder={placeholder}
        hint={`${comment.length}/${MAX_COMMENT} · Reviews are public and show your name.`}
        disabled={busy != null}
      />
      {error && <p className="animate-fade-in rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy === "save"} disabled={!dirty || busy != null}>{initial ? "Update review" : saveLabel}</Button>
        {initial && onDelete && (
          <Button type="button" variant="danger" loading={busy === "delete"} disabled={busy != null} onClick={() => run("delete", onDelete)}>Delete review</Button>
        )}
      </div>
    </form>
  );
}
