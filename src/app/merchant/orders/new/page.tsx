"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop } from "@/components/merchant/OrderBits";
import { Badge, Button, Card, Input, Modal, PageHeader, SearchInput, Spinner, Switch, Textarea, useToast } from "@/components/ui";
import { digitsOnly, paymentSummary, relativeDay } from "@/lib/catalog";
import { feePercentOf, planOf } from "@/lib/plans";
import {
  findCustomer,
  linesForReorder,
  listPrice,
  optionLabel,
  optionsOf,
  orderName,
  placeShopOrder,
  returningCustomers,
  sameLine,
  sellable,
  takesDirect,
  totalsFor,
  unitPrice,
  type Line,
  type ShopCustomer,
} from "@/lib/shopOrders";
import { isActive, orderTotal, paymentTitle, usd, type OrderDoc, type PaymentOption } from "@/lib/types";

interface Way {
  id: string;
  option: PaymentOption;
  toShop: boolean;
  title: string;
  sub: string;
}

const phoneOk = (p: string) => {
  const d = digitsOnly(p);
  return d.length >= 7 && d.length <= 15;
};

/**
 * The shop takes an order for a customer who phoned or came in: new, or a
 * returning customer's earlier order again. Priced, paid and collected like
 * an order placed in the app (the app's Vouchers → New order).
 */
export default function NewShopOrder() {
  const { shop, loaded, user, orders, config } = useMerchant();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [someoneElse, setSomeoneElse] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherPhone, setOtherPhone] = useState("");
  const [branchId, setBranchId] = useState("main");
  const [delivery, setDelivery] = useState(false);
  const [note, setNote] = useState("");
  const [wayId, setWayId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [finding, setFinding] = useState(false);

  const products = useMemo(() => (shop ? sellable(shop, config) : []), [shop, config]);
  const customers = useMemo(() => (shop ? returningCustomers(orders, shop.id) : []), [orders, shop]);

  // ?from=<order id>: start from an earlier order (Reorder on an order's page).
  const [startedFrom, setStartedFrom] = useState(false);
  useEffect(() => {
    if (startedFrom || !shop || !orders.length) return;
    const from = new URLSearchParams(window.location.search).get("from");
    const o = from ? orders.find((x) => x.id === from && x.stallId === shop.id) : undefined;
    setStartedFrom(true);
    if (!o) return;
    setName(o.placedBy === "shop" ? o.senderName : o.recipient.name);
    setPhone(o.placedBy === "shop" ? (o.customerPhone ?? "") : o.recipient.phone);
    setLines(linesForReorder(products, o));
  }, [startedFrom, shop, orders, products]);

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="take orders" />;

  const runner = delivery && shop.offersDelivery ? (shop.deliveryFee ?? 0) : 0;
  const t = totalsFor(shop, config, lines, runner);
  const fee = feePercentOf(planOf(shop), config);
  const returning = findCustomer(customers, phone);
  const ways: Way[] = [
    ...(takesDirect(shop) ? (shop.paymentOptions ?? []).map((p) => ({ id: p.id, option: p, toShop: true, title: paymentTitle(p), sub: [paymentSummary(p), "paid to your shop: you confirm it"].filter(Boolean).join(" · ") })) : []),
    ...config.options.map((p) => ({ id: `lnk:${p.id}`, option: p, toShop: false, title: `${paymentTitle(p)} (LocalinkGo)`, sub: [paymentSummary(p), "LocalinkGo confirms it and pays you out"].filter(Boolean).join(" · ") })),
    ...(config.onlineEnabled ? [{ id: "online", option: { id: "online", type: "other" as const, name: "Pay online", instructions: "EcoCash, InnBucks, Zimswitch or card" }, toShop: false, title: "Online (customer pays in the LocalinkGo app)", sub: "Needs a LocalinkGo account with their number" }] : []),
  ];
  const way = ways.find((w) => w.id === wayId) ?? (ways.length === 1 ? ways[0] : undefined);

  const add = (l: Line) =>
    setLines((ls) => (ls.some((x) => sameLine(x, l)) ? ls.map((x) => (sameLine(x, l) ? { ...x, qty: x.qty + l.qty } : x)) : [...ls, l]));
  const setQty = (l: Line, qty: number) => setLines((ls) => (qty <= 0 ? ls.filter((x) => !sameLine(x, l)) : ls.map((x) => (sameLine(x, l) ? { ...x, qty } : x))));

  function reorder(o: OrderDoc) {
    const next = linesForReorder(products, o);
    setLines(next);
    const missing = o.items.length - next.length;
    toast(next.length === 0 ? "None of those items are on sale any more." : missing > 0 ? `Added ${next.length} item${next.length === 1 ? "" : "s"} at today's prices; ${missing} no longer sold.` : `Added the same ${next.length} item${next.length === 1 ? "" : "s"} at today's prices.`, next.length ? undefined : "error");
  }

  function pickCustomer(c: ShopCustomer) {
    setName(c.name);
    setPhone(c.phone);
    setFinding(false);
  }

  const errors = {
    phone: !phoneOk(phone) ? "Enter the customer's phone number" : null,
    name: !name.trim() ? "Enter the customer's name" : null,
    otherName: someoneElse && !otherName.trim() ? "Enter who collects" : null,
    otherPhone: someoneElse && !phoneOk(otherPhone) ? "Enter their phone number" : null,
  };

  async function create() {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return toast("Check the highlighted fields.", "error");
    if (!lines.length) return toast("Add what the customer is buying.", "error");
    if (!way) return toast(ways.length ? "Choose how the customer pays." : "There is no way to pay yet.", "error");
    setSaving(true);
    try {
      const o = await placeShopOrder({
        uid: user.uid,
        shop: shop!,
        cfg: config,
        lines,
        customer: { name: name.trim(), phone: phone.trim() },
        collector: someoneElse ? { name: otherName.trim(), phone: otherPhone.trim() } : null,
        payment: way.option,
        toShop: way.toShop,
        delivery,
        branchId,
        note: note.trim(),
      });
      toast(`Order #${o.id} created. Send ${name.trim().split(" ")[0]} their pass.`);
      router.push(`/merchant/orders/${o.id}`);
    } catch (e) {
      toast(`Could not create the order: ${(e as Error).message}`, "error");
      setSaving(false);
    }
  }

  const show = <T,>(v: T) => (tried ? v : null);

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <Link href="/merchant/orders" className="text-sm font-semibold text-brand hover:underline">‹ Orders</Link>
      <PageHeader title="New order" subtitle={`${shop.name} · for a customer who phoned or came in`} />
      <p className="mb-4 rounded-2xl bg-brand-50/60 px-4 py-3 text-sm text-ink-2">
        It works like an order placed in the app: {takesDirect(shop) ? "the customer pays you or LocalinkGo" : `the customer pays LocalinkGo${fee > 0 ? ` (with the ${fee}% service fee)` : ""}`}, you can send their proof of payment, and they collect with a QR pass.
      </p>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Customer</h2>
              {customers.length > 0 && <button className="text-sm font-semibold text-brand hover:underline" onClick={() => setFinding(true)}>Returning customer…</button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Phone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263 77 123 4567" inputMode="tel" error={show(errors.phone)} hint="Their LocalinkGo account gets the order and pass if it has this number." />
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={show(errors.name)} />
            </div>
            {returning && (
              <div className="rounded-2xl bg-mint-100 p-4 text-sm text-mint-800">
                <p className="font-bold">Bought here before · {returning.orders.length} order{returning.orders.length === 1 ? "" : "s"} · last {relativeDay(returning.orders[0].createdAt)}</p>
                <ul className="mt-2 space-y-2">
                  {returning.orders.slice(0, 3).map((o) => (
                    <li key={o.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">#{o.id} · {relativeDay(o.createdAt)} · {usd(orderTotal(o))}</span>
                        <span className="block truncate text-ink-2">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</span>
                      </span>
                      <Button variant="secondary" onClick={() => reorder(o)}>Reorder</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Items ({lines.length})</h2>
              <Button variant="secondary" onClick={() => setPicking(true)}>+ Add items</Button>
            </div>
            {lines.length === 0 ? (
              <p className="text-sm text-ink-3">{returning ? "Add items, or tap Reorder on one of their orders above." : "Add what the customer is buying from your catalogue."}</p>
            ) : (
              <ul className="divide-y divide-line">
                {lines.map((l) => (
                  <li key={`${l.product.id}-${l.variation?.id}-${l.bulk?.id}`} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{orderName(l)}</span>
                      <span className="block text-ink-3">
                        {usd(unitPrice(l))} each{unitPrice(l) < listPrice(l) && <s className="ml-1">{usd(listPrice(l))}</s>}
                      </span>
                    </span>
                    <span className="flex items-center rounded-xl border border-line">
                      <button className="size-8 rounded-l-xl text-lg hover:bg-surface-2" onClick={() => setQty(l, l.qty - 1)} aria-label="One less">−</button>
                      <span className="w-9 text-center font-bold">{l.qty}</span>
                      <button className="size-8 rounded-r-xl text-lg hover:bg-surface-2" onClick={() => setQty(l, l.qty + 1)} aria-label="One more">+</button>
                    </span>
                    <span className="w-20 text-right font-semibold">{usd(unitPrice(l) * l.qty)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-bold">Collection</h2>
            <Switch checked={!someoneElse} onChange={(v) => setSomeoneElse(!v)} label="The customer collects it" description={someoneElse ? "Someone else collects it with the pass." : "With the QR pass (or its PIN) for this order."} />
            {someoneElse && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Who collects" value={otherName} onChange={(e) => setOtherName(e.target.value)} error={show(errors.otherName)} />
                <Input label="Their phone" value={otherPhone} onChange={(e) => setOtherPhone(e.target.value)} inputMode="tel" error={show(errors.otherPhone)} />
              </div>
            )}
            {(shop.branches ?? []).length > 0 && (
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold">Collect from</span>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-brand">
                  <option value="main">Main shop</option>
                  {(shop.branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
            {shop.offersDelivery && <Switch checked={delivery} onChange={setDelivery} label={`Deliver it (+${usd(shop.deliveryFee ?? 0)})`} />}
            <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Pack the veggies separately" />
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-2 p-5">
            <h2 className="mb-1 font-bold">How the customer pays</h2>
            {ways.length === 0 && <p className="text-sm text-amber-800">There is no way to pay yet: LocalinkGo has not set up its accounts.</p>}
            {ways.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWayId(w.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${way?.id === w.id ? "border-brand bg-brand-50" : "border-line hover:bg-surface"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{w.title}</span>
                  <span className="block text-xs text-ink-3">{w.sub}</span>
                </span>
                <span className={`size-4 rounded-full border-2 ${way?.id === w.id ? "border-brand bg-brand" : "border-line"}`} />
              </button>
            ))}
          </Card>
          <Card className="p-5">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt className="text-ink-3">Items</dt><dd>{usd(t.subtotal)}</dd>
              {t.discount > 0 && (<><dt className="text-ink-3">{shop.promo?.label || "Shop offer"}</dt><dd>−{usd(t.discount)}</dd></>)}
              {t.delivery > 0 && (<><dt className="text-ink-3">Delivery</dt><dd>{usd(t.delivery)}</dd></>)}
              {t.fee > 0 && (<><dt className="text-ink-3">LocalinkGo service fee ({fee}%)</dt><dd>{usd(t.fee)}</dd></>)}
              <dt className="border-t border-line pt-2 font-bold">Customer pays</dt><dd className="border-t border-line pt-2 text-lg font-extrabold text-brand">{usd(t.total)}</dd>
              {t.fee > 0 && (<><dt className="text-ink-3">Your sale</dt><dd className="font-semibold">{usd(t.total - t.fee)}</dd></>)}
            </dl>
            <Button className="mt-4 w-full" loading={saving} onClick={create}>Create order{lines.length ? ` · ${usd(t.total)}` : ""}</Button>
          </Card>
        </div>
      </div>

      {picking && <ProductPicker products={products} lines={lines} onAdd={add} onClose={() => setPicking(false)} />}
      {finding && <CustomerPicker customers={customers} onPick={pickCustomer} onClose={() => setFinding(false)} />}
    </div>
  );
}

function ProductPicker({ products, lines, onAdd, onClose }: { products: ReturnType<typeof sellable>; lines: Line[]; onAdd: (l: Line) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = products.filter((p) => p.available !== false && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())));
  const inBasket = (l: Line) => lines.find((x) => sameLine(x, l))?.qty ?? 0;
  return (
    <Modal open onClose={onClose} title="Add items" wide footer={<Button onClick={onClose}>Done</Button>}>
      <SearchInput placeholder="Search your products…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {list.length === 0 && <p className="mt-4 text-sm text-ink-3">{q ? "No product matches." : "No products on sale. Add products first."}</p>}
      <ul className="mt-3 divide-y divide-line">
        {list.map((p) => (
          <li key={p.id} className="py-2">
            <p className="flex items-center gap-2 text-sm font-bold">
              {p.name} {isActive(p.discount) && <Badge tone="danger">-{p.discount!.percent}%</Badge>}
            </p>
            <ul className="mt-1 space-y-1">
              {optionsOf(p).map((o) => (
                <li key={`${o.variation?.id}-${o.bulk?.id}`} className="flex items-center gap-3 pl-3 text-sm">
                  <span className="flex-1 text-ink-2">{optionLabel(o) || "Each"} · <b className="text-brand">{usd(unitPrice(o))}</b></span>
                  {inBasket(o) > 0 && <Badge tone="success">{inBasket(o)} added</Badge>}
                  <Button variant="secondary" className="h-8 px-3" onClick={() => onAdd({ ...o, qty: 1 })}>
                    <Icon name="plus" className="size-4" strokeWidth={2.2} /> Add
                  </Button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function CustomerPicker({ customers, onPick, onClose }: { customers: ShopCustomer[]; onPick: (c: ShopCustomer) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const text = q.trim().toLowerCase();
  const digits = digitsOnly(q);
  const list = customers.filter((c) => !text || (digits.length >= 3 && digitsOnly(c.phone).includes(digits)) || text.split(/\s+/).every((w) => c.name.toLowerCase().includes(w)));
  return (
    <Modal open onClose={onClose} title="Returning customers">
      <SearchInput placeholder="Name or phone number" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="mt-3 divide-y divide-line">
        {list.slice(0, 80).map((c) => (
          <li key={c.phone}>
            <button className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-surface" onClick={() => onPick(c)}>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{c.name}</span>
                <span className="block text-ink-3">{c.phone} · {c.orders.length} order{c.orders.length === 1 ? "" : "s"} · last {relativeDay(c.orders[0].createdAt)}</span>
              </span>
              <span className="text-brand">›</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-3 text-sm text-ink-3">No one matches.</li>}
      </ul>
    </Modal>
  );
}
