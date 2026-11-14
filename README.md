# Localink console (web)

Next.js console for Localink with two sides, on the same Firebase project and
live data as the mobile app (`../Localink`):

- **Merchant console** (`/merchant`): everything the app's Merchant mode does.
  Any Localink account can sign in; new merchants can create an account here.
- **Admin console** (`/`): for accounts listed as admins. Includes **How it
  works** (`/guide`), a guide to the whole system with screenshots of the app.

Signing in takes admins to the admin console and everyone else to the
merchant console; the sidebars link the two for admins who also run shops.

## What merchants can do

| Page | |
|---|---|
| Overview | Active shop, sales this month, payments to check, orders awaiting pickup; switch shops in the sidebar |
| Orders | Awaiting pickup / payments to check / completed; an order's details, the buyer's **proof of payment**, **Confirm payment**, receipt PDF |
| Scan & collect | Read the recipient's QR with the computer's or phone's camera, or type the code (or its last digits, or the PIN); tick items, add a handover photo, **Confirm handover** |
| Products | Search, filter, quick stock +/−, hide/show; add or edit with **sizes and units, bulk prices, up to 4 photos** |
| Revenue | Month by month, 6-month chart, **PDF and CSV** downloads |
| Shop settings | Photos, details, **map pin**, categories, opening hours, payment methods, branches, delivery and Rand rate; add another shop |
| Notifications | The same notifications as the app, live; opening one marks it read |
| Reviews | What buyers say about the active shop: rating, star breakdown, every review |
| Rate Localink | Rate and review Localink itself (one review, editable), and read everyone's reviews of it |
| Profile | Name, phone, city, "Let people find me" |
| Plan | Basic, Standard, Pro and Max with prices; free 7-day / 10-order trials; buy or renew any plan (earnings, online, transfer) |
| Earnings | Balance, payout schedule for the plan, each payout's breakdown (purchased, discounted by Localink, paid to you) |
| Verify your identity | The Didit identity check shop owners need before Localink can verify their shops |

Notes:

- Product changes are saved one product at a time from the latest copy on the
  server, so the app and the web never undo each other's edits.
- The camera only works on `https://` (and `localhost`).
- Maps use OpenStreetMap (no API key needed).
- Push notifications reach phones only; the web console shows notifications
  live in the page. (Browser push would need the Firebase JS SDK's newer
  `register()` API, which version 11 does not have.)

## What admins can do

| Page | |
|---|---|
| Dashboard | Users, merchants, shops, sales this month, 6-month chart, shops to verify, recent orders |
| Shops | Search/filter, **verify** (only once the owner's identity is verified), **suspend / restore** (hides the shop from buyers), give a free month of any plan, delete, see payment methods, hours, branches, products |
| Payouts | Payouts to send, with what each is made of (sales at full price, Localink's discount on them); mark paid or failed |
| Payment settings | Localink's accounts, plan prices, fees and limits (products and branches per plan), Localink's discount for big baskets, Paynow and Didit keys (write-only) |
| Users | Search/filter, **suspend / restore** accounts, **make admin** |
| Send notification | To all users, merchants, customers, or people found by name, email or phone (each shown as Merchant or Customer); arrives in the app and as a push message; history of what was sent |
| Orders | Search/filter by status and payment, order details, open the buyer's proof of payment |
| Shop requests | Shops buyers recommended; mark contacted / onboarded / dismissed |
| Reviews | Every review of a shop or of Localink; filter to 1–2 stars, **hide** (leaves public lists and ratings) or delete |
| Admins | **Add admins by email** (existing account, or an invite the person claims on first sign-in), remove admins |
| How it works | The whole system from sign-up to collection: who does what, when; statuses, notifications, rules, open questions |

The guide's phone pictures (`public/guide/app/*.png`) are rendered from the
app with its demo data. To refresh them after changing the app:

```bash
cd ../Localink
LOCALINK_SCREENSHOTS=1 flutter test test/docs_screenshots_test.dart   # PowerShell: $env:LOCALINK_SCREENSHOTS=1; flutter test …
```

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
```

`.env.local` already holds the Firebase web config of the `stalllinkweb`
project (public client keys, same as the app's `firebase_options.dart`).
For another project copy `.env.example` to `.env.local` and fill it in.

## One-time setup

1. **Deploy the rules and functions** from the app folder (the rules include
   the admin and review rules; the functions keep shop ratings up to date):
   ```bash
   cd ../Localink
   firebase deploy --only "firestore:rules,storage,functions" --project stalllinkweb
   ```
   The first storage deploy asks to let Storage rules read Firestore; say yes
   (the shop that received an order needs it to see the payment proof).
2. **Create the first admin** (the rules only let admins add admins, so the
   first one is added by hand):
   - Sign up in the app or sign in here once, so the account exists.
   - Firebase console → Authentication → Users → copy that account's **User UID**.
   - Firestore → Start collection `admins` → Document ID = that UID → add a
     field `email` (string) with the account's email → Save.
   - Sign in on this site. From then on, add every other admin from the
     **Admins** page (or the app's Admin console).
3. Google sign-in on the web needs **Authentication → Sign-in method → Google**
   enabled, and the address the console (or the Flutter web app) is opened on
   listed under **Authentication → Settings → Authorized domains**. `localhost`
   is there by default, but `127.0.0.1`, a LAN address such as `192.168.x.x`
   (opening the dev server from a phone) and your hosting domain are not:
   otherwise Google sign-in fails with `auth/unauthorized-domain` (the login
   page now says which address to add).

## Deploy

Any Next.js host works (Vercel, Firebase App Hosting, a Node server with
`npm start`). Set the six `NEXT_PUBLIC_FIREBASE_*` variables in the host.
"# localink" 
