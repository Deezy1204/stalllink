// Shapes of the Firestore documents written by the StallLink mobile app
// (see stall_link/lib/data/serialization.dart). Fields are optional where
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
}

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

export interface Product {
  id: string;
  name: string;
  price: number;
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
  items: { name: string; qty: number; unitPrice: number; detail?: string; unit?: string; imageAsset?: string }[];
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

export const orderTotal = (o: OrderDoc) => o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + (o.runnerFee ?? 0);

export const shopCategories = (s: ShopDoc): string[] => (s.categories?.length ? s.categories : s.category ? [s.category] : []);

export const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

export const shortDate = (d?: Date | number | null) =>
  d == null ? "—" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(typeof d === "number" ? new Date(d) : d);
