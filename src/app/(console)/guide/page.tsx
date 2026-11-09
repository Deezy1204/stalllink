import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";

// "How Localink works": the whole system from sign-up to collection, for
// anyone new to it. The phone pictures are rendered from the app with its
// demo data (Localink/test/docs_screenshots_test.dart).

const sections = [
  { id: "idea", title: "The idea" },
  { id: "people", title: "Who is who" },
  { id: "accounts", title: "Accounts & sign-up" },
  { id: "shop", title: "Setting up a shop" },
  { id: "products", title: "Listing products" },
  { id: "buying", title: "Buying for someone" },
  { id: "paying", title: "Paying the shop" },
  { id: "recipient", title: "The recipient" },
  { id: "confirm", title: "Confirming payment" },
  { id: "collection", title: "Collection" },
  { id: "after", title: "Revenue & records" },
  { id: "reviews", title: "Ratings & reviews" },
  { id: "timeline", title: "Who does what, when" },
  { id: "notifications", title: "Notifications" },
  { id: "admin", title: "The admin console" },
  { id: "web", title: "The merchant console" },
  { id: "rules", title: "Rules & limits" },
  { id: "open", title: "Open questions" },
];

function Phone({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="w-[46%] max-w-[230px] shrink-0 sm:w-[30%]">
      <div className="rounded-[1.9rem] bg-ink p-[6px] shadow-xl shadow-ink/15">
        <Image
          src={`/guide/app/${src}.png`}
          alt={caption}
          width={720}
          height={1560}
          sizes="(min-width: 1024px) 230px, (min-width: 640px) 30vw, 46vw"
          className="h-auto w-full rounded-[1.55rem]"
        />
      </div>
      <figcaption className="mt-2 text-center text-xs leading-snug text-ink-3">{caption}</figcaption>
    </figure>
  );
}

function Phones({ children }: { children: ReactNode }) {
  return <div className="my-6 flex flex-wrap justify-center gap-x-5 gap-y-6 sm:justify-start">{children}</div>;
}

function Section({ id, n, title, who, children }: { id: string; n: number; title: string; who?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10 first:border-0 first:pt-0">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">{String(n).padStart(2, "0")}{who ? ` · ${who}` : ""}</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand">{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return <div className={`rounded-2xl px-4 py-3 text-sm ${tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-surface-2 text-ink-2"}`}>{children}</div>;
}

function Status({ children, tone }: { children: ReactNode; tone: "green" | "amber" | "red" | "grey" }) {
  const c = { green: "bg-mint-100 text-mint-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800", grey: "bg-surface-2 text-ink" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

const people: { icon: IconName; name: string; text: string }[] = [
  { icon: "globe", name: "Buyer (sender)", text: "Usually lives abroad (UK, South Africa, US…). Chooses a shop near the family, pays the shop directly, uploads proof of payment. Uses the app in General mode." },
  { icon: "home", name: "Recipient", text: "Family or a friend at home who collects the groceries. Gets a QR pickup pass and a PIN. Does not need the app: the buyer can send the pass by WhatsApp or as a PDF." },
  { icon: "store", name: "Merchant (shop)", text: "Runs one or more shops. Publishes payment details and products, confirms payments, hands groceries over. Uses the app in Merchant mode or the web merchant console." },
  { icon: "shieldCheck", name: "Admin (Localink)", text: "Verifies and, if needed, pauses shops, suspends accounts, watches orders and payments, follows up shops that buyers recommend. Uses this console (or the app's Admin console)." },
];

const timeline: { who: string; what: ReactNode; where: string; result: ReactNode; told: string }[] = [
  { who: "Merchant", what: "Creates an account and sets up the shop: photos, map pin, hours, payment details", where: "App (Merchant mode) or web /merchant", result: <>Shop live · <Status tone="amber">Awaiting verification</Status></>, told: "Admins: “New shop to verify”" },
  { who: "Admin", what: "Checks the shop and verifies it", where: "Admin console → Shops", result: <Status tone="green">Verified badge</Status>, told: "Shop owner: “Your shop is verified”" },
  { who: "Merchant", what: "Lists products with sizes, prices, stock and photos", where: "App or web", result: "Buyers see them straight away", told: "—" },
  { who: "Buyer", what: "Fills a basket at one shop and checks out: recipient, collection point or delivery, payment method", where: "App", result: <><Status tone="green">Ready for pickup</Status> <Status tone="red">Awaiting payment proof</Status> + voucher code & PIN</>, told: "Buyer, recipient (by phone and account) and the shop" },
  { who: "Buyer", what: "Pays the shop the exact amount with the shop’s own details, using the order number as reference", where: "Outside Localink (EcoCash, bank…)", result: "Money is with the shop", told: "—" },
  { who: "Buyer", what: "Uploads proof: a photo or PDF, the transaction reference and the payer’s name", where: "App", result: <Status tone="amber">Payment proof sent</Status>, told: "Shop: “Payment proof for #…”" },
  { who: "Merchant", what: "Checks the money arrived and taps Confirm payment", where: "App or web", result: <Status tone="green">Payment confirmed</Status>, told: "Buyer: “Payment confirmed”" },
  { who: "Recipient", what: "Opens the pickup pass; may change the collection point to a branch", where: "App, or the shared pass", result: "Collection point saved on the order", told: "Shop (and buyer): “Collection point set”" },
  { who: "Recipient", what: "Goes to the shop and shows the QR, or gives the voucher code or PIN", where: "At the counter", result: "—", told: "—" },
  { who: "Merchant", what: "Scans or types the code, ticks every item, optionally takes a handover photo, taps Confirm handover", where: "App or web", result: <Status tone="grey">Collected</Status>, told: "Buyer and recipient: “Groceries collected”" },
  { who: "Merchant", what: "Sees the month’s sales; downloads a PDF or CSV report", where: "App or web → Revenue", result: "Sales record", told: "—" },
];

const notices: [string, string, string][] = [
  ["Order placed", "The buyer (“Voucher sent to …”), the recipient (“… sent you groceries”) and the shop (“New order #…”)", "Buyer’s app"],
  ["Proof of payment uploaded", "The shop", "Buyer’s app"],
  ["Payment confirmed", "The buyer", "Shop (app or web)"],
  ["Collection point changed", "The shop, and the buyer if someone else changed it", "Recipient’s or buyer’s app"],
  ["Groceries collected", "The buyer and the recipient", "Shop (app or web)"],
  ["Shop verified / verification removed / paused / visible again", "The shop’s owner", "Cloud Function, when an admin changes the shop"],
  ["New shop registered", "Every admin", "Cloud Function"],
  ["New review of a shop", "The shop’s owner", "Cloud Function, when a buyer reviews the shop"],
];

export default function GuidePage() {
  return (
    <div className="lg:grid lg:grid-cols-[1fr_200px] lg:gap-10">
      <article className="min-w-0">
        <header className="mb-10 rounded-3xl bg-gradient-to-br from-ink to-brand p-7 text-white shadow-lg shadow-brand/20">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Guide</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">How Localink works</h1>
          <p className="mt-2 max-w-2xl text-white/85">
            From creating an account to the moment the groceries are handed over: who does what, when, and what everyone sees. The phone pictures come from the app, filled with its demo data.
          </p>
        </header>

        <div className="space-y-10">
          <Section id="idea" n={1} title="The idea in one minute">
            <p>
              People abroad want to put food on the table at home without paying remittance fees or trusting someone to do the shopping. With Localink a buyer picks a real shop near the family, chooses the groceries,
              and <b>pays the shop directly</b> (EcoCash, InnBucks, OneMoney, Mukuru, a bank transfer…). The family member collects the groceries with a <b>QR voucher</b>.
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {["Buyer orders", "Pays the shop", "Uploads proof", "Shop confirms", "Recipient shows QR", "Shop hands over"].map((s, i) => (
                <div key={s} className="rounded-2xl border border-line bg-white p-3 text-center">
                  <p className="text-xs font-bold text-brand">Step {i + 1}</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{s}</p>
                </div>
              ))}
            </div>
            <Note>
              <b>Localink never holds money.</b> It connects the three people, keeps the order, the proof of payment and the handover on record, and notifies everyone at each step. The shop is paid by the buyer, outside the app,
              before it hands anything over.
            </Note>
          </Section>

          <Section id="people" n={2} title="Who is who">
            <div className="grid gap-3 sm:grid-cols-2">
              {people.map((p) => (
                <div key={p.name} className="group rounded-2xl border border-line bg-white p-4 transition hover:shadow-md">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name={p.icon} className="size-6" draw /></span>
                  <p className="mt-3 font-bold text-ink">{p.name}</p>
                  <p className="mt-1 text-sm">{p.text}</p>
                </div>
              ))}
            </div>
            <p>
              <b>One account does both.</b> Every account can buy (General mode) and run shops (Merchant mode), switching in Profile; the app reopens in the last mode used. Notifications arrive for the account whatever the mode,
              and tapping one opens the right screen for your part in that order.
            </p>
          </Section>

          <Section id="accounts" n={3} title="Accounts & sign-up" who="Everyone">
            <Phones>
              <Phone src="landing" caption="First screen: create an account, sign in, or look around first" />
              <Phone src="signup" caption="Sign-up: name, email, phone, password, and the mode to start in" />
              <Phone src="profile" caption="Profile: switch between General and Merchant mode" />
            </Phones>
            <Steps
              items={[
                <>Sign up in the app with name, email, <b>phone number</b> and password (or Google). Merchants can also open an account on the web at <Link className="font-semibold text-brand hover:underline" href="/merchant">/merchant</Link>.</>,
                <>The <b>phone number matters</b>: orders sent to someone are matched to their account by it, so a recipient with the app sees the pass under Orders → Received.</>,
                <>People search: when a buyer chooses a recipient they can search other Localink users by name or phone. Results show only the city and the last 4 digits. Anyone can switch off <i>Let people find me</i> in Profile.</>,
                <>Admins are ordinary accounts listed as admins. An admin adds another by email in <Link className="font-semibold text-brand hover:underline" href="/admins">Admins</Link>; someone without an account yet becomes admin when they first sign in with that email.</>,
                <>A suspended account (Admin console → Users) cannot sign in to the app or the web.</>,
              ]}
            />
          </Section>

          <Section id="shop" n={4} title="Setting up a shop" who="Merchant">
            <Phones>
              <Phone src="m_shop_form" caption="Shop form: photos, details and map pin, with a progress count" />
              <Phone src="m_shop_payments" caption="How buyers pay you: the shop’s own EcoCash, bank or other details" />
              <Phone src="m_overview" caption="Overview: this month’s sales, payments to check, orders waiting" />
            </Phones>
            <Steps
              items={[
                <><b>Photos:</b> a shop-front photo (required) and up to 4 more of the inside and shelves. Buyers can swipe and zoom them.</>,
                <><b>Details:</b> name, stand number, market or trading centre, street address, city, phone/WhatsApp, and an exact <b>map pin</b> so recipients get directions.</>,
                <><b>What you sell:</b> one or more categories, including your own.</>,
                <><b>Opening hours</b> per day (with “copy Monday” shortcuts). Buyers see whether the shop is open now.</>,
                <><b>How buyers pay you</b> (at least one): EcoCash, InnBucks, OneMoney, Mukuru, bank transfer or other, with account name, number and instructions. Buyers see exactly these at checkout.</>,
                <><b>Branches</b> (optional): other places the same shop can be collected from, each with its own pin.</>,
                <><b>Delivery & currency:</b> optional delivery to the recipient for a fee, and the shop’s own Rand rate for buyers who view prices in ZAR.</>,
              ]}
            />
            <p>
              Six parts are required (photo, name, pin, a category, open hours, a payment method). Everything typed is kept on the device as a draft, so a dropped connection loses nothing. Publishing makes the shop
              visible to buyers <b>immediately</b>, marked <Status tone="amber">Awaiting verification</Status>. Every admin is notified and verifies it from <Link className="font-semibold text-brand hover:underline" href="/shops">Shops</Link>; the owner is then told and the shop gets its verified badge.
              A merchant can run several shops and switches between them; each has its own products, orders and revenue.
            </p>
          </Section>

          <Section id="products" n={5} title="Listing products" who="Merchant">
            <Phones>
              <Phone src="m_catalog" caption="Inventory: search, quick stock +/−, hide or show a product" />
              <Phone src="m_product" caption="Product: name, category, up to 4 photos (first is the cover), description" />
              <Phone src="m_product_sizes" caption="Sizes & prices: each size has its unit, price and stock, plus bulk prices" />
            </Phones>
            <p>
              Every product has at least one <b>size</b>: an amount and a unit (kg, g, L, ml, pack, bag, bottle, crate, dozen…), an optional label, a price in USD and the stock. Cooking oil might come in 750 ml, 2 L and 5 L;
              sugar in 500 g, 2 kg and 5 kg. A size can also have <b>bulk prices</b> such as “Case of 10 for $10”; the form shows the price each and what the buyer saves.
            </p>
            <p>Changes reach buyers instantly. Low stock (5 or fewer) is flagged. Switching a product off hides it without deleting it.</p>
          </Section>

          <Section id="buying" n={6} title="Buying for someone" who="Buyer">
            <Phones>
              <Phone src="home" caption="Shops near the family: by city, category or search; list or map" />
              <Phone src="shop" caption="A shop: photos, hours, branches, payment methods and products" />
              <Phone src="product" caption="A product: choose the size, and single or bulk" />
            </Phones>
            <Phones>
              <Phone src="shop_locations" caption="Where to collect: the main shop and every branch, with hours, call and directions" />
              <Phone src="basket" caption="Basket: items from one shop" />
              <Phone src="checkout" caption="Checkout: who collects, where, how to pay, a message" />
            </Phones>
            <Steps
              items={[
                <>Pick the city where the family lives, then browse shops (list or map) or search for a product. <i>Check coverage</i> shows which areas have shops, including branches; buyers can recommend a missing shop (it appears in <Link className="font-semibold text-brand hover:underline" href="/requests">Shop requests</Link>).</>,
                <>Shop cards say how many <b>branches</b> a shop has and in which areas. The shop page lists every place it can be collected from (main shop and branches) with the address, hours, a call button and directions, and a map of the pinned ones.</>,
                <>Add items to the basket. A basket holds <b>one shop’s</b> products, because that shop is paid and collects for the whole order.</>,
                <>At checkout choose <b>who collects</b>: <i>Someone else</i> (a saved recipient, a Localink user found by search, or new details typed in) or <i>Myself</i>.</>,
                <>Choose the <b>collection point</b> (main shop or a branch), or delivery if the shop offers it (its fee is added).</>,
                <>Choose one of the shop’s <b>payment methods</b>, add a message if you like, and place the order.</>,
              ]}
            />
          </Section>

          <Section id="paying" n={7} title="Paying the shop" who="Buyer">
            <Phones>
              <Phone src="payment" caption="Pay the shop: its details, the order number as reference, the amount" />
              <Phone src="voucher" caption="The voucher: QR code, voucher code and backup PIN, with the payment status" />
              <Phone src="tracking" caption="Order tracking: ordered → paid → voucher sent → picked up" />
            </Phones>
            <p>
              Placing the order creates a <b>voucher</b>: a code such as <code className="rounded bg-surface-2 px-1">VCH-ZW-538658</code>, a QR code of it and a 6-digit <b>backup PIN</b>. The order starts as{" "}
              <Status tone="green">Ready for pickup</Status> with payment <Status tone="red">Awaiting payment proof</Status>.
            </p>
            <Steps
              items={[
                <>The payment screen shows the shop’s details for the chosen method, the amount and the order number to use as reference. The buyer pays from their own wallet or bank; Localink is not involved in the money.</>,
                <>The buyer uploads <b>proof</b>: a screenshot, photo or PDF of the payment, plus the reference and the payer’s name. Payment becomes <Status tone="amber">Payment proof sent</Status> and the shop is notified. (“I’ll upload it later” is fine; the order waits.)</>,
                <>The buyer follows everything under Orders → Sent, and can download or share the pass as a PDF, or send it to the recipient on WhatsApp.</>,
              ]}
            />
          </Section>

          <Section id="recipient" n={8} title="The recipient" who="Recipient">
            <Phones>
              <Phone src="pass" caption="Pickup pass: who sent it, the QR and PIN, valid-until date, collection point" />
              <Phone src="notifications" caption="Notifications: unread count on the bell; tapping one opens the order" />
            </Phones>
            <p>
              The recipient is notified the moment the order is placed: by account if the buyer picked them from Localink’s users, and by phone number. In the app the pass is under Orders → Received. It shows the QR code, the
              PIN, the date it is valid until (5 days after ordering), the message from the buyer and the collection point, which the recipient can change to another branch (the shop is told).
            </p>
            <Note>Without the app the recipient can still collect: the buyer shares the pass (PDF or WhatsApp message with the code, PIN and a map link).</Note>
          </Section>

          <Section id="confirm" n={9} title="Confirming payment" who="Merchant">
            <Phones>
              <Phone src="m_orders" caption="Orders & vouchers: waiting for pickup, and completed" />
              <Phone src="m_order" caption="An order: view the proof, then Confirm payment" />
            </Phones>
            <p>
              When proof arrives the shop gets a notification and the order shows <Status tone="amber">Payment proof sent</Status> (the web console also counts “payments to check”). The merchant opens the proof, checks that the
              money really is in the shop’s account, and taps <b>Confirm payment</b>. Only the shop can confirm (the database rules enforce it). The buyer is told at once.
            </p>
            <Note tone="warn">A screenshot can be faked: shops should confirm only once they see the money in their own wallet or bank account.</Note>
          </Section>

          <Section id="collection" n={10} title="Collection: the final step" who="Merchant + recipient">
            <Phones>
              <Phone src="m_collect" caption="Scan & collect: voucher valid, payment confirmed, tick each item" />
            </Phones>
            <Steps
              items={[
                <>The recipient comes to the shop (or branch) and shows the QR, or reads out the voucher code or PIN.</>,
                <>The merchant opens <b>Scan & collect</b>: the app’s camera (or the web console with a laptop or phone camera) reads the QR; or they type the code, its last 4+ digits, or the PIN. A code for another of the merchant’s shops, or one already collected, is refused and logged.</>,
                <>The screen shows the recipient’s name, who paid, the payment status, any note, and the list of items.</>,
                <>Handover is only possible once the payment is <Status tone="green">confirmed</Status> and <b>every item is ticked</b> as it goes into the bag.</>,
                <>Optionally the merchant takes a <b>handover photo</b>; the buyer sees it on the order.</>,
                <><b>Confirm handover</b>: the order becomes <Status tone="grey">Collected</Status> with the time and who collected it, and the buyer and recipient are notified.</>,
              ]}
            />
          </Section>

          <Section id="after" n={11} title="Revenue & records" who="Merchant">
            <Phones>
              <Phone src="m_revenue" caption="Revenue: this month vs last, 6-month chart, every month’s orders" />
            </Phones>
            <p>
              Revenue is a <b>sales record</b>, not a balance: buyers already paid the shop. Each month shows orders, items, what was collected and what still awaits pickup; any month downloads as a PDF report or a CSV
              spreadsheet. Each order can also be downloaded as a receipt.
            </p>
          </Section>

          <Section id="reviews" n={12} title="Ratings & reviews" who="Everyone">
            <p>
              Reviews are <b>public</b>: anyone can read them, and each shows the author’s name, 1 to 5 stars, an optional comment and the date. A person writes <b>one review per shop</b> and{" "}
              <b>one review of Localink</b>, and can edit or delete it at any time.
            </p>
            <Steps
              items={[
                <>Buyers rate a shop in the app from its page (<i>Reviews → Write a review</i>), or straight from an order once it is collected. Shop owners cannot review their own shop.</>,
                <>The shop’s average and number of reviews show on its page and in every shop list. The Cloud Functions recalculate them whenever a review changes, so nobody can edit a rating by hand.</>,
                <>A review from someone who collected an order at that shop (as buyer or recipient) is marked <Status tone="green">Ordered here</Status>. The owner is notified of each new review.</>,
                <>Everyone rates Localink itself: buyers in the app (<i>Profile → Rate Localink</i>), shop owners in the app or in the merchant console (<i>Rate Localink</i>). Each review says whether it came from a buyer or a shop owner.</>,
                <>Merchants read their shop’s reviews under <i>Reviews</i> in the merchant console, or by tapping the rating on the app’s Overview.</>,
              ]}
            />
            <Note>Admins can hide an abusive review under <Link className="font-semibold text-brand hover:underline" href="/reviews">Reviews</Link>: it leaves every public list and rating, but its author still sees it. Deleting lets the author write a new one.</Note>
          </Section>

          <Section id="timeline" n={13} title="Who does what, when">
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Who</th>
                    <th className="px-4 py-3">Does what</th>
                    <th className="px-4 py-3">Where</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Who is notified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {timeline.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-bold text-brand">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{r.who}</td>
                      <td className="px-4 py-3">{r.what}</td>
                      <td className="px-4 py-3 text-ink-3">{r.where}</td>
                      <td className="px-4 py-3">{r.result}</td>
                      <td className="px-4 py-3 text-ink-3">{r.told}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              An order has two statuses. <b>Order:</b> <Status tone="green">Ready for pickup</Status> → <Status tone="grey">Collected</Status>. <b>Payment:</b> <Status tone="red">Awaiting payment proof</Status> →{" "}
              <Status tone="amber">Payment proof sent</Status> → <Status tone="green">Payment confirmed</Status>. A shop can confirm a payment before any proof arrives, if the money is already in.
            </p>
          </Section>

          <Section id="notifications" n={14} title="Notifications">
            <p>
              Every event below creates an in-app notification (the bell shows the unread count; opening one marks it read) and a <b>push notification</b> on the person’s phones, sent by the Cloud Functions. Tapping a push
              opens that order. A phone receives pushes for the account signed in on it, in either mode.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-surface text-xs uppercase tracking-wide text-ink-3">
                  <tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Who is notified</th><th className="px-4 py-3">Triggered by</th></tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {notices.map(([e, w, b]) => (
                    <tr key={e}><td className="px-4 py-3 font-semibold text-ink">{e}</td><td className="px-4 py-3">{w}</td><td className="px-4 py-3 text-ink-3">{b}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>To stop spam, a push is only sent between the people on that order (buyer, recipient, shop), or by Localink itself. Other notifications stay in-app.</Note>
          </Section>

          <Section id="admin" n={15} title="The admin console" who="Admin">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Dashboard", "/", "Users, merchants, shops, sales this month, a 6-month chart, shops to verify, payments to check, recent orders."],
                ["Shops", "/shops", "Verify new shops, remove verification, pause (hide from buyers) or restore, delete; see photos, payment details, hours, products, and every location (main shop and branches) on a map."],
                ["Users", "/users", "Search accounts, suspend or restore them, make someone an admin."],
                ["Orders", "/orders", "Every order with its payment status; open the buyer’s proof of payment."],
                ["Shop requests", "/requests", "Shops buyers recommended; mark them contacted, onboarded or dismissed."],
                ["Reviews", "/reviews", "Every review of a shop or of Localink; filter to low ratings, hide abusive reviews or delete them."],
                ["Admins", "/admins", "Add admins by email (or invite an email that has no account yet), remove admins."],
              ].map(([t, href, d]) => (
                <Link key={t} href={href} className="rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <p className="font-bold text-ink">{t} ›</p>
                  <p className="mt-1 text-sm">{d}</p>
                </Link>
              ))}
            </div>
            <p>The app has the same Admin console under Profile for admins on the go (reviews are moderated here, on the web). Admins cannot remove themselves, so there is always at least one.</p>
          </Section>

          <Section id="web" n={16} title="The merchant console (web)" who="Merchant">
            <p>
              Everything a merchant does in the app’s Merchant mode can also be done at <Link className="font-semibold text-brand hover:underline" href="/merchant">/merchant</Link> on a computer or a phone browser: set up and edit shops
              (with a map to pin locations), see all of a shop’s locations on a map with the orders waiting at each, filter orders by collection point,
              list and edit products with sizes, bulk prices and photos, confirm payments, scan or type vouchers and hand orders over (webcam or phone camera), follow revenue and download
              reports and receipts, read notifications and the shop’s reviews, rate and review Localink, and edit the profile. Any Localink account can sign in there; new merchants can create their account on the web.
            </p>
            <p>The app and the web share the same live data: a product saved on the web appears in the app (and for buyers) at once, and the other way round.</p>
          </Section>

          <Section id="rules" n={17} title="Rules & limits">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Localink never handles money; buyers pay shops directly with the details the shop published.</li>
              <li>A basket holds one shop’s products. Prices are in USD; buyers can view them in Rands at the shop’s own rate.</li>
              <li>Only the shop (or an admin) can confirm a payment, and handover needs a confirmed payment and every item ticked.</li>
              <li>Only admins can verify, pause or delete shops; merchants cannot verify their own.</li>
              <li>Orders are never deleted. Who an order belongs to (buyer, shop, recipient phone) cannot be changed after it is placed.</li>
              <li>An order, and the proof of payment on it, can be opened only by the people on that order (buyer, recipient, shop) and admins. Photos and proofs are limited to 8 MB.</li>
              <li>Vouchers show a “valid until” date 5 days after ordering.</li>
              <li>One review per person per shop, and one of Localink. Comments are limited to 1,000 characters. Owners cannot review their own shop or change its rating.</li>
            </ul>
          </Section>

          <Section id="open" n={18} title="Open questions before going live">
            <div className="space-y-3">
              <Note tone="warn">
                <b>Phone numbers are not verified.</b> Anyone can type someone else’s number into their profile and then see orders and notifications sent to that number. Add phone verification (for example a one-time SMS
                code with Firebase phone sign-in) before real use.
              </Note>
              <Note tone="warn">
                <b>Phone numbers must be typed the same way.</b> Received orders are matched on the digits exactly, so <i>+263 77 123 4567</i> and <i>077 123 4567</i> do not match yet. Storing every number in one format
                (+263…) would fix it.
              </Note>
              <Note tone="warn">
                <b>How Localink makes money is not decided.</b> Options include a monthly fee for merchants, a commission per order paid by the shop, or a small service fee paid by the buyer. Nothing is charged today.
              </Note>
              <Note tone="warn">
                <b>Vouchers do not expire on their own,</b> and there is no way to cancel or refund an order yet. The “valid until” date is shown, but a code still works after it. Decide what should happen to unpaid or
                uncollected orders.
              </Note>
            </div>
          </Section>
        </div>
      </article>

      <aside className="hidden lg:block">
        <nav className="sticky top-8 rounded-2xl border border-line bg-white p-4 text-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-3">On this page</p>
          <ol className="space-y-1">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-2 rounded-lg px-2 py-1 text-ink-2 transition hover:bg-surface-2 hover:text-brand">
                  <span className="w-5 text-xs font-bold text-ink-3">{i + 1}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
    </div>
  );
}
