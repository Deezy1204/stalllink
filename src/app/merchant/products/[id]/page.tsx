"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { PhotoSlots } from "@/components/merchant/Photos";
import { Button, Card, Empty, Input, Pill, Select, Spinner, Switch, Textarea, useConfirm, useToast } from "@/components/ui";
import { amount, MAX_PRODUCT_PHOTOS, MEASURE_UNITS, PRODUCT_CATEGORIES, fmtNumber, productPhotos, unitMenuLabel, variationLabel, zar } from "@/lib/catalog";
import { deleteProduct, saveProduct } from "@/lib/merchant";
import { isActive, shortDate, usd, type Product, type Variation } from "@/lib/types";

interface BulkForm {
  key: string;
  id?: string;
  name: string;
  count: string;
  price: string;
}

interface SizeForm {
  key: string;
  id?: string;
  size: string;
  unit: string;
  name: string;
  price: string;
  stock: string;
  // Not edited here, but kept when the size is saved.
  note: string;
  badge: string | null;
  bulk: BulkForm[];
}

interface Draft {
  name: string;
  desc: string;
  category: string;
  images: string[];
  available: boolean;
  sizes: SizeForm[];
}

const key = () => Math.random().toString(36).slice(2);
const blankSize = (unit = "kg"): SizeForm => ({ key: key(), size: "", unit, name: "", price: "", stock: "20", note: "", badge: null, bulk: [] });

/** Older sizes were a single name such as "10kg Family Bag" or "750ml Bottle". */
const LEGACY = /^(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b\s*(.*)$/i;

function sizeFrom(v: Variation): SizeForm {
  let size = v.size ?? null;
  let unit = v.unit ?? null;
  let name = v.name;
  const m = size == null ? LEGACY.exec(v.name.trim()) : null;
  if (m) {
    size = Number(m[1]);
    unit = m[2].toLowerCase();
    name = m[3];
  }
  return {
    key: key(),
    id: v.id,
    size: size == null ? "" : fmtNumber(size),
    unit: unit ?? "kg",
    name,
    price: v.price.toFixed(2),
    stock: String(v.stock),
    note: v.note ?? "",
    badge: v.badge ?? null,
    bulk: (v.bulk ?? []).map((b) => ({ key: key(), id: b.id, name: b.name, count: String(b.count), price: b.price.toFixed(2) })),
  };
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.trim()));
const sizeMeasure = (s: SizeForm) => (num(s.size) > 0 ? amount(s.unit, num(s.size)) : "");

function draftKey(uid: string, id: string) {
  return `localink.draft.product.${uid}.${id}`;
}
function readDraft(k: string): Draft | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/** Add or edit a product. Every product has at least one size, measured in a unit, with optional bulk prices. */
export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { user, shop, loaded } = useMerchant();
  const [form, setForm] = useState<Draft | null>(null);
  const [restored, setRestored] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reset, setReset] = useState(0);
  const original = useRef<Product | null>(null);
  const shopId = useRef<string | null>(null);
  /** Only keep a draft once the merchant has changed something. */
  const dirty = useRef(false);

  const existing = isNew ? null : shop?.products?.find((p) => p.id === id) ?? null;

  // Fill the form once the shop has loaded (and again if the merchant switches shop).
  useEffect(() => {
    if (!loaded || !shop || shopId.current === shop.id) return;
    shopId.current = shop.id;
    original.current = existing;
    const p = existing;
    const fresh: Draft = p
      ? {
          name: p.name,
          desc: p.description ?? "",
          category: p.category ?? "grains",
          images: productPhotos(p).slice(0, MAX_PRODUCT_PHOTOS),
          available: p.available !== false,
          // Products saved before sizes existed had one price and stock.
          sizes: p.variations?.length ? p.variations.map(sizeFrom) : [{ ...blankSize(), price: p.price.toFixed(2), stock: String(p.stock) }],
        }
      : { name: "", desc: "", category: "grains", images: [], available: true, sizes: [blankSize()] };
    const draft = readDraft(draftKey(user.uid, id));
    setForm(draft ?? fresh);
    setRestored(!!draft);
  }, [loaded, shop, existing, user.uid, id, reset]);

  // Keep what is typed, so a closed tab or a dropped connection loses nothing.
  useEffect(() => {
    if (!form || !dirty.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(user.uid, id), JSON.stringify(form));
      } catch {
        // Storage full or blocked: the form still works, it just is not kept.
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form, user.uid, id]);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="list products" />;
  if (!isNew && !existing && !original.current) return <Empty title="Product not found" message="It may have been deleted." action={<Link href="/merchant/products" className="font-semibold text-brand hover:underline">Back to products</Link>} />;
  if (!form) return <div className="flex justify-center py-20"><Spinner /></div>;

  const set = (patch: Partial<Draft>) => {
    dirty.current = true;
    setForm((f) => (f ? { ...f, ...patch } : f));
  };
  const setSize = (k: string, patch: Partial<SizeForm>) => set({ sizes: form.sizes.map((s) => (s.key === k ? { ...s, ...patch } : s)) });
  const setBulk = (s: SizeForm, k: string, patch: Partial<BulkForm>) => setSize(s.key, { bulk: s.bulk.map((b) => (b.key === k ? { ...b, ...patch } : b)) });

  // ---- validation (same rules as the app) ----
  const err = {
    name: !form.name.trim() ? "Enter a product name" : null,
    size: (s: SizeForm) => (!(num(s.size) > 0) ? "Enter the size" : null),
    price: (v: string) => (!(num(v) > 0) ? "Enter a price" : null),
    stock: (v: string) => (!/^\d+$/.test(v.trim()) ? "Enter stock" : null),
    bulkName: (b: BulkForm) => (!b.name.trim() ? "Name it" : null),
    count: (b: BulkForm) => (!/^\d+$/.test(b.count.trim()) || Number(b.count) < 2 ? "2 or more" : null),
  };
  const valid =
    !err.name &&
    form.sizes.every((s) => !err.size(s) && !err.price(s.price) && !err.stock(s.stock) && s.bulk.every((b) => !err.bulkName(b) && !err.count(b) && !err.price(b.price)));
  const show = <T,>(v: T) => (showErrors ? v : null);

  async function save() {
    setShowErrors(true);
    if (!valid || !form || !shop) {
      toast("Check the highlighted fields.", "error");
      return;
    }
    const stamp = Date.now() * 1000;
    const variations: Variation[] = form.sizes.map((s, i) => {
      const fallback = `v${stamp}${i}`;
      return {
        id: s.id ?? fallback,
        name: s.name.trim(),
        size: num(s.size),
        unit: s.unit,
        price: num(s.price),
        stock: Number(s.stock),
        note: s.note,
        badge: s.badge,
        bulk: s.bulk.map((b, j) => ({ id: b.id ?? `${fallback}b${j}`, name: b.name.trim(), count: Number(b.count), price: num(b.price) })),
      };
    });
    const from = Math.min(...variations.map((v) => v.price));
    const stock = variations.reduce((a, v) => a + v.stock, 0);
    const desc = form.desc.trim();
    const product: Product = original.current
      ? {
          ...original.current,
          // The live discount: it may have been changed on Discounts & offers while this form was open.
          discount: existing ? (existing.discount ?? null) : (original.current.discount ?? null),
          name: form.name.trim(),
          description: desc,
          price: from,
          stock,
          category: form.category,
          imageAsset: form.images[0] ?? "",
          images: form.images,
          available: form.available,
          variations,
        }
      : {
          id: `p${stamp}`,
          stallId: shop.id,
          name: form.name.trim(),
          subtitle: desc ? desc.split(".")[0] : variations.map(variationLabel).join(" · "),
          category: form.category,
          price: from,
          stock,
          imageAsset: form.images[0] ?? "",
          images: form.images,
          description: desc,
          variations,
          tag: null,
          unitLabel: "unit",
          available: form.available,
          features: [],
        };
    setSaving(true);
    try {
      await saveProduct(shop.id, product);
      try {
        localStorage.removeItem(draftKey(user.uid, id));
      } catch {}
      toast(original.current ? "Product updated." : "Product published to your shop!");
      router.push("/merchant/products");
    } catch (e) {
      toast(`Could not save the product: ${(e as Error).message}. What you typed is kept on this device.`, "error");
      setSaving(false);
    }
  }

  async function remove() {
    const p = original.current;
    if (!p || !shop) return;
    if (!(await confirm({ title: "Delete product?", message: `This removes ${p.name} from your shop.`, confirm: "Delete", danger: true }))) return;
    try {
      await deleteProduct(shop.id, p.id);
      try {
        localStorage.removeItem(draftKey(user.uid, id));
      } catch {}
      toast("Product deleted.");
      router.push("/merchant/products");
    } catch (e) {
      toast(`Could not delete it: ${(e as Error).message}`, "error");
    }
  }

  function startOver() {
    try {
      localStorage.removeItem(draftKey(user.uid, id));
    } catch {}
    dirty.current = false;
    shopId.current = null;
    setForm(null);
    setRestored(false);
    setReset((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <Link href="/merchant/products" className="text-sm font-semibold text-brand hover:underline">‹ Products</Link>
      <div className="mb-5 mt-2 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{original.current ? "Edit product" : "Add product"}</h1>
          <p className="text-sm text-ink-3">{shop.name}{shop.standNo ? ` · ${shop.standNo}` : ""} · {shop.city}</p>
        </div>
        {original.current && <Button variant="danger" onClick={remove}>Delete</Button>}
      </div>

      {restored && (
        <p className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-mint-100 px-4 py-2.5 text-sm text-mint-800">
          We restored what you typed last time.
          <button onClick={startOver} className="font-semibold hover:underline">Start over</button>
        </p>
      )}

      <Card className="space-y-5 p-5">
        <Input label="Product name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Super White Roller Maize Meal" error={show(err.name)} />
        <div>
          <p className="mb-2 text-sm font-semibold">Category</p>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_CATEGORIES.map((c) => <Pill key={c.id} selected={form.category === c.id} onClick={() => set({ category: c.id })}>{c.label}</Pill>)}
          </div>
        </div>
        <div>
          <p className="mb-2 flex justify-between text-sm font-semibold">Product photos <span className="font-normal text-ink-3">Square photos look best · the first is the cover</span></p>
          <PhotoSlots photos={form.images} max={MAX_PRODUCT_PHOTOS} firstLabel="Cover" onChange={(images) => set({ images })} />
        </div>
        <Textarea
          label="Description & pickup notes"
          value={form.desc}
          maxLength={300}
          onChange={(e) => set({ desc: e.target.value })}
          placeholder="Grade A finely milled super white maize meal…"
          hint={`Recipients see this during checkout · ${form.desc.length}/300`}
        />
      </Card>

      <div className="mb-2 mt-6 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-bold">Sizes & prices</h2>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">{form.sizes.length} size{form.sizes.length === 1 ? "" : "s"}</span>
      </div>
      <p className="mb-3 text-sm text-ink-3">Add each size you sell (2 kg, 5 kg, 500 g…) with its price in USD. Add bulk prices such as a case of 10.</p>

      <div className="space-y-3">
        {form.sizes.map((s, i) => {
          const m = sizeMeasure(s);
          const single = num(s.price);
          return (
            <Card key={s.key} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold">Size {i + 1}{m && ` · ${m}`}</p>
                {form.sizes.length > 1 && <button className="text-sm font-semibold text-red-700 hover:underline" onClick={() => set({ sizes: form.sizes.filter((x) => x.key !== s.key) })}>Remove size</button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Size" inputMode="decimal" value={s.size} onChange={(e) => setSize(s.key, { size: e.target.value })} placeholder="e.g. 2" error={show(err.size(s))} />
                <Select label="Measured in" value={s.unit} onChange={(e) => setSize(s.key, { unit: e.target.value })}>
                  {MEASURE_UNITS.map((u) => <option key={u.id} value={u.id}>{unitMenuLabel(u.id)}</option>)}
                </Select>
                <div className="sm:col-span-2">
                  <Input label="Label (optional)" value={s.name} onChange={(e) => setSize(s.key, { name: e.target.value })} placeholder="e.g. Family bag, Bottle" />
                </div>
                <Input
                  label={m ? `Price per ${m}` : "Price each"}
                  prefix="$"
                  inputMode="decimal"
                  value={s.price}
                  onChange={(e) => setSize(s.key, { price: e.target.value })}
                  error={show(err.price(s.price))}
                  hint={single > 0 ? `≈ ${zar(single, shop.zarPerUsd)}` : undefined}
                />
                <Input label="In stock" inputMode="numeric" value={s.stock} onChange={(e) => setSize(s.key, { stock: e.target.value })} error={show(err.stock(s.stock))} />
              </div>

              {s.bulk.length > 0 && <p className="mb-1 mt-4 text-sm font-bold">Bulk prices</p>}
              {s.bulk.map((b) => {
                const count = Number(b.count);
                const price = num(b.price);
                const ok = /^\d+$/.test(b.count.trim()) && count >= 2 && price > 0;
                const saves = ok && single > 0 ? single * count - price : 0;
                return (
                  <div key={b.key} className="mb-2">
                    <div className="grid grid-cols-[3fr_2fr_3fr_auto] items-start gap-2">
                      <Input label="Sold as" value={b.name} onChange={(e) => setBulk(s, b.key, { name: e.target.value })} placeholder="Case" error={show(err.bulkName(b))} />
                      <Input label="Holds" inputMode="numeric" value={b.count} onChange={(e) => setBulk(s, b.key, { count: e.target.value })} placeholder="10" error={show(err.count(b))} />
                      <Input label="Price" prefix="$" inputMode="decimal" value={b.price} onChange={(e) => setBulk(s, b.key, { price: e.target.value })} error={show(err.price(b.price))} />
                      <button className="group mt-8 rounded-lg p-2 text-red-700 hover:bg-red-50" onClick={() => setSize(s.key, { bulk: s.bulk.filter((x) => x.key !== b.key) })} aria-label="Remove bulk price">
                        <Icon name="x" className="size-4" strokeWidth={2.2} />
                      </button>
                    </div>
                    {ok && (
                      <p className="mt-1 text-xs font-medium text-mint-800">
                        {b.name.trim() || "Bulk"} of {count} {m ? `× ${m}` : "items"} · {usd(price / count)} each{saves >= 0.01 ? ` · buyer saves ${usd(saves)}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
              <button className="mt-2 text-sm font-semibold text-brand hover:underline" onClick={() => setSize(s.key, { bulk: [...s.bulk, { key: key(), name: "Case", count: "", price: "" }] })}>
                + Add bulk price (case, carton…)
              </button>
            </Card>
          );
        })}
      </div>
      <Button variant="secondary" className="mt-3 w-full" onClick={() => set({ sizes: [...form.sizes, blankSize(form.sizes.at(-1)?.unit)] })}>+ Add another size</Button>

      {!isNew && (
        <Link href="/merchant/promotions" className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm hover:bg-surface">
          <Icon name="gift" className="size-5 text-accent" />
          <span className="flex-1">
            <b className="block">{isActive(existing?.discount) ? `${existing!.discount!.percent}% off${existing!.discount!.label ? ` · ${existing!.discount!.label}` : ""}` : "Put this product on sale"}</b>
            <span className="text-ink-3">{isActive(existing?.discount) ? (existing!.discount!.endsAt ? `Until ${shortDate(existing!.discount!.endsAt)}` : "Until you end it") : "Set discounts in Discounts & offers"}</span>
          </span>
          <span className="font-semibold text-brand">Manage ›</span>
        </Link>
      )}

      <Card className="mt-6 p-4">
        <Switch
          checked={form.available}
          onChange={(available) => set({ available })}
          label="Available for orders"
          description="Buyers abroad can order this for pickup. Turn it off to hide the product without deleting it."
        />
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-3xl gap-3 px-4 py-3">
          <Button variant="secondary" className="flex-1" onClick={() => router.push("/merchant/products")}>Cancel</Button>
          <Button className="flex-[2]" loading={saving} onClick={save}>Save product</Button>
        </div>
      </div>
    </div>
  );
}
