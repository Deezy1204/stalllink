// LocalinkGo's product upload template, read the same way as the app
// (LocalinkGo/lib/data/product_import.dart): one row per size on the
// "Products" sheet, exactly the template's columns. Products with a name the
// shop already has are updated (their sizes, prices and stock become the
// sheet's; bulk prices on sizes that stay and any discount are kept).

import { amount, MEASURE_UNITS, PRODUCT_CATEGORIES, variationLabel } from "./catalog";
import type { SheetTable } from "./xlsx";
import { cents, type Product, type ShopDoc, type Variation } from "./types";

/** Served from public/templates (the same file is in the app's assets). */
export const TEMPLATE_URL = "/templates/LocalinkGo-products-template.xlsx";
export const TEMPLATE_SHEET = "Products";
export const PRODUCT_COLUMNS = [
  "Product name *",
  "Category *",
  "Size *",
  "Unit *",
  "Size label",
  "Price USD *",
  "Stock *",
  "Description",
  "Image URL 1",
  "Image URL 2",
  "Image URL 3",
  "Image URL 4",
  "Available",
];
export const MAX_ROWS = 1000;
/** A shop is one Firestore document (1 MiB at most), products included: leave room for the rest. */
export const MAX_PRODUCT_BYTES = 900 * 1024;

export interface ImportIssue {
  /** 0 = the whole file. */
  row: number;
  message: string;
  /** The row was left out (otherwise it was uploaded, with this note). */
  skipped: boolean;
}

export interface ImportedProduct {
  product: Product;
  isNew: boolean;
  rows: number[];
}

export interface ImportResult {
  products: ImportedProduct[];
  issues: ImportIssue[];
  fileError?: string;
  productBytes: number;
}

const header = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim();
const keyOf = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

const UNITS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const u of MEASURE_UNITS) {
    m[u.id] = u.id;
    m[u.short.toLowerCase()] = u.id;
    if ("metric" in u) {
      m[u.metric] = u.id;
      m[u.metric.slice(0, -1)] = u.id;
    } else m[`${u.short}s`] = u.id;
  }
  Object.assign(m, {
    kgs: "kg", kilo: "kg", kilos: "kg", gram: "g", grams: "g", gr: "g",
    litre: "l", liter: "l", liters: "l", ltr: "l", ltrs: "l", lt: "l", milliliter: "ml", milliliters: "ml",
    pc: "piece", pcs: "piece", each: "piece", item: "piece", items: "piece",
    boxes: "box", bunches: "bunch", loaves: "loaf", dozens: "dozen", packet: "pack", packets: "pack", can: "tin", cans: "tin",
  });
  return m;
})();

export const categoryOf = (v: string) => PRODUCT_CATEGORIES.find((c) => c.label.toLowerCase() === v.trim().toLowerCase() || c.id === v.trim().toLowerCase())?.id;
export const unitOf = (v: string) => UNITS[v.trim().toLowerCase().replace(/\./g, "")];

/** "$2.50", "2.5", "USD 2,50", "1,250.00" → the number (null if it is not one). */
export function numberOf(v: string): number | null {
  let s = v.trim().toUpperCase().replace(/US\$|USD|\$|\s/g, "");
  if (!s) return null;
  s = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) ? s.replace(/,/g, "") : s.replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** A direct image link, or null. Google Drive share links become links to the image itself. */
export function imageUrlOf(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.hostname === "drive.google.com") {
    const id = /\/file\/d\/([\w-]+)/.exec(u.pathname)?.[1] ?? u.searchParams.get("id");
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  }
  return s;
}

const yesNo = (v: string): boolean | null =>
  ({ yes: true, y: true, true: true, "1": true, available: true, show: true, no: false, n: false, false: false, "0": false, hidden: false, hide: false })[v.trim().toLowerCase()] ?? null;

interface Row {
  name: string;
  category: string;
  size: number;
  unit: string;
  label: string;
  price: number;
  stock: number;
  description: string;
  images: string[];
  available: boolean | null;
}

function readRow(n: number, c: string[], issues: ImportIssue[]): Row | null {
  const at = (i: number) => (c[i] ?? "").trim();
  const problems: string[] = [];
  const name = at(0).replace(/\s+/g, " ");
  if (!name) problems.push("the product name is missing");
  if (name.length > 100) problems.push("the product name is longer than 100 characters");
  const category = categoryOf(at(1));
  if (!category) problems.push(at(1) ? `"${at(1)}" is not a category (use ${PRODUCT_CATEGORIES.map((x) => x.label).join(", ")})` : "the category is missing");
  const size = numberOf(at(2));
  if (size == null || size <= 0) problems.push(at(2) ? `"${at(2)}" is not a size (e.g. 2 or 0.5)` : "the size is missing");
  const unit = unitOf(at(3));
  if (!unit) problems.push(at(3) ? `"${at(3)}" is not a unit (use ${MEASURE_UNITS.map((u) => u.short).join(", ")})` : "the unit is missing");
  const price = numberOf(at(5));
  if (price == null || price <= 0) problems.push(at(5) ? `"${at(5)}" is not a price in US dollars (e.g. 4.50)` : "the price is missing");
  else if (price > 100000) problems.push("the price is over $100,000");
  const stock = numberOf(at(6));
  if (stock == null || stock < 0 || !Number.isInteger(stock) || stock > 100000) problems.push(at(6) ? `"${at(6)}" is not a whole number of items in stock` : "the stock is missing (0 if you have none now)");
  const available = yesNo(at(12));
  if (at(12) && available == null) problems.push("Available must be Yes or No");
  if (problems.length) {
    issues.push({ row: n, message: `${name ? `${name}: ` : ""}${problems.join("; ")}.`, skipped: true });
    return null;
  }
  let label = at(4);
  if (label.length > 40) {
    label = label.slice(0, 40).trim();
    issues.push({ row: n, message: "the size label was cut to 40 characters.", skipped: false });
  }
  let description = at(7);
  if (description.length > 300) {
    description = description.slice(0, 300).trim();
    issues.push({ row: n, message: "the description was cut to 300 characters.", skipped: false });
  }
  const images: string[] = [];
  for (let i = 8; i <= 11; i++) {
    if (!at(i)) continue;
    const url = imageUrlOf(at(i));
    if (!url) issues.push({ row: n, message: `"${at(i).length > 40 ? `${at(i).slice(0, 40)}…` : at(i)}" in ${PRODUCT_COLUMNS[i]} is not a web link, so it was left out. Add the photo later.`, skipped: false });
    else if (!images.includes(url)) images.push(url);
  }
  return { name, category: category!, size: Math.round(size! * 1000) / 1000, unit: unit!, label, price: cents(price!), stock: stock!, description, images, available };
}

const subtitleOf = (description: string, sizes: Variation[]) => (description.trim() ? description.trim().split(".")[0].trim() : sizes.map(variationLabel).join(" · "));

export function parseProducts(sheets: SheetTable[], shop: ShopDoc, now = Date.now()): ImportResult {
  const empty = (fileError: string): ImportResult => ({ products: [], issues: [], fileError, productBytes: 0 });
  const sheet = sheets.find((s) => s.name.trim().toLowerCase() === TEMPLATE_SHEET.toLowerCase()) ?? (sheets.length === 1 ? sheets[0] : undefined);
  if (!sheet) return empty(`This file has no "${TEMPLATE_SHEET}" sheet. Download the LocalinkGo template and copy your products into its Products sheet.`);
  const rows = sheet.rows;
  const headerAt = rows.findIndex((r) => r.some((c) => c.trim()));
  const expected = PRODUCT_COLUMNS.map(header);
  const got = headerAt < 0 ? [] : rows[headerAt].slice(0, expected.length).map(header);
  if (got.length < expected.length || expected.some((h, i) => got[i] !== h)) {
    return empty(`This file does not use the LocalinkGo template: its first row must be the template's column names (${PRODUCT_COLUMNS.join(", ")}). Download the template and copy your products into it without changing the columns.`);
  }
  const data: [number, string[]][] = [];
  for (let i = headerAt + 1; i < rows.length; i++) if (rows[i].some((c) => c.trim())) data.push([i + 1, [...rows[i], ...Array(expected.length).fill("")].slice(0, expected.length)]);
  if (!data.length) return empty("The Products sheet is empty. Fill in one row for each size you sell, under the column names.");
  if (data.length > MAX_ROWS) return empty(`That is ${data.length} rows; one upload takes up to ${MAX_ROWS}. Split the file and upload it in parts.`);

  const issues: ImportIssue[] = [];
  const groups = new Map<string, [number, Row][]>();
  for (const [n, c] of data) {
    const r = readRow(n, c, issues);
    if (r) groups.set(keyOf(r.name), [...(groups.get(keyOf(r.name)) ?? []), [n, r]]);
  }

  const stamp = now * 1000;
  const existing = new Map<string, Product>();
  for (const p of [...(shop.products ?? [])].reverse()) existing.set(keyOf(p.name), p);
  const products: ImportedProduct[] = [];
  let index = 0;
  for (const group of groups.values()) {
    const [firstRow, first] = group[0];
    const old = existing.get(keyOf(first.name));
    const sizes: Variation[] = [];
    const used: number[] = [];
    let description: string | null = null;
    let images: string[] | null = null;
    let available: boolean | null = null;
    for (const [n, r] of group) {
      if (r.category !== first.category) issues.push({ row: n, message: `${r.name} has another category on row ${firstRow}; ${PRODUCT_CATEGORIES.find((c) => c.id === first.category)?.label} is used.`, skipped: false });
      if (sizes.some((v) => v.unit === r.unit && Math.abs((v.size ?? 0) - r.size) < 1e-9)) {
        issues.push({ row: n, message: `${r.name} already has a ${amount(r.unit, r.size)} size on an earlier row.`, skipped: true });
        continue;
      }
      const keep = old?.variations?.find((v) => v.unit === r.unit && v.size != null && Math.abs(v.size - r.size) < 1e-9);
      sizes.push({ id: keep?.id ?? `v${stamp}${index}_${sizes.length}`, name: r.label, price: r.price, size: r.size, unit: r.unit, stock: r.stock, note: keep?.note ?? "", badge: keep?.badge ?? null, bulk: keep?.bulk ?? [] });
      used.push(n);
      if (description == null && r.description) description = r.description;
      if (images == null && r.images.length) images = r.images;
      if (available == null) available = r.available;
    }
    if (!sizes.length) continue;
    const from = Math.min(...sizes.map((v) => v.price));
    const stock = sizes.reduce((s, v) => s + v.stock, 0);
    const product: Product = old
      ? {
          ...old,
          name: first.name,
          subtitle: description == null ? old.subtitle : subtitleOf(description, sizes),
          category: first.category,
          price: from,
          stock,
          imageAsset: images?.[0] ?? old.imageAsset ?? "",
          images: images ?? old.images ?? [],
          description: description ?? old.description ?? "",
          variations: sizes,
          available: available ?? old.available !== false,
        }
      : {
          id: `p${stamp}${index}`,
          stallId: shop.id,
          name: first.name,
          subtitle: subtitleOf(description ?? "", sizes),
          category: first.category,
          price: from,
          stock,
          imageAsset: images?.[0] ?? "",
          images: images ?? [],
          description: description ?? "",
          variations: sizes,
          tag: null,
          unitLabel: "unit",
          available: available ?? true,
          features: [],
        };
    products.push({ product, isNew: !old, rows: used });
    index++;
  }
  const byId = new Map(products.map((p) => [p.product.id, p.product]));
  const after = [...(shop.products ?? []).map((p) => byId.get(p.id) ?? p), ...products.filter((p) => p.isNew).map((p) => p.product)];
  const productBytes = new TextEncoder().encode(JSON.stringify(after)).length;
  issues.sort((a, b) => a.row - b.row);
  return { products, issues, productBytes };
}
