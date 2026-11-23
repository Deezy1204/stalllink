"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { Badge, BottomBar, Button, Card, PageHeader, Spinner, useToast } from "@/components/ui";
import { productCategoryLabel, productPhotos, variationLabel } from "@/lib/catalog";
import { importProducts } from "@/lib/merchant";
import { PLAN_LABEL, planOf, productLimit } from "@/lib/plans";
import { MAX_PRODUCT_BYTES, MAX_ROWS, parseProducts, PRODUCT_COLUMNS, TEMPLATE_URL, type ImportResult } from "@/lib/productImport";
import { usd } from "@/lib/types";
import { readSpreadsheet, SpreadsheetError } from "@/lib/xlsx";

const STEPS = [
  <>Open the <b>Products</b> sheet. Do not rename it, and do not change, move or delete its first row (the column names).</>,
  <>Write <b>one row for each size</b> you sell. A product in 3 sizes takes 3 rows with exactly the same product name.</>,
  <>Required (marked *): Product name, Category, Size, Unit, Price USD (one item, e.g. 4.50, no $ sign) and Stock. Category, Unit and Available have drop-down lists.</>,
  <>Description and photos are only needed on a product&apos;s first row.</>,
  <><b>Photos:</b> paste a web link (https://…) in Image URL 1–4 if you have one. Google Drive links work when the file is shared with &quot;Anyone with the link&quot;. No photos? Leave them empty and add photos later on each product.</>,
  <><b>Available:</b> Yes to sell it now, No to keep it saved but hidden. Empty means Yes.</>,
  <>A product name your shop already has <b>updates</b> that product: its sizes, prices and stock become the file&apos;s. Its bulk prices and discount are kept; its description and photos change only if you fill them in.</>,
  <>Save as <b>Excel Workbook (.xlsx)</b>. Google Sheets: File › Download › Microsoft Excel. Up to {MAX_ROWS.toLocaleString()} rows per upload.</>,
];

/** Many products at once from LocalinkGo's Excel template, with a preview before anything is saved. */
export default function BulkUploadPage() {
  const { shop, loaded, config } = useMerchant();
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="list products" />;

  async function choose(file: File | undefined) {
    if (!file || !shop) return;
    setReading(true);
    setFileName(file.name);
    try {
      if (file.size > 10 * 1024 * 1024) throw new SpreadsheetError("That file is over 10 MB. Remove pictures pasted into it: photo links are enough.");
      setResult(parseProducts(await readSpreadsheet(file), shop));
    } catch (e) {
      setResult({ products: [], issues: [], productBytes: 0, fileError: e instanceof SpreadsheetError ? e.message : "This file could not be read. Save it as an Excel Workbook (.xlsx) from the LocalinkGo template and try again." });
    } finally {
      setReading(false);
    }
  }

  async function upload(r: ImportResult) {
    if (!shop) return;
    setSaving(true);
    try {
      await importProducts(shop.id, r.products.map((p) => p.product));
      const added = r.products.filter((p) => p.isNew).length;
      const updated = r.products.length - added;
      toast([added && `${added} product${added === 1 ? "" : "s"} added`, updated && `${updated} updated`].filter(Boolean).join(", ") + ".");
      router.push("/merchant/products");
    } catch (e) {
      toast(`Could not save the products: ${(e as Error).message}`, "error");
      setSaving(false);
    }
  }

  const r = result;
  const skipped = r?.issues.filter((i) => i.skipped) ?? [];
  const notes = r?.issues.filter((i) => !i.skipped) ?? [];
  const added = r?.products.filter((p) => p.isNew).length ?? 0;
  const tooBig = !!r && r.productBytes > MAX_PRODUCT_BYTES;
  const canUpload = !!r && !r.fileError && r.products.length > 0 && !tooBig;
  // What buyers will see on the plan once uploaded.
  const plan = planOf(shop);
  const limit = productLimit(plan, config.limits);
  const byId = new Map((r?.products ?? []).map((p) => [p.product.id, p.product]));
  const after = [...(shop.products ?? []).map((p) => byId.get(p.id) ?? p), ...(r?.products ?? []).filter((p) => p.isNew).map((p) => p.product)];
  const live = after.filter((p) => p.available !== false).length;
  const hidden = r && limit != null ? Math.max(live - limit, 0) : 0;

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <Link href="/merchant/products" className="text-sm font-semibold text-brand hover:underline">‹ Products</Link>
      <PageHeader title="Bulk upload" subtitle={`${shop.name} · add or update many products from one spreadsheet`} />

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name="box" className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">1. Download the template</h2>
            <p className="text-sm text-ink-3">
              Everyone uses the same LocalinkGo template. Files in any other layout are refused, so start from this one and copy your products into it. It has a <b>How to use</b> sheet and a filled-in <b>Example</b>.
            </p>
          </div>
          <a href={TEMPLATE_URL} download className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm shadow-brand/20 hover:bg-brand-600">
            Download template (.xlsx)
          </a>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-bold">2. Fill it in</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand">{i + 1}</span>
              <span className="text-ink-2">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-ink-3">Columns, in this order: {PRODUCT_COLUMNS.join(" · ")}</p>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-bold">3. Upload it</h2>
        <p className="text-sm text-ink-3">You see every product before anything is saved, with any rows that need fixing.</p>
        <input ref={input} type="file" accept=".xlsx,.csv,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        <Button className="mt-3" loading={reading} onClick={() => input.current?.click()}>{r ? "Choose another file" : "Choose the filled-in file"}</Button>
      </Card>

      {r && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-ink-3">{fileName}</p>
          {r.fileError ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{r.fileError}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">{added} new</Badge>
                {r.products.length - added > 0 && <Badge tone="brand">{r.products.length - added} updated</Badge>}
                {skipped.length > 0 && <Badge tone="danger">{skipped.length} row{skipped.length === 1 ? "" : "s"} to fix</Badge>}
              </div>
              {tooBig && (
                <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  That is more than one shop can hold ({Math.round(r.productBytes / 1024)} KB of {MAX_PRODUCT_BYTES / 1024} KB). Shorten descriptions, use fewer photo links, or upload fewer products.
                </p>
              )}
              {hidden > 0 && (
                <Link href="/merchant/plan" className="mt-3 block rounded-2xl bg-accent-50 px-4 py-3 text-sm text-accent-800 hover:bg-accent/15">
                  {PLAN_LABEL[plan]} shows buyers {limit} products. Everything is saved, but {hidden} will be hidden from buyers until you upgrade your plan. ›
                </Link>
              )}
              {skipped.length > 0 && (
                <Card className="mt-4 p-4">
                  <h3 className="mb-2 text-sm font-bold">Rows left out: fix them in the file and upload it again</h3>
                  <ul className="space-y-1 text-sm text-red-800">
                    {skipped.slice(0, 100).map((i) => <li key={`${i.row}-${i.message}`}>Row {i.row}: {i.message}</li>)}
                  </ul>
                  {skipped.length > 100 && <p className="mt-1 text-sm">…and {skipped.length - 100} more.</p>}
                </Card>
              )}
              {notes.length > 0 && (
                <Card className="mt-4 p-4">
                  <h3 className="mb-2 text-sm font-bold">Notes</h3>
                  <ul className="space-y-1 text-sm text-ink-2">
                    {notes.slice(0, 50).map((i) => <li key={`${i.row}-${i.message}`}>Row {i.row}: {i.message}</li>)}
                  </ul>
                </Card>
              )}
              {r.products.length > 0 && (
                <>
                  <h3 className="mb-2 mt-6 font-bold">What will be uploaded</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {r.products.slice(0, 300).map(({ product: p, isNew }) => {
                      const photo = productPhotos(p)[0];
                      return (
                        <Card key={p.id} className="flex items-center gap-3 p-3">
                          {photo ? (
                            <img src={photo} alt="" className="size-14 shrink-0 rounded-xl bg-surface-2 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
                          ) : (
                            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="cart" className="size-6" strokeWidth={1.6} /></span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{p.name}</span>
                            <span className="block truncate text-xs text-ink-3">{productCategoryLabel(p.category)} · {(p.variations ?? []).map((v) => `${variationLabel(v)} ${usd(v.price)}`).join(" · ")}</span>
                          </span>
                          <span className="flex flex-col items-end gap-1">
                            <Badge tone={isNew ? "success" : "brand"}>{isNew ? "New" : "Update"}</Badge>
                            {p.available === false && <span className="text-[11px] text-ink-3">Hidden</span>}
                          </span>
                        </Card>
                      );
                    })}
                  </div>
                  {r.products.length > 300 && <p className="mt-2 text-sm text-ink-3">…and {r.products.length - 300} more.</p>}
                </>
              )}
            </>
          )}
        </div>
      )}

      {canUpload && r && (
        <BottomBar width="max-w-4xl">
          <p className="min-w-0 flex-1 text-sm leading-snug text-ink-3">
            <b className="text-ink">{r.products.length} product{r.products.length === 1 ? "" : "s"} ready</b>
            {skipped.length ? <span className="block sm:inline"> · {skipped.length} row{skipped.length === 1 ? "" : "s"} left out</span> : null}
          </p>
          <Button className="shrink-0 sm:w-56" loading={saving} onClick={() => upload(r)}>Upload {r.products.length} product{r.products.length === 1 ? "" : "s"}</Button>
        </BottomBar>
      )}
    </div>
  );
}
