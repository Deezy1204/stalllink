"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { NoShop, PaymentCard } from "@/components/merchant/OrderBits";
import { usePhotoUpload } from "@/components/merchant/Photos";
import { QrScanner } from "@/components/merchant/QrScanner";
import { Badge, Button, Card, PageHeader, Spinner, useToast } from "@/components/ui";
import { digitsOnly, matchVoucher, paymentStatusOf, relativeDay, timeOfDay } from "@/lib/catalog";
import { releaseOrder } from "@/lib/merchant";
import { orderTotal, usd, type ShopDoc } from "@/lib/types";

/** "Scan & Collect": read the recipient's QR voucher (or type its code), check, and hand over. */
export default function CollectPage() {
  const { user, shop, shops, orders, shopOrders, loaded, failedScans, addFailedScan, selectShop } = useMerchant();
  const toast = useToast();
  const { upload, progress } = usePhotoUpload();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [released, setReleased] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [elsewhere, setElsewhere] = useState<ShopDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fromLink = useRef(false);

  const o = orderId ? shopOrders.find((x) => x.id === orderId) : undefined;

  function load(raw: string) {
    setElsewhere(null);
    const found = matchVoucher(shopOrders, raw);
    if (!found) {
      const other = matchVoucher(orders, raw);
      const otherShop = other && shops.find((s) => s.id === other.stallId);
      if (otherShop) {
        setElsewhere(otherShop);
        return;
      }
      addFailedScan(raw, "Invalid or unknown code");
      toast(`No voucher found for "${raw}" at ${shop?.name ?? "this shop"}.`, "error");
      return;
    }
    if (found.status !== "readyForPickup") {
      addFailedScan(found.voucherCode, found.status === "collected" ? "Already collected" : "Voucher not valid");
      toast(`Voucher ${found.voucherCode} was ${found.status === "collected" ? "already collected" : "cancelled or has expired"}.`, "error");
      return;
    }
    setCamera(false);
    setOrderId(found.id);
    setChecked(new Set());
    setPhotoUrl(null);
    setReleased(null);
    setCode("");
  }

  // "Hand over this order" on an order page links here with ?code=…
  useEffect(() => {
    if (!loaded || fromLink.current) return;
    fromLink.current = true;
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) load(c);
    // load reads the latest orders; it only needs to run once they are loaded.
  }, [loaded]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (digitsOnly(code).length < 4) return setCodeError("Enter at least 4 digits of the code");
    setCodeError(null);
    load(code.trim());
  }

  async function release() {
    if (!o || !shop) return;
    setBusy(true);
    try {
      await releaseOrder(user.uid, o, shop.name, photoUrl);
      navigator.vibrate?.(120);
      setReleased(`Handed over! ${usd(orderTotal(o))} order released.`);
      setOrderId(null);
    } catch (e) {
      toast(`Could not release the order: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!shop) return <NoShop what="hand over orders" />;

  const allChecked = !!o && checked.size === o.items.length;
  const paid = !!o && paymentStatusOf(o) === "confirmed";
  const history = [
    ...shopOrders.filter((x) => x.status === "collected" && x.collectedAt).map((x) => ({ code: x.voucherCode, time: x.collectedAt!, ok: true, text: `${relativeDay(x.collectedAt!)} · ${x.items.length} items · ${usd(orderTotal(x))}` })),
    ...failedScans.map((f) => ({ code: f.code, time: f.time, ok: false, text: `${timeOfDay(f.time)} · ${f.reason}` })),
  ].sort((a, b) => b.time - a.time);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Scan & collect" subtitle={`${shop.name} · scan the recipient's QR voucher or type its code`} />

      {released && (
        <div className="mb-4 flex animate-rise items-center gap-3 rounded-2xl bg-mint-100 px-4 py-3 text-mint-800">
          <span className="flex size-9 items-center justify-center rounded-full bg-mint-600 text-white"><Icon name="check" className="size-5" strokeWidth={2.4} draw /></span>
          <p className="flex-1 font-semibold">{released}</p>
          <button onClick={() => setReleased(null)} className="text-sm font-semibold hover:underline">Dismiss</button>
        </div>
      )}
      {elsewhere && (
        <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          That voucher is for <b>{elsewhere.name}</b>, not {shop.name}.{" "}
          <button onClick={() => { selectShop(elsewhere.id); setElsewhere(null); }} className="font-semibold underline">Switch to {elsewhere.name}</button> and scan again.
        </div>
      )}

      {!o ? (
        <Card className="p-5">
          {camera ? (
            <QrScanner onCode={load} onClose={() => setCamera(false)} />
          ) : (
            <button onClick={() => setCamera(true)} className="group flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-3xl bg-ink text-white transition hover:bg-ink-2">
              <Icon name="scan" className="size-11" strokeWidth={1.6} loop />
              <span className="font-bold">Scan the QR voucher with the camera</span>
              <span className="text-sm text-white/60">Works with a laptop webcam or a phone browser</span>
            </button>
          )}
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Or type the code (e.g. VCH-ZW-892417, or its last digits) or the recipient's PIN"
                className={`h-11 w-full rounded-xl border px-3.5 text-sm outline-none focus:ring-4 ${codeError ? "border-red-400 focus:ring-red-500/10" : "border-line focus:border-brand focus:ring-brand/10"}`}
                aria-label="Voucher code"
              />
              {codeError && <p className="mt-1 text-xs font-medium text-red-700">{codeError}</p>}
            </div>
            <Button type="submit" className="h-11">Verify voucher</Button>
          </form>
        </Card>
      ) : (
        <Card className="animate-rise p-5">
          <div className="flex items-center justify-between">
            <Badge tone="success"><Icon name="verified" className="size-4" play /> Voucher valid</Badge>
            <button onClick={() => setOrderId(null)} className="text-sm font-semibold text-ink-3 hover:text-ink">Cancel</button>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="font-mono text-sm text-ink-3">#{o.voucherCode}</p>
            <p className="text-3xl font-extrabold text-brand">{usd(orderTotal(o))}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div><p className="text-xs text-ink-3">Recipient (present)</p><p className="font-bold">{o.recipient?.name}</p></div>
            <div><p className="text-xs text-ink-3">Paid by</p><p className="font-bold">{o.senderName}{o.senderCity ? ` (${o.senderCity.split(",").pop()!.trim()})` : ""}</p></div>
          </div>
          <div className="mt-4"><PaymentCard order={o} shopName={shop.name} /></div>
          {o.note && <p className="mt-3 rounded-xl bg-brand-50/60 px-3 py-2 text-sm">Note: {o.note}</p>}

          <div className="mt-5 flex items-center justify-between">
            <h2 className="font-bold">Items to hand over</h2>
            <span className="text-sm font-semibold text-mint-800">{checked.size}/{o.items.length}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {o.items.map((it, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--color-brand)]"
                    checked={checked.has(i)}
                    onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n; })}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{it.name}</span>
                    <span className="block text-xs text-ink-3">{it.unit ? it.unit[0].toUpperCase() + it.unit.slice(1) : "Item"} × {it.qty}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={progress != null}
            onClick={() => photoInput.current?.click()}
            className={`group mt-3 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${photoUrl ? "bg-mint-100" : "bg-surface-2 hover:bg-surface"}`}
          >
            {photoUrl ? <img src={photoUrl} alt="" className="size-12 rounded-xl object-cover" /> : <span className="flex size-12 items-center justify-center rounded-xl bg-white text-brand"><Icon name="camera" className="size-6" /></span>}
            <span className="flex-1">
              <span className="block text-sm font-bold">{photoUrl ? "Handover photo saved" : "Handover photo (optional)"}</span>
              <span className="block text-xs text-ink-3">Shows {o.senderName.split(" ")[0]} the groceries were handed over</span>
            </span>
            <span className="text-sm font-semibold text-brand">{progress != null ? `${Math.round(progress * 100)}%` : photoUrl ? "Change" : "Add"}</span>
          </button>
          <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const url = await upload(e.target.files?.[0]); e.target.value = ""; if (url) setPhotoUrl(url); }} />

          <Button className="mt-5 h-12 w-full text-base" disabled={!allChecked || !paid || progress != null} loading={busy} onClick={release}>
            Confirm handover ({usd(orderTotal(o))})
          </Button>
          {(!allChecked || !paid) && <p className="mt-2 text-center text-xs text-ink-3">{!paid ? "Confirm the payment above first." : "Tick every item to enable handover."}</p>}
        </Card>
      )}

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="font-bold">Recent scans</h2>
        <span className="text-sm text-ink-3">{history.length}</span>
      </div>
      {history.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-3">No scans yet.</Card>
      ) : (
        <Card className="divide-y divide-line">
          {history.slice(0, 8).map((h, i) => (
            <div key={`${h.code}-${h.time}-${i}`} className="group flex items-center gap-3 px-4 py-3">
              <span className={h.ok ? "text-mint-600" : "text-red-600"}><Icon name={h.ok ? "checkCircle" : "xCircle"} className="size-7" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Voucher: {h.code}</p>
                <p className="text-xs text-ink-3">{h.text}</p>
              </div>
              <Badge tone={h.ok ? "success" : "danger"}>{h.ok ? "Collected" : "Failed"}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
