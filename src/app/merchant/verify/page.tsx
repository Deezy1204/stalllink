"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { Button, Card, PageHeader, useToast } from "@/components/ui";
import { recheckKyc, startKyc } from "@/lib/money";
import { kycLabel, shortDate } from "@/lib/types";

/**
 * Shop owners verify who they are with Didit (a photo of their ID and a
 * selfie), the same check as the app's "Verify your identity". Until it
 * passes, their shops show "Not verified" and Localink cannot verify them.
 */
export default function VerifyPage() {
  const { profile, user, shops } = useMerchant();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const k = profile.kyc ?? { status: "none" as const };
  const done = k.status === "approved";

  // Coming back to this tab after Didit: ask for the latest answer.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible" && (k.status === "pending" || k.status === "inReview")) recheckKyc(user.uid).catch(() => {});
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [k.status, user.uid]);

  async function start() {
    setStarting(true);
    try {
      const r = await startKyc(user.uid);
      if (r.error || !r.url) return toast(r.error ?? "Could not start the identity check.", "error");
      window.open(r.url, "_blank", "noopener");
      toast("Didit opened in a new tab. Come back here when you are done.");
    } finally {
      setStarting(false);
    }
  }

  async function check() {
    setChecking(true);
    try {
      const r = await recheckKyc(user.uid);
      if (r.error) toast(r.error, "error");
    } finally {
      setChecking(false);
    }
  }

  const status: Record<string, string> = {
    approved: `Your identity is verified${k.updatedAt ? ` (${shortDate(k.updatedAt)})` : ""}. Localink can now verify your shops.`,
    inReview: "Didit is reviewing your documents. This usually takes a few minutes; we will tell you when it is done.",
    pending: "Started. Finish the steps on the Didit page, then come back here.",
    declined: `The check did not pass${k.reason ? `: ${k.reason}` : ""}. You can try again with a clear photo of a valid ID.`,
    expired: "The last check expired before it was finished. Start again.",
    none: "Not verified yet.",
  };
  const tone = done ? "bg-mint-100 text-mint-800" : k.status === "declined" ? "bg-red-50 text-red-800" : k.status === "none" ? "bg-surface-2 text-ink-2" : "bg-amber-50 text-amber-900";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Verify your identity" subtitle="Needed before Localink can verify your shops" />
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${done ? "bg-mint-100 text-mint-700" : "bg-brand-50 text-brand"}`}>
            <Icon name={done ? "verified" : "shieldCheck"} className="size-7" play />
          </span>
          <div>
            <p className="text-lg font-bold">{done ? "You are verified" : "Sell as a verified owner"}</p>
            <p className="mt-1 text-sm text-ink-3">
              Localink checks the identity of everyone who sells, so buyers abroad know who they are paying. Your shops get the green verified tick once your identity and the shop are
              both verified.
            </p>
          </div>
        </div>
        <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${tone}`}>
          <b className="block">{kycLabel[k.status]}</b>
          {status[k.status]}
        </div>
        {!done && (
          <>
            <ol className="mt-5 space-y-3 text-sm">
              <li><b>1. Have your ID ready.</b> A national ID, passport or driver&apos;s licence that has not expired.</li>
              <li><b>2. Take a photo of it and a selfie</b> on Didit&apos;s secure page. It takes about two minutes.</li>
              <li><b>3. Come back here.</b> {shops.length ? `${shops.map((s) => s.name).join(", ")} show` : "Your shops show"} “Not verified” until the check passes.</li>
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button loading={starting} disabled={k.status === "inReview"} onClick={start}>
                {k.status === "inReview" ? "Being reviewed" : k.status === "pending" ? "Continue verification" : k.status === "none" ? "Verify with Didit" : "Verify again"}
              </Button>
              {(k.status === "pending" || k.status === "inReview") && <Button variant="secondary" loading={checking} onClick={check}>Check again</Button>}
              <Link href="/merchant" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2">Later</Link>
            </div>
          </>
        )}
        {done && <Link href="/merchant" className="mt-6 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white">Continue</Link>}
        <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-3"><Icon name="shieldCheck" className="size-4" /> Your documents go to Didit, our identity partner. Localink keeps only the result.</p>
      </Card>
    </div>
  );
}
