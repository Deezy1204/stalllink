// Orders a shop takes itself: a customer phones (or walks in) and the
// merchant captures the order. Written exactly as the app writes them
// (LocalinkGo/lib/state/app_store.dart placeShopOrder): priced, paid and
// collected like an order a buyer places, with `placedBy: "shop"` and the
// customer's phone. LocalinkGo's own bulk discount never applies to them.
// Also: sending a customer's proof of payment for them.

import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { bulkTitle, digitsOnly, dollars, variationLabel } from "./catalog";
import { db, storage } from "./firebase";
import { applyDiscount, promoHeadline } from "./money";
import { bulkPrices, feePercentOf, listedProducts, planOf, shopOffers, takesPayments } from "./plans";
import { addClaims, amountProblem, commitProof, newBatch, proofFileProblem, refKey, refProblem, sha256 } from "./proofs";
import { cents, isActive, orderTotal, type BulkPrice, type OrderDoc, type PaymentOption, type PaymentsConfig, type Product, type ShopDoc, type Variation } from "./types";

/** One thing the customer buys: a product, in a size (and maybe a bulk pack), times [qty]. */
export interface Line {
  product: Product;
  variation?: Variation;
  bulk?: BulkPrice;
  qty: number;
}

export const listPrice = (l: Line) => l.bulk?.price ?? l.variation?.price ?? l.product.price;
export const unitPrice = (l: Line) => (isActive(l.product.discount) ? applyDiscount(listPrice(l), l.product.discount!) : listPrice(l));
export const optionLabel = (l: Line) => [l.variation ? variationLabel(l.variation) : "", l.bulk ? bulkTitle(l.bulk) : ""].filter(Boolean).join(" · ");
/** The item name saved on the order (CartLine.orderName in the app). */
export const orderName = (l: Line) => (optionLabel(l) ? `${l.product.name} · ${optionLabel(l)}` : l.product.name);
const COUNTED = new Set(["piece", "pack", "bag", "bottle", "tin", "box", "crate", "tray", "bunch", "loaf", "dozen"]);
const unitName = (l: Line) => (l.bulk ? l.bulk.name.toLowerCase() : l.variation?.unit && COUNTED.has(l.variation.unit) ? l.variation.unit : (l.product.unitLabel ?? "unit"));
export const sameLine = (a: Line, b: Line) => a.product.id === b.product.id && a.variation?.id === b.variation?.id && a.bulk?.id === b.bulk?.id;

/** The products buyers can order at [shop] on its plan (bulk prices only on Max). */
export function sellable(shop: ShopDoc, cfg: PaymentsConfig): Product[] {
  const bulk = bulkPrices(planOf(shop));
  return listedProducts(shop, cfg.limits).listed.map((p) => (bulk ? p : { ...p, variations: (p.variations ?? []).map((v) => ({ ...v, bulk: [] })) }));
}

/** Every way [p] sells: each size, and each bulk pack of it. */
export const optionsOf = (p: Product): Line[] =>
  p.variations?.length ? p.variations.flatMap((v) => [{ product: p, variation: v, qty: 1 }, ...(v.bulk ?? []).map((b) => ({ product: p, variation: v, bulk: b, qty: 1 }))]) : [{ product: p, qty: 1 }];

/** What [lines] cost at [shop] on its plan: its offer, delivery and LocalinkGo's service fee. */
export function totalsFor(shop: ShopDoc, cfg: PaymentsConfig, lines: Line[], delivery = 0) {
  const plan = planOf(shop);
  const subtotal = cents(lines.reduce((s, l) => s + unitPrice(l) * l.qty, 0));
  const p = shop.promo;
  const discount = p && shopOffers(plan) && isActive(p) && subtotal + 0.0001 >= (p.minSpend ?? 0) ? cents((subtotal * p.percent) / 100) : 0;
  const fee = cents(((subtotal - discount + delivery) * feePercentOf(plan, cfg)) / 100);
  return { subtotal, discount, delivery, fee, total: cents(subtotal - discount + delivery + fee) };
}

/** The shop takes payments itself (Pro and Max with payment details); otherwise buyers pay LocalinkGo. */
export const takesDirect = (shop: ShopDoc) => takesPayments(planOf(shop)) && (shop.paymentOptions ?? []).length > 0;

/** Someone who bought at the shop before, by phone number. */
export interface ShopCustomer {
  name: string;
  phone: string;
  orders: OrderDoc[];
}

const phoneKey = (p: string) => digitsOnly(p).slice(-9);

/** Customers the shop took orders for, and people who collected orders there, newest first. */
export function returningCustomers(orders: OrderDoc[], shopId: string): ShopCustomer[] {
  const byPhone = new Map<string, ShopCustomer>();
  for (const o of [...orders].filter((x) => x.stallId === shopId && x.status !== "cancelled").sort((a, b) => b.createdAt - a.createdAt)) {
    const people: [string, string][] = [];
    if (o.placedBy === "shop" && o.customerPhone) people.push([o.senderName, o.customerPhone]);
    if (o.recipient?.phone?.trim()) people.push([o.recipient.name, o.recipient.phone]);
    for (const [name, phone] of people) {
      const key = phoneKey(phone);
      if (key.length < 7) continue;
      const c = byPhone.get(key) ?? { name, phone, orders: [] };
      if (!c.orders.includes(o)) c.orders.push(o);
      byPhone.set(key, c);
    }
  }
  return [...byPhone.values()];
}

export const findCustomer = (all: ShopCustomer[], phone: string) => (phoneKey(phone).length >= 7 ? all.find((c) => phoneKey(c.phone) === phoneKey(phone)) : undefined);

/** [o]'s items as they sell today (same product, size and bulk pack); ones no longer sold are left out. */
export function linesForReorder(products: Product[], o: OrderDoc): Line[] {
  const out: Line[] = [];
  for (const item of o.items) {
    const options = products.filter((p) => !item.productId || p.id === item.productId).flatMap(optionsOf);
    const match = options.find((l) => orderName(l) === item.name);
    if (match) out.push({ ...match, qty: item.qty });
  }
  return out;
}

/** Unique enough across users: time-based plus a random tail (as the app). */
function newOrderId() {
  const t = Date.now().toString(36).toUpperCase();
  return `LNK-${t.slice(-5)}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
}
const sixDigits = () => String(100000 + Math.floor(Math.random() * 900000));

async function notify(fromUid: string, n: { title: string; body: string; icon: string; color: "primary" | "secondary" | "neutral"; orderId: string }, phone: string) {
  if (!digitsOnly(phone)) return;
  await addDoc(collection(db(), "notifications"), { ...n, time: Date.now(), unread: true, toUser: "", toPhone: digitsOnly(phone), fromUser: fromUid }).catch(() => {});
}

/**
 * Creates the order the shop took for [customer], collected by [collector]
 * (the customer when null). LocalinkGo sends it to the customer's number.
 */
export async function placeShopOrder(args: {
  uid: string;
  shop: ShopDoc;
  cfg: PaymentsConfig;
  lines: Line[];
  customer: { name: string; phone: string };
  collector?: { name: string; phone: string } | null;
  payment: PaymentOption;
  toShop: boolean;
  delivery: boolean;
  branchId: string;
  note: string;
}): Promise<OrderDoc> {
  const { uid, shop, cfg, lines, customer, collector, payment, delivery, note } = args;
  // Only Pro and Max shops take payments themselves (firestore.rules agree).
  const payTo = args.toShop && takesDirect(shop) ? "shop" : "localink";
  const runnerFee = delivery && shop.offersDelivery ? (shop.deliveryFee ?? 0) : 0;
  const t = totalsFor(shop, cfg, lines, runnerFee);
  const promo = shop.promo;
  const who = collector ?? customer;
  const branch = (shop.branches ?? []).find((b) => b.id === args.branchId) ?? null;
  const id = newOrderId();
  const order: OrderDoc = {
    id,
    voucherCode: `VCH-ZW-${sixDigits()}`,
    pin: sixDigits(),
    stallId: shop.id,
    shopOwnerId: shop.ownerId,
    senderId: uid,
    senderName: customer.name,
    senderCity: shop.city ?? "",
    recipient: { id: collector ? `r${Date.now()}` : "customer", name: who.name, relation: collector ? "Collects for the customer" : "Customer", phone: who.phone, city: shop.city ?? "", suburb: "", userId: null },
    recipientPhone: digitsOnly(who.phone),
    items: lines.map((l) => ({
      name: orderName(l),
      detail: l.product.subtitle ?? "",
      qty: l.qty,
      unitPrice: unitPrice(l),
      listPrice: listPrice(l),
      productId: l.product.id,
      imageAsset: l.product.imageAsset ?? "",
      unit: unitName(l),
    })),
    payTo,
    discount: t.discount,
    promoLabel: t.discount > 0 && promo ? promo.label || promoHeadline(promo) : "",
    serviceFee: t.fee,
    localinkDiscount: 0,
    localinkLabel: "",
    createdAt: Date.now(),
    payment,
    paymentStatus: "awaitingProof",
    paymentRef: "",
    payerName: "",
    status: "readyForPickup",
    collectedAt: null,
    collectedBy: null,
    note,
    runnerFee,
    slipUrl: null,
    handoverUrl: null,
    delivery: runnerFee > 0,
    senderMessage: "",
    branch,
    placedBy: "shop",
    customerPhone: digitsOnly(customer.phone),
  };
  await setDoc(doc(db(), "orders", id), order);
  const pickup = branch?.name ?? "Main shop";
  const how = payTo === "localink" ? `Pay LocalinkGo (${payment.name || payment.type})` : `Pay ${shop.name}`;
  await notify(uid, { title: `${shop.name} took your order`, body: `Order #${id}, ${dollars(orderTotal(order))}. ${how} and upload your proof in LocalinkGo, then collect at ${pickup} with your QR pass.`, icon: "confirmation_number", color: "primary", orderId: id }, customer.phone);
  if (collector && digitsOnly(collector.phone) !== digitsOnly(customer.phone)) {
    await notify(uid, { title: `${customer.name.split(" ")[0]} ordered groceries for you`, body: `Order #${id} is waiting at ${shop.name}. Open it for your QR pass.`, icon: "volunteer_activism", color: "primary", orderId: id }, collector.phone);
  }
  return order;
}

/** The message (and pass details) the shop sends its customer on WhatsApp. */
export function passMessage(o: OrderDoc, shop?: ShopDoc) {
  const place = o.branch?.name ?? "Main shop";
  const p = o.payment;
  const pay =
    o.paymentStatus === "confirmed"
      ? "Paid. "
      : `To pay: ${dollars(orderTotal(o))} by ${p?.name || p?.type || "transfer"}${p?.accountNumber ? ` to ${p.accountNumber}` : ""}${p?.accountName ? ` (${p.accountName})` : ""}, then send us the payment SMS or receipt with its reference.\n`;
  return (
    `Your order from ${shop?.name ?? "our shop"} on LocalinkGo.\n` +
    `Order #${o.id}: ${o.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}\n` +
    pay +
    `Voucher: ${o.voucherCode}\nPIN: ${o.pin ?? ""}\nCollect from: ${shop?.name ?? ""}, ${place}.`
  );
}

/**
 * Sends proof of paying [o] (the shop for its customer, on an order it took):
 * uploads the file, then writes the proof and claims its reference and file
 * in one batch. Throws the reason when LocalinkGo refuses it.
 */
export async function sendOrderProof(uid: string, o: OrderDoc, file: File, reference: string, payerName: string, amountSent: number | null) {
  const fileErr = proofFileProblem(file);
  if (fileErr) throw new Error(fileErr);
  const refErr = refProblem(reference, [o.id]);
  if (refErr) throw new Error(refErr);
  const amountErr = amountProblem(amountSent, orderTotal(o));
  if (amountErr) throw new Error(amountErr);
  const hash = await sha256(file);
  const key = refKey(o.payTo === "localink", o.stallId, reference);
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  // Under the order id, so storage.rules let the order's shop (and admins) see it.
  const slip = ref(storage(), `slips/${uid}/${o.id}/proof.${ext}`);
  const task = uploadBytesResumable(slip, file, { contentType: file.type || "image/jpeg" });
  await new Promise<void>((res, rej) => task.on("state_changed", undefined, rej, () => res()));
  const batch = newBatch();
  addClaims(batch, "order", o.id, uid, key, hash);
  batch.set(
    doc(db(), "orders", o.id),
    { paymentRef: reference.trim(), paymentRefKey: key, payerName, slipUrl: await getDownloadURL(slip), slipHash: hash, amountSent, proofBy: uid, paymentStatus: "proofSent" },
    { merge: true },
  );
  await commitProof(batch, "order", o.id, key, hash);
}
