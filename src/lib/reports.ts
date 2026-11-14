// The sales report (PDF / CSV) and order receipt a merchant downloads, laid
// out like the app's (Localink/lib/core/utils/documents.dart).

import type { jsPDF as JsPdf } from "jspdf";

import { dayMonthYear, paymentStatusOf, paymentStatusText, pickupPlace } from "./catalog";
import { orderShare, orderTotal, paidViaLabel, paymentTitle, statusLabel, usd, viaLocalink, type OrderDoc, type ShopDoc } from "./types";

const BRAND: [number, number, number] = [0x0a, 0x7a, 0x63];
const GREY: [number, number, number] = [0x5e, 0x5e, 0x66];
const BLACK: [number, number, number] = [0x14, 0x1b, 0x2b];

const PLAIN: Record<string, string> = { "–": "-", "—": "-", "•": "·", "‘": "'", "’": "'", "“": '"', "”": '"', "…": "..." };

/** The PDF's built-in font covers Latin-1 only: swap common typographic characters, drop the rest. */
const safe = (s: string) => [...s].map((c) => PLAIN[c] ?? (c.codePointAt(0)! <= 0xff ? c : "")).join("");

export function download(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Same columns as the app's CSV export. */
export function earningsCsv(orders: OrderDoc[]): Blob {
  const rows = orders.map((o) =>
    [
      o.id, dayMonthYear(o.createdAt), o.voucherCode, o.recipient?.name ?? "", o.items.length, o.paidVia ? paidViaLabel[o.paidVia] : paymentTitle(o.payment), viaLocalink(o) ? "Localink" : "Shop", paymentStatusText[paymentStatusOf(o)],
      orderTotal(o).toFixed(2), (o.serviceFee ?? 0).toFixed(2), (o.localinkDiscount ?? 0).toFixed(2), orderShare(o).toFixed(2), statusLabel[o.status] ?? o.status,
    ]
      .map(cell)
      .join(","),
  );
  return new Blob([`Order,Date,Voucher,Recipient,Items,Payment,Paid to,Payment status,Buyer paid (USD),Service fee (USD),Localink discount (USD),Your sales (USD),Status\n${rows.join("\n")}\n`], { type: "text/csv" });
}

async function newPdf(format: "a4" | "a5", title: string): Promise<JsPdf> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format });
  pdf.setProperties({ title, author: "Localink" });
  return pdf;
}

export async function earningsPdf(title: string, orders: OrderDoc[]): Promise<Blob> {
  const pdf = await newPdf("a4", "Localink sales report");
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 32;
  let y = M + 14;

  pdf.setFont("helvetica", "bold").setFontSize(20).setTextColor(...BRAND).text("Localink sales report", M, y);
  y += 18;
  pdf.setFont("helvetica", "normal").setFontSize(11).setTextColor(...GREY).text(safe(`${title} - ${dayMonthYear(Date.now())}`), M, y);
  y += 26;
  // The shop's share of each sale (without Localink's service fee).
  const collected = orders.filter((o) => o.status === "collected").reduce((s, o) => s + orderShare(o), 0);
  const pending = orders.filter((o) => o.status === "readyForPickup").reduce((s, o) => s + orderShare(o), 0);
  pdf.setFont("helvetica", "bold").setTextColor(...BLACK).text(`Total: ${usd(collected + pending)}    Collected: ${usd(collected)}    Awaiting pickup: ${usd(pending)}`, M, y);
  y += 20;

  const cols = [
    { label: "Order", w: 82 },
    { label: "Date", w: 70 },
    { label: "Recipient", w: 120 },
    { label: "Payment", w: 110 },
    { label: "Your sales", w: 60 },
    { label: "Status", w: W - 2 * M - 442 },
  ];
  const header = () => {
    pdf.setFillColor(...BRAND).rect(M, y, W - 2 * M, 20, "F");
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
    let x = M + 6;
    for (const c of cols) {
      pdf.text(c.label, x, y + 13.5);
      x += c.w;
    }
    y += 20;
  };
  header();
  pdf.setFont("helvetica", "normal").setTextColor(...BLACK);
  orders.forEach((o, i) => {
    if (y + 18 > H - M) {
      pdf.addPage();
      y = M;
      header();
      pdf.setFont("helvetica", "normal").setTextColor(...BLACK);
    }
    if (i % 2 === 1) pdf.setFillColor(0xee, 0xf4, 0xf1).rect(M, y, W - 2 * M, 18, "F");
    const values = [o.id, dayMonthYear(o.createdAt), o.recipient?.name ?? "", viaLocalink(o) ? "Through Localink" : paymentTitle(o.payment), usd(orderShare(o)), statusLabel[o.status] ?? o.status];
    let x = M + 6;
    values.forEach((v, j) => {
      const text = pdf.splitTextToSize(safe(v), cols[j].w - 8)[0] ?? "";
      pdf.text(text, x, y + 12.5);
      x += cols[j].w;
    });
    y += 18;
  });
  if (!orders.length) pdf.setTextColor(...GREY).text("No orders this month.", M + 6, y + 14);
  return pdf.output("blob");
}

/** A plain receipt of the order, as the shop sees it (no QR or PIN). */
export async function receiptPdf(o: OrderDoc, shop?: ShopDoc): Promise<Blob> {
  const pdf = await newPdf("a5", `Localink receipt ${o.id}`);
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 28;
  let y = M + 14;
  const room = (h: number) => {
    if (y + h > H - M) {
      pdf.addPage();
      y = M + 10;
    }
  };
  const line = () => {
    room(14);
    pdf.setDrawColor(0xbd, 0xbd, 0xbd).line(M, y, W - M, y);
    y += 14;
  };
  const row = (a: string, b: string, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
    room(16);
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(10);
    pdf.setTextColor(...(opts.color ?? GREY)).text(safe(a), M, y);
    pdf.setTextColor(...(opts.color ?? BLACK)).text(safe(b), W - M, y, { align: "right" });
    y += 15;
  };

  pdf.setFont("helvetica", "bold").setFontSize(20).setTextColor(...BRAND).text("Localink", M, y);
  pdf.setFontSize(12).setTextColor(...GREY).text("RECEIPT", W - M, y, { align: "right" });
  y += 12;
  line();
  row("Order", `#${o.id}`);
  row("Date", dayMonthYear(o.createdAt));
  row("Recipient", o.recipient?.name ?? "");
  row("Sent by", o.senderName);
  y += 4;
  const place = pickupPlace(o, shop);
  pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(...BLACK).text(safe(shop?.name ?? "Shop"), M, y);
  y += 13;
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GREY);
  for (const t of pdf.splitTextToSize(safe(`${place.name} - ${[place.standNo, place.address].filter(Boolean).join(" · ")}, ${place.suburb}, ${place.city}`), W - 2 * M)) {
    room(12);
    pdf.text(t, M, y);
    y += 12;
  }
  if (shop?.hours) {
    pdf.text(pdf.splitTextToSize(safe(shop.hours), W - 2 * M)[0], M, y);
    y += 12;
  }
  y += 2;
  line();
  for (const i of o.items) row(`${i.qty} x ${i.name}`, usd(i.qty * i.unitPrice), { color: BLACK });
  line();
  const subtotal = o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  row("Subtotal", usd(subtotal));
  if (o.discount) row(o.promoLabel || "Shop offer", `-${usd(o.discount)}`);
  if (o.runnerFee) row("Doorstep runner", usd(o.runnerFee));
  if (o.serviceFee) row("Localink service fee", usd(o.serviceFee));
  if (o.localinkDiscount) row(o.localinkLabel || "Localink discount", `-${usd(o.localinkDiscount)}`);
  row("Total paid", usd(orderTotal(o)), { bold: true, color: BRAND });
  row("Payment", `${paymentTitle(o.payment)} · ${paymentStatusText[paymentStatusOf(o)]}`);
  return pdf.output("blob");
}
