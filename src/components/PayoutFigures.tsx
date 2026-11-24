import { relativeDay } from "@/lib/catalog";
import type { PayoutFigures } from "@/lib/payouts";
import { usd, type PayoutDoc } from "@/lib/types";

/**
 * A payout, line by line: what buyers paid, LocalinkGo's service fee and
 * discount, the shop's share, anything else, and what is (or will be) sent.
 * Admins also see what LocalinkGo keeps and each order.
 */
export function PayoutFiguresView({ payout: p, f, audience }: { payout: PayoutDoc; f: PayoutFigures; audience: "admin" | "shop" }) {
  const admin = audience === "admin";
  const shop = admin ? "the shop" : "you";
  const row = (label: string, value: string, opts: { strong?: boolean; tone?: string; hint?: string } = {}) => (
    <div className={`flex items-baseline justify-between gap-4 ${opts.strong ? "border-t border-line pt-1.5 font-bold" : ""}`}>
      <dt className={opts.strong ? "text-ink" : "text-ink-2"}>
        {label}
        {opts.hint && <span className="block text-xs font-normal text-ink-3">{opts.hint}</span>}
      </dt>
      <dd className={`shrink-0 tabular-nums ${opts.tone ?? ""}`}>{value}</dd>
    </div>
  );
  const total =
    p.status === "paid"
      ? admin ? "Sent to the shop" : "Paid to you"
      : p.status === "failed"
        ? admin ? "Returned to the shop's balance" : "Returned to your balance"
        : admin ? "To send to the shop (pending)" : "To be paid to you (pending)";

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm">
      <dl className="space-y-1.5">
        {row(`Orders in this payout`, String(f.orders))}
        {row("Buyers paid", usd(f.buyersPaid), { hint: "Everything buyers paid LocalinkGo for these orders" })}
        {row("LocalinkGo service fee", f.serviceFees ? `−${usd(f.serviceFees)}` : usd(0), { hint: "Kept by LocalinkGo" })}
        {f.localinkDiscount > 0 && row("LocalinkGo discount", `+${usd(f.localinkDiscount)}`, { tone: "text-mint-800", hint: `Buyers paid less; LocalinkGo pays it to ${shop}` })}
        {row(admin ? "The shop's share" : "Your share", usd(f.shopShare))}
        {Math.abs(f.other) >= 0.01 &&
          row(f.other < 0 ? "Spent from earnings" : "Earnings from before", `${f.other < 0 ? "−" : "+"}${usd(Math.abs(f.other))}`, {
            hint: f.other < 0 ? "Credits used at other shops, or a plan" : "e.g. a payout returned earlier",
          })}
        {row(total, usd(f.amount), { strong: true, tone: p.status === "pending" ? "text-amber-700" : p.status === "failed" ? "text-red-700" : "text-mint-800" })}
      </dl>
      {admin && (
        <p className="mt-2 text-xs text-ink-3">
          LocalinkGo keeps {usd(f.localinkNet)}{f.localinkDiscount > 0 ? ` (fees ${usd(f.serviceFees)} less discounts it paid ${usd(f.localinkDiscount)})` : ""}.
        </p>
      )}
      {f.source !== "recorded" && (
        <p className="mt-1 text-xs text-ink-3">
          {f.source === "approximate"
            ? "Worked out from the orders collected since the shop's previous payout; some orders are older than this list, so the buyer and fee figures are approximate."
            : "Worked out from the orders collected since the shop's previous payout."}
        </p>
      )}
      {admin && f.lines.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-brand">Show the {f.lines.length} order{f.lines.length === 1 ? "" : "s"}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="text-left text-ink-3">
                <tr>
                  <th className="py-1 font-semibold">Order</th>
                  <th className="py-1 text-right font-semibold">Buyer paid</th>
                  <th className="py-1 text-right font-semibold">Fee</th>
                  <th className="py-1 text-right font-semibold">Discount</th>
                  <th className="py-1 text-right font-semibold">Shop</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {f.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1">
                      #{l.id}
                      {l.collectedAt ? <span className="block text-ink-3">{relativeDay(l.collectedAt)}</span> : null}
                    </td>
                    <td className="py-1 text-right tabular-nums">{usd(l.buyerPaid)}</td>
                    <td className="py-1 text-right tabular-nums">{l.serviceFee ? usd(l.serviceFee) : "—"}</td>
                    <td className="py-1 text-right tabular-nums">{l.localinkDiscount ? usd(l.localinkDiscount) : "—"}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">{usd(l.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
