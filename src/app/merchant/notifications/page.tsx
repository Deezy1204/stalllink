"use client";

import { useRouter } from "next/navigation";

import { Icon, type IconName } from "@/components/icons";
import { useMerchant } from "@/components/merchant/MerchantData";
import { Button, Card, Empty, PageHeader, useToast } from "@/components/ui";
import { ago } from "@/lib/catalog";
import { markNotificationsRead } from "@/lib/merchant";
import type { NotificationDoc } from "@/lib/types";

/** The app's icon keys (Localink serialization.dart) as console icons. */
const ICONS: Record<string, IconName> = {
  volunteer_activism: "gift",
  confirmation_number: "ticket",
  check_circle: "checkCircle",
  qr_code_2: "cart",
  payments: "cash",
  inventory_2: "box",
  pin_drop: "pin",
  account_balance: "bank",
  notifications: "bell",
  verified: "verified",
  receipt_long: "receipt",
  star: "star",
};

const TONE = { primary: "bg-brand-50 text-brand", secondary: "bg-mint-100 text-mint-800", neutral: "bg-surface-2 text-ink-2" };

/** The account's notifications (the same list as the app's bell). Opening one marks it read. */
export default function NotificationsPage() {
  const { notifications, unread, orders } = useMerchant();
  const router = useRouter();
  const toast = useToast();

  const read = (ids: string[]) => markNotificationsRead(ids).catch((e: Error) => toast(`Could not update: ${e.message}`, "error"));

  function open(n: NotificationDoc) {
    if (n.unread) read([n.id]);
    if (!n.orderId) return;
    if (orders.some((o) => o.id === n.orderId)) router.push(`/merchant/orders/${n.orderId}`);
    else toast("That order is one you sent or receive. Open it in the Localink app.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up"}
        actions={unread > 0 && <Button variant="secondary" onClick={() => read(notifications.filter((n) => n.unread).map((n) => n.id))}>Mark all read</Button>}
      />
      {notifications.length === 0 ? (
        <Empty title="You're all caught up" message="New orders, payment proofs and shop updates appear here." />
      ) : (
        <div className="stagger space-y-2">
          {notifications.map((n, i) => (
            <button key={n.id} onClick={() => open(n)} style={{ "--i": Math.min(i, 12) } as React.CSSProperties} className="group block w-full text-left">
              <Card className={`flex gap-3 p-4 transition hover:shadow-md ${n.unread ? "border-brand/30" : "bg-surface"}`}>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TONE[n.color ?? "primary"] ?? TONE.primary}`}>
                  {/* New ones play as they arrive. */}
                  <Icon name={ICONS[n.icon ?? ""] ?? "bell"} play={n.unread} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="flex-1 font-bold">{n.title}</span>
                    {n.unread && <span className="size-2 rounded-full bg-brand" aria-label="Unread" />}
                  </span>
                  <span className="block text-sm text-ink-2">{n.body}</span>
                  <span className="mt-1 block text-xs text-ink-3">{ago(n.time)}</span>
                </span>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
