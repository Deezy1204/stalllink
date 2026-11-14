// Shapes of the Firestore documents written by the Localink mobile app
// (see Localink/lib/data/serialization.dart). Fields are optional where
// older documents may not have them.

export type Mode = "customer" | "merchant";

export interface UserDoc {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Mode;
  city?: string;
  suspended?: boolean;
  createdAt?: Date | null;
  /** Digits of `phone`; orders and notifications sent to this number match on it. */
  phoneDigits?: string;
  /** Others can find this account when choosing a recipient (people search). */
  findable?: boolean;
  /** Identity check (Didit). Only the Cloud Functions write it. */
  kyc?: KycDoc;
}

export type KycStatus = "none" | "pending" | "inReview" | "approved" | "declined" | "expired";

export interface KycDoc {
  status: KycStatus;
  updatedAt?: number;
  verifiedAt?: number;
  reason?: string;
  sessionId?: string;
}

export const kycLabel: Record<KycStatus, string> = {
  none: "Not verified",
  pending: "Verification started",
  inReview: "Being reviewed",
  approved: "Identity verified",
  declined: "Not passed",
  expired: "Expired, verify again",
};

export interface PaymentOption {
  id: string;
  type: "ecocash" | "innbucks" | "onemoney" | "mukuru" | "bank" | "other";
  name?: string;
  accountName?: string;
  accountNumber?: string;
  instructions?: string;
}

export interface DayHours {
  day: number; // 1 = Monday … 7 = Sunday
  open: boolean;
  opens: number; // minutes after midnight
  closes: number;
}

/** A bulk price for one size, e.g. a case of 10 packs for $10. */
export interface BulkPrice {
  id: string;
  name: string;
  count: number;
  price: number;
}

/** One size of a product (2 kg, 750 ml…) with its own price, stock and bulk prices. */
export interface Variation {
  id: string;
  /** Optional label ("Family bag"); older sizes keep their whole name here. */
  name: string;
  price: number;
  size?: number | null;
  /** A MeasureUnit id (see catalog.ts). */
  unit?: string | null;
  stock: number;
  note?: string;
  badge?: string | null;
  bulk?: BulkPrice[];
}

/** A percentage off every size and bulk price of a product, until `endsAt`. */
export interface Discount {
  percent: number;
  label?: string;
  /** Epoch millis of the last moment it applies (null = until the shop ends it). */
  endsAt?: number | null;
}

/** A shop-wide offer taken off the basket at checkout (on top of product discounts). */
export interface ShopPromo extends Discount {
  /** The basket must reach this for the offer to apply. */
  minSpend?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  /** Optional sale (see Discount). */
  discount?: Discount | null;
  stock: number;
  imageAsset?: string;
  /** Every photo, cover first (up to 4). */
  images?: string[];
  available?: boolean;
  /** A ProductCategory id (see catalog.ts). */
  category?: string;
  stallId?: string;
  subtitle?: string;
  description?: string;
  variations?: Variation[];
  tag?: string | null;
  unitLabel?: string;
  features?: string[];
}

/** A pickup location of a shop besides its main stall. */
export interface Branch {
  id: string;
  name: string;
  standNo?: string;
  address?: string;
  suburb?: string;
  city?: string;
  hours?: string;
  phone?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface ShopDoc {
  id: string;
  ownerId: string;
  name: string;
  standNo?: string;
  address?: string;
  city?: string;
  suburb?: string;
  country?: string;
  categories?: string[];
  category?: string;
  bannerAsset?: string;
  /** Up to 4 extra photos besides the front photo. */
  gallery?: string[];
  logoAsset?: string | null;
  hours?: string;
  schedule?: DayHours[];
  paymentOptions?: PaymentOption[];
  phone?: string;
  isOpen?: boolean;
  ownerName?: string;
  lat?: number | null;
  lng?: number | null;
  verified?: boolean;
  suspended?: boolean;
  offersDelivery?: boolean;
  deliveryFee?: number;
  /** Rands per US dollar, set by the shop. */
  zarPerUsd?: number;
  products?: Product[];
  branches?: Branch[];
  /** Average of the visible reviews and how many there are (kept up to date by the Cloud Functions). */
  rating?: number;
  reviewCount?: number;
  /** Pro paid up to this moment (epoch millis), from before there were several plans. Only Localink sets it. */
  proUntil?: number;
  /** The paid plan ("standard" | "pro" | "max") and until when it is paid. Only Localink sets them. */
  plan?: string;
  planUntil?: number;
  /** The current or last free trial (7 days or 10 orders), and every plan already tried. */
  trial?: { plan: string; startedAt: number; endsAt: number; orders: number; maxOrders: number; endedAt?: number } | null;
  trialsUsed?: string[];
  /** The owner's identity is verified (Didit); kept in step by the Cloud Functions. */
  ownerVerified?: boolean;
  /** The shop's offer on the whole basket. */
  promo?: ShopPromo | null;
}

/** Buyers see the green tick: Localink verified the shop and its owner's identity. */
export const isVerified = (s: Pick<ShopDoc, "verified" | "ownerVerified">) => s.verified === true && s.ownerVerified === true;

/**
 * A public rating (1–5) with an optional comment: of a shop (`shopReviews`,
 * keyed "<shopId>_<uid>") or of Localink itself (`appReviews`, keyed by uid).
 */
export interface ReviewDoc {
  id: string;
  /** Set on shop reviews only. */
  shopId?: string;
  authorId: string;
  authorName: string;
  rating: number;
  comment: string;
  /** Hidden by an admin: left out of public lists and ratings. */
  hidden: boolean;
  /** The author collected an order at this shop (set by the Cloud Functions). */
  verifiedOrder?: boolean;
  /** Reviews of Localink: the mode they were written in, and where. */
  role?: Mode;
  source?: "app" | "web";
  createdAt: number; // epoch millis
  updatedAt: number;
}

export type OrderStatus = "readyForPickup" | "collected" | "expired" | "cancelled";
export type PaymentStatus = "awaitingProof" | "proofSent" | "confirmed";

export interface OrderDoc {
  id: string;
  voucherCode: string;
  /** Backup PIN for collection without the QR. */
  pin?: string;
  stallId: string;
  shopOwnerId: string;
  senderId: string;
  senderName: string;
  senderCity?: string;
  recipient: { id?: string; name: string; phone: string; city?: string; suburb?: string; relation?: string; userId?: string | null };
  recipientPhone?: string;
  /** `unitPrice` is what the buyer paid each, after any product discount; `listPrice` the normal price. */
  items: { name: string; qty: number; unitPrice: number; listPrice?: number; productId?: string; detail?: string; unit?: string; imageAsset?: string }[];
  createdAt: number; // epoch millis
  status: OrderStatus;
  collectedAt?: number | null;
  collectedBy?: string | null;
  payment?: PaymentOption;
  paymentStatus?: PaymentStatus;
  paymentRef?: string;
  payerName?: string;
  slipUrl?: string | null;
  /** Photo the shop took when handing the groceries over. */
  handoverUrl?: string | null;
  runnerFee?: number;
  delivery?: boolean;
  note?: string;
  senderMessage?: string;
  /** Collection point chosen for the order (null = the main stall). */
  branch?: Branch | null;
  /** Who receives the money: the shop itself (Pro shops only), or Localink, which pays the shop out. Missing = shop. */
  payTo?: "shop" | "localink";
  /** How Localink was paid (set by Localink when it confirms the payment). */
  paidVia?: "transfer" | "online" | "credits";
  /** The buyer's shop whose Localink credits paid it. */
  paidFromShopId?: string;
  paidAt?: number;
  /** Taken off by the shop's offer (`promoLabel` says which). */
  discount?: number;
  promoLabel?: string;
  /** Localink's fee at Basic and Standard shops, paid by the buyer. */
  serviceFee?: number;
  /** Taken off by Localink's own discount for big baskets (`localinkLabel` says which). Localink pays it; the shop gets its full price. */
  localinkDiscount?: number;
  localinkLabel?: string;
  /** Localink has checked the charges against the shop's plan. */
  chargesChecked?: boolean;
}

/** Localink's discount for customers who buy a lot: tiers on the basket (or the last 30 days). */
export interface RewardsConfig {
  enabled: boolean;
  basis: "order" | "month";
  tiers: { minSpend: number; amount: number; percent: number }[];
  /** Most one customer gets back in 30 days (0 = no cap). */
  capPer30Days: number;
  label: string;
}

/** How many products and extra branches a plan shows buyers (null = no limit). */
export interface PlanLimit {
  products: number | null;
  branches: number | null;
}

/** Localink's payment settings (`config/payments`). */
export interface PaymentsConfig {
  /** Localink's accounts buyers and shops pay into. */
  options: PaymentOption[];
  onlineEnabled: boolean;
  /** Price of one month of each paid plan. */
  proMonthly: number;
  standardMonthly: number;
  maxMonthly: number;
  /** Added to what buyers pay at Basic / Standard shops. */
  serviceFeePercent: number;
  standardFeePercent: number;
  rewards: RewardsConfig;
  /** Per plan (basic, standard, pro, max). */
  limits: Record<"basic" | "standard" | "pro" | "max", PlanLimit>;
}

/** What Localink holds for one shop (`wallets/{shopId}`); only the Cloud Functions change the amounts. */
export interface WalletDoc {
  shopId: string;
  ownerId?: string;
  balance: number;
  pending: number;
  earned: number;
  paidOut: number;
  spent: number;
  payout?: PaymentOption | null;
  autoPayout: boolean;
  autoRenew: boolean;
  lastPayoutAt?: number;
  /** All of Localink's discounts on this shop's collected sales (Localink paid them). */
  localinkDiscounts?: number;
}

export interface LedgerDoc {
  id: string;
  type: "sale_paid" | "sale_released" | "spend" | "plan" | "payout" | "payout_reversed" | "adjustment" | string;
  amount: number;
  pending: number;
  note?: string;
  orderId?: string | null;
  createdAt: number;
  /** For a sale: the part Localink paid as the buyer's discount. */
  localinkDiscount?: number;
}

export interface PayoutDoc {
  id: string;
  shopId: string;
  ownerId: string;
  amount: number;
  to?: PaymentOption;
  plan?: string;
  /** The sales collected since the shop's previous payout (full price), and how much of that Localink paid as discounts. */
  breakdown?: { orders: number; sales: number; localinkDiscount: number };
  status: "pending" | "paid" | "failed";
  reference?: string;
  note?: string;
  createdAt: number;
  handledAt?: number;
}

/** A plan paid by transfer to Localink, with proof for an admin to check. */
export interface PlanPaymentDoc {
  id: string;
  shopId: string;
  ownerId: string;
  /** Missing on payments from before there were several plans (Pro). */
  plan?: string;
  months: number;
  amount: number;
  payment?: PaymentOption;
  slipUrl?: string;
  paymentRef?: string;
  payerName?: string;
  status: "proofSent" | "approved" | "rejected";
  note?: string;
  createdAt: number;
}

/** An in-app notification (also sent as a push message by the Cloud Functions). */
export interface NotificationDoc {
  id: string;
  title: string;
  body: string;
  time: number; // epoch millis
  icon?: string;
  color?: "primary" | "secondary" | "neutral";
  unread: boolean;
  orderId?: string | null;
  toUser?: string;
  toPhone?: string;
}

export interface NominationDoc {
  id: string;
  name: string;
  phone: string;
  userId: string;
  status: "new" | "contacted" | "onboarded" | "dismissed";
  createdAt?: Date | null;
}

export interface AdminDoc {
  uid: string;
  email: string;
  name?: string;
  addedBy?: string;
  addedAt?: Date | null;
}

export interface InviteDoc {
  email: string;
  invitedBy?: string;
  createdAt?: Date | null;
}

export const statusLabel: Record<OrderStatus, string> = {
  readyForPickup: "Ready for pickup",
  collected: "Collected",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const paymentLabel: Record<PaymentStatus, string> = {
  awaitingProof: "Awaiting proof",
  proofSent: "Proof sent",
  confirmed: "Confirmed",
};

const paymentTypeLabel: Record<PaymentOption["type"], string> = {
  ecocash: "EcoCash",
  innbucks: "InnBucks",
  onemoney: "OneMoney",
  mukuru: "Mukuru",
  bank: "Bank transfer",
  other: "Other",
};

export function paymentTitle(p?: PaymentOption): string {
  if (!p) return "—";
  if (p.type === "other") return p.name || "Other";
  return p.name ? `${paymentTypeLabel[p.type]} · ${p.name}` : paymentTypeLabel[p.type] ?? p.type;
}

/** Whole cents. */
export const cents = (v: number) => Math.round(v * 100) / 100;

/** What the buyer pays: items, less the shop offer and Localink's discount, plus delivery and Localink's service fee. */
export const orderTotal = (o: OrderDoc) =>
  cents(o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) - (o.discount ?? 0) + (o.runnerFee ?? 0) + (o.serviceFee ?? 0) - (o.localinkDiscount ?? 0));

/** What the shop gets: everything but Localink's service fee; Localink pays its own discount to the shop. */
export const orderShare = (o: OrderDoc) => cents(orderTotal(o) - (o.serviceFee ?? 0) + (o.localinkDiscount ?? 0));

export const viaLocalink = (o: OrderDoc) => o.payTo === "localink";

export const paidViaLabel: Record<NonNullable<OrderDoc["paidVia"]>, string> = { transfer: "Transfer to Localink", online: "Paid online", credits: "Localink credits" };


/** A discount or offer that applies right now. */
export const isActive = (d?: Discount | null, at = Date.now()) => !!d && d.percent > 0 && (d.endsAt == null || d.endsAt > at);

export const shopCategories = (s: ShopDoc): string[] => (s.categories?.length ? s.categories : s.category ? [s.category] : []);

export const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

export const shortDate = (d?: Date | number | null) =>
  d == null ? "—" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(typeof d === "number" ? new Date(d) : d);
