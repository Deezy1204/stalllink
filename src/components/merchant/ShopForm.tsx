"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { Button, Card, Input, Modal, Pill, Switch, Textarea, useToast } from "@/components/ui";
import {
  clock,
  DAY_NAMES,
  defaultWeek,
  digitsOnly,
  hoursSummary,
  MAX_GALLERY,
  newId,
  parseClock,
  PAYMENT_TYPES,
  paymentNumberHint,
  paymentNumberLabel,
  paymentSummary,
  SHOP_CATEGORIES,
  shopCategoryFor,
  ZIM_CITIES,
} from "@/lib/catalog";
import { saveShop } from "@/lib/merchant";
import { branchLimit, feePercentOf, PAYOUT_LABEL, PLAN_LABEL, planOf, takesPayments, TRIAL_DAYS } from "@/lib/plans";
import { paymentTitle, usd, type Branch, type DayHours, type PaymentOption, type ShopDoc } from "@/lib/types";
import { MapPicker, PinTile } from "./MapPicker";
import { useMerchant } from "./MerchantData";
import { PhotoSlots, usePhotoUpload } from "./Photos";

interface ShopDraft {
  shopId: string | null;
  name: string;
  stand: string;
  hall: string;
  address: string;
  phone: string;
  fee: string;
  rate: string;
  city: string;
  categories: string[];
  photo: string | null;
  gallery: string[];
  week: DayHours[];
  delivery: boolean;
  branches: Branch[];
  payments: PaymentOption[];
  lat: number | null;
  lng: number | null;
}

const draftKey = (uid: string, shopId: string | null) => `localink.draft.shop.${uid}.${shopId ?? "new"}`;

function fromShop(s: ShopDoc | null, phone: string): ShopDraft {
  return {
    shopId: s?.id ?? null,
    name: s?.name ?? "",
    stand: s?.standNo ?? "",
    hall: s?.suburb ?? "",
    address: s?.address ?? "",
    phone: s?.phone ?? phone,
    fee: (s?.deliveryFee ?? 3).toFixed(2),
    rate: String(s?.zarPerUsd ?? 18.5),
    city: s?.city || "Bulawayo",
    categories: [...(s?.categories ?? [])],
    photo: s?.bannerAsset || null,
    gallery: [...(s?.gallery ?? [])],
    week: s?.schedule?.length === 7 ? s.schedule.map((d) => ({ ...d })) : defaultWeek(),
    delivery: s?.offersDelivery === true,
    branches: (s?.branches ?? []).map((b) => ({ ...b })),
    payments: (s?.paymentOptions ?? []).map((p) => ({ ...p })),
    lat: s?.lat ?? null,
    lng: s?.lng ?? null,
  };
}

function Section({ title, subtitle, children, error }: { title: string; subtitle?: string; children: ReactNode; error?: string | null }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      <div className="mt-4">{children}</div>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </Card>
  );
}

/** Register a new shop or edit one: everything the app's shop form has, saved on this device as you type. */
export function ShopForm({ shop }: { shop: ShopDoc | null }) {
  const router = useRouter();
  const toast = useToast();
  const { user, profile, selectShop, config } = useMerchant();
  const { upload, progress } = usePhotoUpload();
  const [f, setF] = useState<ShopDraft>(() => fromShop(shop, profile.phone));
  const [restored, setRestored] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [branch, setBranch] = useState<Branch | "new" | null>(null);
  const [payment, setPayment] = useState<PaymentOption | "new" | null>(null);
  const [custom, setCustom] = useState("");
  const dirty = useRef(false);
  const front = useRef<HTMLInputElement>(null);
  const key = draftKey(user.uid, shop?.id ?? null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const d = raw ? (JSON.parse(raw) as ShopDraft) : null;
      // Only a draft for this same shop (or for a new one).
      if (d && d.shopId === (shop?.id ?? null)) {
        setF(d);
        setRestored(true);
      }
    } catch {}
  }, [key, shop?.id]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(f));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [f, key]);

  const set = (patch: Partial<ShopDraft>) => {
    dirty.current = true;
    setF((x) => ({ ...x, ...patch }));
  };

  const missing = [
    !f.photo && "a shop photo",
    !f.name.trim() && "the shop name",
    (f.lat == null || f.lng == null) && "your map pin",
    !f.categories.length && "at least one category",
    !f.week.some((d) => d.open) && "opening hours",
  ].filter(Boolean) as string[];
  const done = 5 - missing.length;
  // Only Pro and Max shops take payments themselves; others are paid through Localink.
  const plan = planOf(shop);
  const pro = takesPayments(plan);
  const feePercent = feePercentOf(plan, config);
  const maxBranches = branchLimit(plan, config.limits);
  const rate = Number(f.rate);
  const fee = Number(f.fee);
  const err = {
    name: !f.name.trim() ? "Enter your shop name" : null,
    stand: !f.stand.trim() ? "Enter your stand number" : null,
    hall: !f.hall.trim() ? "Enter the market or centre" : null,
    address: !f.address.trim() ? "Enter the street address" : null,
    phone: !f.phone.trim() ? "Enter a phone number" : digitsOnly(f.phone).length < 7 ? "Enter a valid phone number" : null,
    fee: f.delivery && (f.fee.trim() === "" || !(fee >= 0)) ? "Enter a fee (0 for free delivery)" : null,
    rate: !(rate >= 1 && rate <= 1000) ? "Enter a rate between 1 and 1000" : null,
  };
  const formOk = Object.values(err).every((e) => !e);
  const show = (e: string | null) => (showErrors ? e : null);

  function toggleCategory(label: string) {
    set({ categories: f.categories.includes(label) ? f.categories.filter((c) => c !== label) : [...f.categories, label] });
  }
  function addCustom() {
    const v = custom.trim();
    if (!v) return;
    const label = shopCategoryFor(v)?.label ?? `${v[0].toUpperCase()}${v.slice(1)}`;
    if (!f.categories.some((c) => c.toLowerCase() === label.toLowerCase())) set({ categories: [...f.categories, label] });
    setCustom("");
  }

  function setDay(day: number, patch: Partial<DayHours>) {
    set({ week: f.week.map((d) => (d.day === day ? { ...d, ...patch } : d)) });
  }
  function copyMonday(to: (d: DayHours) => boolean) {
    const m = f.week[0];
    set({ week: f.week.map((d) => (d.day === 1 || !to(d) ? d : { ...d, open: m.open, opens: m.opens, closes: m.closes })) });
  }

  async function publish() {
    setShowErrors(true);
    if (!formOk || missing.length) {
      toast(missing.length ? `Add ${missing.join(", ")}.` : "Check the highlighted fields.", "error");
      return;
    }
    const isNew = !shop;
    const base: ShopDoc = shop
      ? { ...shop }
      : { id: newId("s"), ownerId: user.uid, name: "", ownerName: (profile.name || user.displayName || "").split(" ")[0], verified: false, suspended: false };
    const next: ShopDoc = {
      ...base,
      name: f.name.trim(),
      standNo: f.stand.trim(),
      address: f.address.trim(),
      suburb: f.hall.trim(),
      city: f.city.trim() || "Bulawayo",
      categories: [...f.categories],
      bannerAsset: f.photo!,
      gallery: [...f.gallery],
      schedule: f.week.map((d) => ({ ...d })),
      paymentOptions: f.payments.map((p) => ({ ...p })),
      phone: f.phone.trim(),
      lat: f.lat,
      lng: f.lng,
      zarPerUsd: rate,
      offersDelivery: f.delivery,
      deliveryFee: f.delivery ? fee : 0,
      branches: f.branches.map((b) => ({ ...b })),
    };
    setSaving(true);
    try {
      await saveShop(user.uid, next, isNew);
      try {
        localStorage.removeItem(key);
      } catch {}
      dirty.current = false;
      if (isNew) selectShop(next.id);
      toast(isNew ? "Your shop is live! Add products next." : "Shop details updated.");
      router.push("/merchant");
    } catch (e) {
      toast(`Could not save your shop: ${(e as Error).message}. Your details are kept on this device.`, "error");
      setSaving(false);
    }
  }

  function startOver() {
    try {
      localStorage.removeItem(key);
    } catch {}
    dirty.current = false;
    setF(fromShop(shop, profile.phone));
    setRestored(false);
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{shop ? "Shop settings" : "Set up a shop"}</h1>
          <p className="text-sm text-ink-3">{shop ? "Keep your shop details up to date." : "Fill in the parts below, then publish."}</p>
        </div>
        <p className="text-lg font-extrabold text-brand">{done}/5</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(done / 5) * 100}%` }} /></div>
      <p className="mt-1.5 text-xs text-ink-3">Saved on this device as you type</p>
      {restored && (
        <p className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-mint-100 px-4 py-2.5 text-sm text-mint-800">
          We restored the details you entered last time.
          <button onClick={startOver} className="font-semibold hover:underline">Start over</button>
        </p>
      )}

      <div className="mt-5 space-y-4">
        <Section title="Shop front photo" subtitle="Helps families recognise you." error={show(!f.photo ? "Add a shop photo." : null)}>
          <button
            type="button"
            onClick={() => front.current?.click()}
            disabled={progress != null}
            className={`group relative flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl border-2 ${f.photo ? "border-transparent" : showErrors ? "border-red-400 bg-red-50" : "border-dashed border-brand/30 bg-brand-50/40"}`}
          >
            {f.photo ? (
              <>
                <img src={f.photo} alt="Shop front" className="absolute inset-0 size-full object-cover" />
                <span className="absolute bottom-3 right-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-white">Click to change</span>
              </>
            ) : (
              <span className="flex flex-col items-center gap-2 text-center text-sm font-semibold text-brand">
                {progress != null ? `Uploading… ${Math.round(progress * 100)}%` : <><Icon name="camera" className="size-9" strokeWidth={1.6} />Add a shop photo</>}
              </span>
            )}
          </button>
          <input ref={front} type="file" accept="image/*" hidden onChange={async (e) => { const url = await upload(e.target.files?.[0]); e.target.value = ""; if (url) set({ photo: url }); }} />
          <p className="mb-2 mt-5 text-sm font-semibold">More photos (optional)</p>
          <p className="mb-2 text-xs text-ink-3">Up to {MAX_GALLERY}: inside the shop, your shelves, the entrance. Buyers can swipe through and zoom in.</p>
          <PhotoSlots photos={f.gallery} max={MAX_GALLERY} onChange={(gallery) => set({ gallery })} />
        </Section>

        <Section title="Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Input label="Shop name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Green Harvest Market" error={show(err.name)} /></div>
            <Input label="Stand / shop number" value={f.stand} onChange={(e) => set({ stand: e.target.value })} placeholder="e.g. Stand #14" error={show(err.stand)} />
            <Input label="Market / trading centre" value={f.hall} onChange={(e) => set({ hall: e.target.value })} placeholder="e.g. Central Market Hall" error={show(err.hall)} />
            <div className="sm:col-span-2"><Input label="Street address" value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="e.g. Cnr 8th Ave & JMN Nkomo St" error={show(err.address)} /></div>
            <Input label="City / town" list="zim-cities" value={f.city} onChange={(e) => set({ city: e.target.value })} hint="Pick from the list or type your own" />
            <Input label="Phone / WhatsApp" type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} error={show(err.phone)} />
            <div className="sm:col-span-2"><PinTile lat={f.lat} lng={f.lng} onPick={() => setPinOpen(true)} error={showErrors} /></div>
          </div>
          <datalist id="zim-cities">{ZIM_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Section>

        <Section title="What you sell" subtitle="Pick all that apply, or add your own." error={show(!f.categories.length ? "Choose at least one category." : null)}>
          <div className="flex flex-wrap gap-2">
            {SHOP_CATEGORIES.map((c) => <Pill key={c.id} selected={f.categories.includes(c.label)} onClick={() => toggleCategory(c.label)}>{c.emoji} {c.label}</Pill>)}
            {f.categories.filter((c) => !shopCategoryFor(c)).map((c) => (
              <span key={c} className="inline-flex h-9 items-center gap-1 rounded-full bg-brand pl-3.5 pr-1.5 text-sm font-semibold text-white">
                {c}
                <button type="button" onClick={() => toggleCategory(c)} className="group rounded-full p-1 hover:bg-white/20" aria-label={`Remove ${c}`}><Icon name="x" className="size-3.5" strokeWidth={2.4} /></button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={custom}
              maxLength={30}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              placeholder="Add your own, e.g. Spices, Baby products, Hardware"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
            <Button variant="secondary" onClick={addCustom}>Add</Button>
          </div>
        </Section>

        <Section title="Opening hours" subtitle="Set each day. Turn a day off if you are closed." error={show(!f.week.some((d) => d.open) ? "Open at least one day." : null)}>
          <div className="space-y-1.5">
            {f.week.map((d) => (
              <div key={d.day} className="flex flex-wrap items-center gap-3">
                <span className={`w-10 text-sm font-bold ${d.open ? "" : "text-ink-3"}`}>{DAY_NAMES[d.day - 1]}</span>
                <Switch checked={d.open} onChange={(open) => setDay(d.day, { open })} />
                {d.open ? (
                  <span className="flex items-center gap-2">
                    <input type="time" value={clock(d.opens)} onChange={(e) => setDay(d.day, { opens: parseClock(e.target.value) })} className="h-9 rounded-lg border border-line px-2 text-sm" aria-label={`${DAY_NAMES[d.day - 1]} opens`} />
                    –
                    <input type="time" value={clock(d.closes)} onChange={(e) => setDay(d.day, { closes: parseClock(e.target.value) })} className="h-9 rounded-lg border border-line px-2 text-sm" aria-label={`${DAY_NAMES[d.day - 1]} closes`} />
                  </span>
                ) : (
                  <span className="text-sm text-ink-3">Closed</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-sm font-semibold text-brand">
            <button type="button" className="hover:underline" onClick={() => copyMonday((d) => d.day <= 5)}>Copy Monday to weekdays</button>
            <button type="button" className="hover:underline" onClick={() => copyMonday(() => true)}>Copy Monday to every day</button>
          </div>
          <p className="mt-2 text-xs text-ink-3">Buyers see: {hoursSummary(f.week) || "—"}</p>
        </Section>

        <Section
          title="How buyers pay you"
          subtitle={
            pro
              ? "Your own accounts: buyers pay you and upload proof, you confirm it. They can also pay through Localink (online or credits)."
              : "Buyers pay through Localink: online, by transfer or with credits. Localink pays your earnings out to you."
          }
        >
          {!pro && (
            <Link href={shop ? "/merchant/plan" : "#"} className="block rounded-2xl border border-accent/40 bg-accent-50 p-4 text-sm text-accent-800 hover:bg-accent/15">
              <b className="block">Take payments yourself with Pro or Max</b>
              On {PLAN_LABEL[plan]}, {feePercent > 0 ? `a ${feePercent}% service fee is added for buyers` : "there is no service fee"} and you are paid out {PAYOUT_LABEL[plan].toLowerCase()}. Pro ({usd(config.proMonthly)}/month) lets buyers pay your own accounts, with no fee and daily payouts. Try it free for {TRIAL_DAYS} days.
              {shop ? " ›" : " Publish your shop first, then choose a plan."}
            </Link>
          )}
          {!pro && f.payments.length > 0 && <p className="mb-2 mt-4 text-xs font-semibold text-ink-3">Saved for when you are on Pro or Max (buyers do not see them now):</p>}
          <div className={`space-y-2 ${pro ? "" : "opacity-60"}`}>
            {f.payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                <button type="button" className="min-w-0 flex-1 text-left" disabled={!pro} onClick={() => setPayment(p)}>
                  <span className="block text-sm font-bold">{paymentTitle(p)}</span>
                  <span className="block truncate text-xs text-ink-3">{paymentSummary(p)}</span>
                </button>
                {pro && <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setPayment(p)}>Edit</button>}
                <button type="button" className="text-sm font-semibold text-red-700 hover:underline" onClick={() => set({ payments: f.payments.filter((x) => x.id !== p.id) })}>Remove</button>
              </div>
            ))}
          </div>
          {pro && <Button variant="secondary" className="mt-3" onClick={() => setPayment("new")}>{f.payments.length ? "+ Add another payment method" : "+ Add payment method"}</Button>}
          {shop && <Link href="/merchant/earnings" className="mt-3 block text-sm font-semibold text-brand hover:underline">Where Localink pays you (payouts) ›</Link>}
        </Section>

        <Section
          title="Branches"
          subtitle={`Other places customers can collect from (optional). ${
            maxBranches == null ? `${PLAN_LABEL[plan]} shows buyers all of them.` : maxBranches === 0 ? `Buyers see branches from Standard up; they are kept on ${PLAN_LABEL[plan]}.` : `${PLAN_LABEL[plan]} shows buyers ${maxBranches} branch${maxBranches === 1 ? "" : "es"}.`
          }`}
        >
          <div className="space-y-2">
            {f.branches.map((b, bi) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setBranch(b)}>
                  <span className="block text-sm font-bold">{b.name}</span>
                  <span className="block truncate text-xs text-ink-3">{[b.standNo, b.address].filter(Boolean).join(" • ")}, {b.suburb}{b.lat != null ? " · pinned" : ""}</span>
                  {maxBranches != null && bi >= maxBranches && <span className="block text-xs font-semibold text-accent-800">Hidden from buyers on {PLAN_LABEL[plan]} (kept)</span>}
                </button>
                <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setBranch(b)}>Edit</button>
                <button type="button" className="text-sm font-semibold text-red-700 hover:underline" onClick={() => set({ branches: f.branches.filter((x) => x.id !== b.id) })}>Remove</button>
              </div>
            ))}
          </div>
          <Button variant="secondary" className="mt-3" onClick={() => setBranch("new")}>+ Add branch</Button>
        </Section>

        <Section title="Delivery & currency">
          <Switch checked={f.delivery} onChange={(delivery) => set({ delivery })} label="Local delivery" description="Deliver orders to the recipient for a fee you set" />
          {f.delivery && (
            <div className="mt-3 max-w-xs">
              <Input label="Delivery fee (USD)" prefix="$" inputMode="decimal" value={f.fee} onChange={(e) => set({ fee: e.target.value })} hint="Customers pay this when they choose delivery" error={show(err.fee)} />
            </div>
          )}
          <div className="mt-4 max-w-xs">
            <Input label="Your rate: Rands per $1" prefix="R" inputMode="decimal" value={f.rate} onChange={(e) => set({ rate: e.target.value })} hint="Customers who view prices in Rands see this rate. Default is 18.5." error={show(err.rate)} />
          </div>
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <p className="hidden flex-1 text-sm text-ink-3 sm:block">{missing.length ? `Still needed: ${missing.join(", ")}` : "Everything is filled in."}</p>
          <Button className="w-full sm:w-auto" loading={saving} onClick={publish}>{shop ? "Save changes" : "Publish shop"}</Button>
        </div>
      </div>

      <MapPicker
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        city={f.city}
        initial={f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null}
        searchHint={[f.hall.trim(), f.address.trim()].filter(Boolean).join(", ")}
        onPick={(p) => {
          set({ lat: p.lat, lng: p.lng });
          setPinOpen(false);
        }}
      />
      {payment && (
        <PaymentForm
          existing={payment === "new" ? null : payment}
          defaultAccountName={f.name.trim()}
          onClose={() => setPayment(null)}
          onSave={(p) => {
            set({ payments: f.payments.some((x) => x.id === p.id) ? f.payments.map((x) => (x.id === p.id ? p : x)) : [...f.payments, p] });
            setPayment(null);
          }}
        />
      )}
      {branch && (
        <BranchForm
          existing={branch === "new" ? null : branch}
          city={f.city}
          phone={f.phone.trim()}
          hours={hoursSummary(f.week)}
          onClose={() => setBranch(null)}
          onSave={(b) => {
            set({ branches: f.branches.some((x) => x.id === b.id) ? f.branches.map((x) => (x.id === b.id ? b : x)) : [...f.branches, b] });
            setBranch(null);
          }}
        />
      )}
    </div>
  );
}

/** Payment details: a Pro shop's account buyers pay into, or with [payout] where Localink pays the shop. */
export function PaymentForm({
  existing,
  defaultAccountName,
  onClose,
  onSave,
  payout = false,
}: {
  existing: PaymentOption | null;
  defaultAccountName: string;
  onClose: () => void;
  onSave: (p: PaymentOption) => void;
  payout?: boolean;
}) {
  const [type, setType] = useState<PaymentOption["type"]>(existing?.type ?? "ecocash");
  const [name, setName] = useState(existing?.name ?? "");
  const [accountName, setAccountName] = useState(existing?.accountName ?? defaultAccountName);
  const [number, setNumber] = useState(existing?.accountNumber ?? "");
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [tried, setTried] = useState(false);
  const needsName = type === "bank" || type === "other";
  const err = { name: needsName && !name.trim() ? "Enter the name" : null, accountName: !accountName.trim() ? "Enter the account name" : null, number: !number.trim() ? (payout ? "Enter the account number" : "Enter the number buyers pay to") : null };

  function save() {
    setTried(true);
    if (Object.values(err).some(Boolean)) return;
    onSave({ id: existing?.id ?? newId("pay"), type, name: name.trim(), accountName: accountName.trim(), accountNumber: number.trim(), instructions: instructions.trim() });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={payout ? "Where Localink pays you" : existing ? "Edit payment method" : "Add payment method"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{payout ? "Save payout account" : "Save payment method"}</Button></>}
    >
      <p className="mb-3 text-sm text-ink-3">{payout ? "Localink sends your earnings to this account. Only you and Localink see it." : "Buyers see these details at checkout and pay you directly."}</p>
      <p className="mb-2 text-sm font-semibold">Type</p>
      <div className="mb-4 flex flex-wrap gap-2">{PAYMENT_TYPES.map((t) => <Pill key={t.id} selected={type === t.id} onClick={() => setType(t.id)}>{t.label}</Pill>)}</div>
      <div className="space-y-3">
        {needsName && (
          <Input
            label={type === "bank" ? "Bank name" : "Payment service name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "bank" ? "e.g. CBZ, Steward Bank, CABS" : "e.g. WorldRemit, Paynow, Cash at the shop"}
            error={tried ? err.name : null}
          />
        )}
        <Input label="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder={payout ? "Name on the account" : "Name buyers will see when paying"} error={tried ? err.accountName : null} />
        <Input label={paymentNumberLabel(type)} value={number} onChange={(e) => setNumber(e.target.value)} placeholder={paymentNumberHint(type)} error={tried ? err.number : null} />
        <Textarea label="Instructions (optional)" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Use your order number as the reference" />
      </div>
    </Modal>
  );
}

function BranchForm({ existing, city, phone, hours, onClose, onSave }: { existing: Branch | null; city: string; phone: string; hours: string; onClose: () => void; onSave: (b: Branch) => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [stand, setStand] = useState(existing?.standNo ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [suburb, setSuburb] = useState(existing?.suburb ?? "");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(existing?.lat != null && existing?.lng != null ? { lat: existing.lat, lng: existing.lng } : null);
  const [map, setMap] = useState(false);
  const [tried, setTried] = useState(false);
  const err = { name: !name.trim() ? "Give the branch a name" : null, address: !address.trim() ? "Enter the address" : null };

  function save() {
    setTried(true);
    if (err.name || err.address || !pin) return;
    onSave({ ...(existing ?? {}), id: existing?.id ?? newId("b"), name: name.trim(), standNo: stand.trim(), address: address.trim(), suburb: suburb.trim(), city, hours, phone, lat: pin.lat, lng: pin.lng });
  }

  return (
    <>
      <Modal
        open={!map}
        onClose={onClose}
        title={existing ? "Edit branch" : "Add branch"}
        footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{existing ? "Save branch" : "Add branch"}</Button></>}
      >
        <p className="mb-3 text-sm text-ink-3">Another place where customers can collect their orders.</p>
        <div className="space-y-3">
          <Input label="Branch name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Luveve branch" error={tried ? err.name : null} />
          <Input label="Stand / shop number" value={stand} onChange={(e) => setStand(e.target.value)} placeholder="e.g. Shop 3" />
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Luveve Shopping Centre" error={tried ? err.address : null} />
          <Input label="Suburb" value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="e.g. Luveve" />
          <PinTile lat={pin?.lat} lng={pin?.lng} onPick={() => setMap(true)} error={tried && !pin} />
          {tried && !pin && <p className="text-sm text-red-700">Pin the branch on the map so customers can get directions.</p>}
        </div>
      </Modal>
      <MapPicker
        open={map}
        onClose={() => setMap(false)}
        title="Pin the branch"
        city={city}
        initial={pin}
        searchHint={[address.trim(), suburb.trim()].filter(Boolean).join(", ")}
        onPick={(p) => {
          setPin(p);
          setMap(false);
        }}
      />
    </>
  );
}
