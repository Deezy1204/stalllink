// What a payout is made of, for admins and for the shop: what buyers paid,
// LocalinkGo's service fee, LocalinkGo's discount (which LocalinkGo pays the
// shop), the shop's share, anything else that changed its balance, and the
// amount sent. Payouts made since 2026-11-24 record these (`breakdown.detailed`);
// for older ones they are worked out from the shop's orders collected between
// its previous payout and this one.

import { cents, orderShare, orderTotal, type OrderDoc, type PayoutDoc } from "./types";

export interface PayoutOrderLine {
  id: string;
  collectedAt?: number | null;
  buyerPaid: number;
  serviceFee: number;
  localinkDiscount: number;
  share: number;
}

export interface PayoutFigures {
  orders: number;
  /** Everything the buyers of these orders paid (LocalinkGo's fee included). */
  buyersPaid: number;
  /** LocalinkGo's service fee in that: LocalinkGo keeps it. */
  serviceFees: number;
  /** LocalinkGo's discount to buyers: LocalinkGo pays it to the shop. */
  localinkDiscount: number;
  /** The shop's share of these sales. */
  shopShare: number;
  /** Credits spent, a plan, a returned payout… (negative), or earnings from before (positive). */
  other: number;
  /** What LocalinkGo sends the shop. */
  amount: number;
  /** LocalinkGo's fees less the discounts it paid. */
  localinkNet: number;
  lines: PayoutOrderLine[];
  /** recorded: from the payout itself; worked out: from the orders; approximate: the orders do not quite add up. */
  source: "recorded" | "worked out" | "approximate";
}

const line = (o: OrderDoc): PayoutOrderLine => ({
  id: o.id,
  collectedAt: o.collectedAt,
  buyerPaid: orderTotal(o),
  serviceFee: Math.max(o.serviceFee ?? 0, 0),
  localinkDiscount: Math.max(o.localinkDiscount ?? 0, 0),
  share: orderShare(o),
});

/** [p]'s figures. [shopPayouts] and [orders] may include other shops' (they are filtered). */
export function payoutFigures(p: PayoutDoc, shopPayouts: PayoutDoc[], orders: OrderDoc[]): PayoutFigures {
  const b = p.breakdown;
  const byId = new Map(orders.map((o) => [o.id, o]));
  const finish = (f: Omit<PayoutFigures, "other" | "amount" | "localinkNet">): PayoutFigures => ({
    ...f,
    other: cents(p.amount - f.shopShare),
    amount: p.amount,
    localinkNet: cents(f.serviceFees - f.localinkDiscount),
  });

  if (b?.detailed) {
    return finish({
      orders: b.orders,
      buyersPaid: b.buyersPaid ?? 0,
      serviceFees: b.serviceFees ?? 0,
      localinkDiscount: b.localinkDiscount,
      shopShare: b.sales,
      lines: (b.orderIds ?? []).map((id) => byId.get(id)).filter((o): o is OrderDoc => !!o).map(line),
      source: "recorded",
    });
  }

  // The orders collected since the shop's previous payout.
  const prev = shopPayouts.filter((x) => x.shopId === p.shopId && x.id !== p.id && x.createdAt < p.createdAt).sort((a, z) => z.createdAt - a.createdAt)[0];
  const from = prev?.createdAt ?? 0;
  const lines = orders
    .filter((o) => o.stallId === p.shopId && o.payTo === "localink" && o.status === "collected" && (o.collectedAt ?? 0) > from && (o.collectedAt ?? 0) <= p.createdAt)
    .map(line);
  const sum = (k: keyof Omit<PayoutOrderLine, "id" | "collectedAt">) => cents(lines.reduce((s, l) => s + l[k], 0));
  const serviceFees = sum("serviceFee");
  if (!b) {
    return finish({ orders: lines.length, buyersPaid: sum("buyerPaid"), serviceFees, localinkDiscount: sum("localinkDiscount"), shopShare: sum("share"), lines, source: "worked out" });
  }
  // The payout's own totals stand; the orders add what buyers paid and the fees.
  const matches = lines.length === b.orders && Math.abs(sum("share") - b.sales) < 0.01;
  return finish({
    orders: b.orders,
    buyersPaid: cents(b.sales - b.localinkDiscount + serviceFees),
    serviceFees,
    localinkDiscount: b.localinkDiscount,
    shopShare: b.sales,
    lines,
    source: matches ? "worked out" : "approximate",
  });
}
