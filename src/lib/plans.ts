// Shop plans, free trials and Localink's own discounts for big buyers, the
// same rules as the app (Localink/lib/data/models.dart) and the Cloud
// Functions (Localink/functions/src/plans.ts). Prices, the Basic / Standard
// fees and the product / branch limits are admin settings (`config/payments`);
// the rest of what each plan includes is fixed here.
//
// Nothing a shop sets up is deleted when its plan ends: products over the
// limit, extra branches, bulk prices, the shop offer and its own payment
// accounts are kept and only hidden from buyers until it upgrades again.

import { cents, type PaymentsConfig, type PlanLimit, type Product, type ShopDoc } from "./types";

export type Plan = "basic" | "standard" | "pro" | "max";
export const PLANS: Plan[] = ["basic", "standard", "pro", "max"];
export const PAID_PLANS: Plan[] = ["standard", "pro", "max"];
export const RANK: Record<Plan, number> = { basic: 0, standard: 1, pro: 2, max: 3 };
export const PLAN_LABEL: Record<Plan, string> = { basic: "Basic", standard: "Standard", pro: "Pro", max: "Max" };
export const PLAN_TAGLINE: Record<Plan, string> = {
  basic: "Start selling for free",
  standard: "Lower fee, more products, shop offers",
  pro: "Take payments yourself, no fee",
  max: "For buying and selling in bulk",
};

export const PLAN_DAYS = 30;
export const TRIAL_DAYS = 7;
export const TRIAL_ORDERS = 10;

export const isPaidPlan = (v: unknown): v is Plan => v === "standard" || v === "pro" || v === "max";

/** Buyers may pay the shop's own accounts (otherwise only Localink). */
export const takesPayments = (p: Plan) => p === "pro" || p === "max";
export type Limits = PaymentsConfig["limits"];

/** Used until an admin sets others (same as PlanLimits.defaults in the app). */
export const DEFAULT_LIMITS: Record<Plan, PlanLimit> = {
  basic: { products: 20, branches: 0 },
  standard: { products: 100, branches: 2 },
  pro: { products: null, branches: 5 },
  max: { products: null, branches: null },
};

/** Most products buyers see (null = no limit). */
export const productLimit = (p: Plan, limits: Limits): number | null => (limits[p] ?? DEFAULT_LIMITS[p]).products;
/** Most extra collection points besides the main shop (null = no limit). */
export const branchLimit = (p: Plan, limits: Limits): number | null => (limits[p] ?? DEFAULT_LIMITS[p]).branches;
export const shopOffers = (p: Plan) => p !== "basic";
export const bulkPrices = (p: Plan) => p === "max";
/** Weekdays (1 = Monday) with payouts; empty = every day. */
export const payoutDays = (p: Plan): number[] => ({ basic: [1], standard: [1, 4], pro: [], max: [] })[p];
export const PAYOUT_LABEL: Record<Plan, string> = { basic: "Weekly, on Mondays", standard: "Mondays and Thursdays", pro: "Daily", max: "Daily" };

export const priceOf = (p: Plan, c: PaymentsConfig) => ({ basic: 0, standard: c.standardMonthly, pro: c.proMonthly, max: c.maxMonthly })[p];
export const feePercentOf = (p: Plan, c: PaymentsConfig) => ({ basic: c.serviceFeePercent, standard: c.standardFeePercent, pro: 0, max: 0 })[p];

type PlanFields = Pick<ShopDoc, "plan" | "planUntil" | "proUntil" | "trial" | "trialsUsed">;

/** The plan paid for at [at] (Basic when none). */
export function paidPlan(s?: PlanFields | null, at = Date.now()): Plan {
  if (isPaidPlan(s?.plan) && (s?.planUntil ?? 0) > at) return s!.plan as Plan;
  if ((s?.proUntil ?? 0) > at) return "pro";
  return "basic";
}

/** When the paid plan ends (null on Basic). */
export function paidUntil(s?: PlanFields | null, at = Date.now()): number | null {
  if (isPaidPlan(s?.plan) && (s?.planUntil ?? 0) > at) return s!.planUntil!;
  return (s?.proUntil ?? 0) > at ? s!.proUntil! : null;
}

/** The paid plan that ran out (to offer renewing it), or null. */
export function lapsedPlan(s?: PlanFields | null, at = Date.now()): Plan | null {
  if (paidPlan(s, at) !== "basic") return null;
  if (isPaidPlan(s?.plan) && s?.planUntil) return s.plan as Plan;
  return s?.proUntil ? "pro" : null;
}

/** A trial of a plan above the paid one, running at [at]. */
export function activeTrial(s?: PlanFields | null, at = Date.now()) {
  const t = s?.trial;
  if (!t || !isPaidPlan(t.plan) || t.endedAt || t.endsAt <= at || t.orders >= (t.maxOrders || TRIAL_ORDERS)) return null;
  return RANK[t.plan as Plan] > RANK[paidPlan(s, at)] ? { ...t, plan: t.plan as Plan } : null;
}

/** What the shop gets right now: its paid plan, or the plan it is trying. */
export const planOf = (s?: PlanFields | null, at = Date.now()): Plan => activeTrial(s, at)?.plan ?? paidPlan(s, at);

/** May start a free trial of [p]: above the paid plan, not tried before, no other trial running. */
export const canTrial = (s: PlanFields, p: Plan) => isPaidPlan(p) && RANK[p] > RANK[paidPlan(s)] && !(s.trialsUsed ?? []).includes(p) && !activeTrial(s);

/** "Pro", "Pro trial". */
export const planName = (s?: PlanFields | null) => `${PLAN_LABEL[planOf(s)]}${activeTrial(s) ? " trial" : ""}`;

/** Available products buyers see, and those kept but hidden by the plan's limit. */
export function listedProducts(s: ShopDoc, limits: Limits): { listed: Product[]; hidden: Product[] } {
  const live = (s.products ?? []).filter((p) => p.available !== false);
  const limit = productLimit(planOf(s), limits);
  return limit == null || live.length <= limit ? { listed: live, hidden: [] } : { listed: live.slice(0, limit), hidden: live.slice(limit) };
}

const hasBulk = (p: Product) => (p.variations ?? []).some((v) => (v.bulk ?? []).length > 0);

/** What the shop set up that buyers do not see on its plan (all kept). */
export function hiddenByPlan(s: ShopDoc, limits: Limits) {
  const plan = planOf(s);
  const limit = branchLimit(plan, limits);
  const promo = s.promo;
  return {
    products: listedProducts(s, limits).hidden.length,
    branches: limit == null ? 0 : Math.max((s.branches ?? []).length - limit, 0),
    bulk: !bulkPrices(plan) && (s.products ?? []).some(hasBulk),
    offer: !shopOffers(plan) && !!promo && promo.percent > 0 && (promo.endsAt == null || promo.endsAt > Date.now()),
    payments: !takesPayments(plan) && (s.paymentOptions ?? []).length > 0,
  };
}

export function hiddenSummary(s: ShopDoc, limits: Limits): string | null {
  const h = hiddenByPlan(s, limits);
  const parts = [
    h.products && `${h.products} product${h.products === 1 ? "" : "s"}`,
    h.branches && `${h.branches} branch${h.branches === 1 ? "" : "es"}`,
    h.bulk && "bulk prices",
    h.offer && "your shop offer",
    h.payments && "your own payment accounts",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** What [plan] includes, with Localink's prices (same list as the app's Plans screen). */
export function planFeatures(plan: Plan, c: PaymentsConfig) {
  const lim = (n: number | null, unit: string) => (n == null ? "Unlimited" : n === 0 ? "None" : `Up to ${n} ${unit}`);
  const fee = feePercentOf(plan, c);
  const branches = branchLimit(plan, c.limits);
  return [
    { title: "Service fee on your orders", value: fee > 0 ? `${fee}% added to what buyers pay` : "None", ok: fee === 0 },
    { title: "Take payments yourself", value: takesPayments(plan) ? "Yes: your EcoCash, bank and other accounts" : "No: buyers pay Localink, you get paid out", ok: takesPayments(plan) },
    { title: "Payouts of Localink payments", value: PAYOUT_LABEL[plan], ok: true },
    { title: "Products buyers see", value: lim(productLimit(plan, c.limits), "products"), ok: true },
    { title: "Extra branches", value: lim(branches, branches === 1 ? "branch" : "branches"), ok: branches !== 0 },
    { title: "Shop offers on the whole basket", value: shopOffers(plan) ? "Yes" : "No (product discounts only)", ok: shopOffers(plan) },
    { title: "Bulk prices (cases, cartons, bales)", value: bulkPrices(plan) ? "Yes, for bulk buyers" : "No", ok: bulkPrices(plan) },
    { title: "Online payments and Localink credits", value: "Yes", ok: true },
  ];
}

/** "$10 off", "5% off", "5% + $10 off". */
export const tierOffer = (t: { amount: number; percent: number }) =>
  `${[t.percent > 0 ? `${t.percent}%` : "", t.amount > 0 ? `$${Number.isInteger(t.amount) ? t.amount : t.amount.toFixed(2)}` : ""].filter(Boolean).join(" + ")} off`;

/** Localink's discount on an order worth [goods] (same as functions rewardFor). */
export function rewardFor(r: PaymentsConfig["rewards"], goods: number, spentBefore = 0, usedBefore = 0): number {
  if (!r.enabled || goods <= 0) return 0;
  const spend = r.basis === "month" ? spentBefore + goods : goods;
  const tier = [...r.tiers].filter((t) => spend + 0.0001 >= t.minSpend).sort((a, b) => b.minSpend - a.minSpend)[0];
  if (!tier) return 0;
  let d = Math.min(Math.max(tier.amount + (goods * tier.percent) / 100, 0), goods);
  if (r.capPer30Days > 0) d = Math.min(d, Math.max(r.capPer30Days - usedBefore, 0));
  return cents(d);
}
