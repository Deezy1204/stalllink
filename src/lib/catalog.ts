// Product sizes, shop categories, opening hours and payment types, written
// the same way the mobile app writes them (stall_link/lib/data/models.dart),
// so a shop edited on the web reads exactly the same in the app.

import type { BulkPrice, DayHours, OrderDoc, PaymentOption, PaymentStatus, Product, ShopDoc, Variation } from "./types";

// ---- numbers ---------------------------------------------------------------------

/** 2 → "2", 1.5 → "1.5", 0.25 → "0.25". */
export const fmtNumber = (v: number) => v.toFixed(2).replace(/\.?0+$/, "");

/** English plural of a unit name: bag → bags, box → boxes, loaf → loaves. */
export function plural(noun: string): string {
  if (!noun || noun === "dozen") return noun;
  if (noun.endsWith("f")) return `${noun.slice(0, -1)}ves`;
  if (/(s|x|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export const zar = (usd: number, rate?: number) => `R ${(usd * (rate || 18.5)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "$12.50", as the app writes amounts into notification text. */
export const dollars = (v: number) => `$${v.toFixed(2)}`;

/** Something unique enough for ids inside a shop document (the app uses microseconds). */
export const newId = (prefix: string) => `${prefix}${Date.now() * 1000 + Math.floor(Math.random() * 1000)}`;

export const digitsOnly = (s: string) => s.replace(/[^0-9]/g, "");

// ---- sizes -----------------------------------------------------------------------

export const MEASURE_UNITS = [
  { id: "kg", short: "kg", metric: "kilograms" },
  { id: "g", short: "g", metric: "grams" },
  { id: "l", short: "L", metric: "litres" },
  { id: "ml", short: "ml", metric: "millilitres" },
  { id: "piece", short: "piece" },
  { id: "pack", short: "pack" },
  { id: "bag", short: "bag" },
  { id: "bottle", short: "bottle" },
  { id: "tin", short: "tin" },
  { id: "box", short: "box" },
  { id: "crate", short: "crate" },
  { id: "tray", short: "tray" },
  { id: "bunch", short: "bunch" },
  { id: "loaf", short: "loaf" },
  { id: "dozen", short: "dozen" },
] as const satisfies readonly { id: string; short: string; metric?: string }[];

export type MeasureUnit = (typeof MEASURE_UNITS)[number]["id"];

const unitOf = (id?: string | null) => MEASURE_UNITS.find((u) => u.id === id);

export const unitMenuLabel = (id: string) => {
  const u = unitOf(id);
  if (!u) return id;
  return "metric" in u ? `${u.short} (${u.metric})` : u.short;
};

/** "2 kg", "500 g", "1 pack", "6 pieces". */
export function amount(unit: string, size: number): string {
  const u = unitOf(unit);
  if (!u) return fmtNumber(size);
  const counted = !("metric" in u);
  return counted && size !== 1 ? `${fmtNumber(size)} ${plural(u.short)}` : `${fmtNumber(size)} ${u.short}`;
}

/** "2 kg", empty when no size was entered. */
export const measure = (v: Pick<Variation, "size" | "unit">) => (v.size != null && v.unit ? amount(v.unit, v.size) : "");

/** What buyers see: "2 kg", "2 kg · Family bag", or an older free-text name. */
export function variationLabel(v: Variation): string {
  const m = measure(v);
  if (!m) return v.name;
  if (!v.name || v.name.toLowerCase() === m.toLowerCase()) return m;
  return `${m} · ${v.name}`;
}

/** "Case of 10". */
export const bulkTitle = (b: BulkPrice) => `${b.name} of ${b.count}`;

/** The cheapest single price, shown as "From" in lists. */
export const fromPrice = (p: Product) => (p.variations?.length ? Math.min(...p.variations.map((v) => v.price)) : p.price);

export const MAX_PRODUCT_PHOTOS = 4;
export const MAX_GALLERY = 4;

/** Every photo of a product, cover first (older products only have imageAsset). */
export const productPhotos = (p: Product) => (p.images?.length ? p.images : p.imageAsset ? [p.imageAsset] : []);

export const PRODUCT_CATEGORIES = [
  { id: "grains", label: "Grains & Meal" },
  { id: "veg", label: "Fresh Veggies" },
  { id: "oils", label: "Cooking Oils" },
  { id: "bakery", label: "Bakery & Pantry" },
  { id: "meat", label: "Meat & Poultry" },
  { id: "beverages", label: "Beverages" },
] as const;

export const productCategoryLabel = (id?: string) => PRODUCT_CATEGORIES.find((c) => c.id === id)?.label ?? "Grains & Meal";

// ---- shops -------------------------------------------------------------------------

export const SHOP_CATEGORIES = [
  { id: "produce", label: "Fresh Produce", emoji: "🥬" },
  { id: "bakery", label: "Bakeries", emoji: "🥖" },
  { id: "butchery", label: "Butchery", emoji: "🥩" },
  { id: "grains", label: "Grains & Pantry", emoji: "🌾" },
  { id: "beverages", label: "Beverages", emoji: "🥤" },
  { id: "household", label: "Household", emoji: "🧴" },
] as const;

/** The built-in category with this label (or id), or undefined for one a shop typed itself. */
export const shopCategoryFor = (label: string) => {
  const l = label.trim().toLowerCase();
  return SHOP_CATEGORIES.find((c) => c.label.toLowerCase() === l || c.id === l);
};

/** The `category` field older app versions read: the first built-in category's id. */
export const legacyCategory = (labels: string[]) => labels.map(shopCategoryFor).find(Boolean)?.id ?? "produce";

export const ZIM_CITIES = [
  "Banket", "Beitbridge", "Bindura", "Binga", "Bulawayo", "Centenary", "Chegutu", "Chimanimani", "Chinhoyi",
  "Chipinge", "Chiredzi", "Chirundu", "Chitungwiza", "Chivhu", "Concession", "Epworth", "Filabusi", "Glendale",
  "Gokwe", "Guruve", "Gutu", "Gwanda", "Gweru", "Harare", "Headlands", "Hwange", "Juliasdale", "Kadoma",
  "Kamativi", "Kariba", "Karoi", "Kwekwe", "Lupane", "Macheke", "Marondera", "Masvingo", "Mashava", "Mazowe",
  "Mberengwa", "Mhangura", "Mount Darwin", "Murehwa", "Mutare", "Mutoko", "Mvurwi", "Mvuma", "Nkayi", "Norton",
  "Nyanga", "Plumtree", "Redcliff", "Rusape", "Ruwa", "Shamva", "Shurugwi", "Triangle", "Tsholotsho",
  "Victoria Falls", "Wedza", "Zaka", "Zvishavane",
];

/** Where to start the map when nothing has been pinned yet. */
const CITY_CENTRES: Record<string, [number, number]> = {
  bulawayo: [-20.1539, 28.5833],
  harare: [-17.8292, 31.0522],
  gweru: [-19.45, 29.8167],
  mutare: [-18.9707, 32.6709],
  gokwe: [-18.2167, 28.9333],
};
export const cityCentre = (city: string): [number, number] => CITY_CENTRES[city.trim().toLowerCase()] ?? CITY_CENTRES.bulawayo;

// ---- opening hours ---------------------------------------------------------------------

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_FULL_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const parseClock = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const range = (d: DayHours) => (d.open ? `${clock(d.opens)}–${clock(d.closes)}` : "Closed");

/** Mon–Sat 07:00–18:00, Sunday closed. */
export const defaultWeek = (): DayHours[] => Array.from({ length: 7 }, (_, i) => ({ day: i + 1, open: i !== 6, opens: 7 * 60, closes: 18 * 60 }));

/** e.g. "Mon–Fri 07:00–18:00 · Sat 08:00–13:00 · Sun Closed". */
export function hoursSummary(week: DayHours[]): string {
  if (!week.length) return "";
  const days = [...week].sort((a, b) => a.day - b.day);
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= days.length; i++) {
    if (i === days.length || range(days[i]) !== range(days[start]) || days[i].day !== days[i - 1].day + 1) {
      const a = days[start];
      const b = days[i - 1];
      parts.push(`${a.day === b.day ? DAY_NAMES[a.day - 1] : `${DAY_NAMES[a.day - 1]}–${DAY_NAMES[b.day - 1]}`} ${range(a)}`);
      start = i;
    }
  }
  return parts.join(" · ");
}

// ---- payments -----------------------------------------------------------------------------

export const PAYMENT_TYPES: { id: PaymentOption["type"]; label: string }[] = [
  { id: "ecocash", label: "EcoCash" },
  { id: "innbucks", label: "InnBucks" },
  { id: "onemoney", label: "OneMoney" },
  { id: "mukuru", label: "Mukuru" },
  { id: "bank", label: "Bank transfer" },
  { id: "other", label: "Other" },
];

export const paymentNumberLabel = (t: PaymentOption["type"]) =>
  t === "bank" ? "Account number" : t === "mukuru" ? "Mukuru phone / ID" : t === "other" ? "Number or reference" : "Phone or merchant code";

export const paymentNumberHint = (t: PaymentOption["type"]) =>
  t === "bank" ? "e.g. 1009 4821 3901" : t === "mukuru" ? "e.g. +263 77 482 1039" : t === "other" ? "e.g. account or wallet ID" : "e.g. 0774 001 414 or *151*2*2# 904421";

/** "0774 001 414 • Green Harvest". */
export const paymentSummary = (p?: PaymentOption) => [p?.accountNumber, p?.accountName].filter(Boolean).join(" • ");

/** The app's full payment status wording (CSV exports and order screens). */
export const paymentStatusText: Record<PaymentStatus, string> = {
  awaitingProof: "Awaiting payment proof",
  proofSent: "Payment proof sent",
  confirmed: "Payment confirmed",
};

// ---- orders --------------------------------------------------------------------------------

export const orderSubtotal = (o: OrderDoc) => o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

export const isOpenOrder = (o: OrderDoc) => o.status === "readyForPickup";

/** Older orders without a payment status were paid on the spot. */
export const paymentStatusOf = (o: OrderDoc): PaymentStatus => o.paymentStatus ?? "confirmed";

/** Where the order is collected: the chosen branch, or the shop's main stall. */
export function pickupPlace(o: OrderDoc, shop?: ShopDoc) {
  if (o.branch) return { name: o.branch.name, standNo: o.branch.standNo ?? "", address: o.branch.address ?? "", suburb: o.branch.suburb ?? "", city: o.branch.city ?? shop?.city ?? "" };
  return { name: "Main shop", standNo: shop?.standNo ?? "", address: shop?.address ?? "", suburb: shop?.suburb ?? "", city: shop?.city ?? "" };
}

/**
 * Collection codes look like VCH-ZW-892417: typing the last 4+ digits is
 * enough. The recipient's 6-digit backup PIN works too (the pass offers it
 * when the QR cannot be shown).
 */
export function matchVoucher(orders: OrderDoc[], raw: string): OrderDoc | undefined {
  const code = digitsOnly(raw);
  if (code.length < 4) return undefined;
  return (
    orders.find((o) => digitsOnly(o.voucherCode) === code) ??
    orders.find((o) => o.pin === code) ??
    orders.find((o) => digitsOnly(o.voucherCode).endsWith(code))
  );
}

export const validUntil = (o: OrderDoc) => o.createdAt + 5 * 24 * 60 * 60 * 1000;

// ---- dates ---------------------------------------------------------------------------------

export const timeOfDay = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "4 Oct 2026", as the app writes dates. */
export const dayMonthYear = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "Today, 3:12 PM", "Yesterday", "4 Oct 2026". */
export function relativeDay(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return `Today, ${timeOfDay(ms)}`;
  if (diff === 1) return "Yesterday";
  return dayMonthYear(ms);
}

export function ago(ms: number): string {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / (60 * 24))}d ago`;
}

export const monthKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (key: string, style: "long" | "short" = "long") => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-GB", style === "long" ? { month: "long", year: "numeric" } : { month: "short" });
};
