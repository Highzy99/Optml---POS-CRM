# OPTML CRM v2 — Setup Guide

A full sales + inventory + customer CRM that never loses data on redeploy. Data lives in Supabase (free tier), courier gets notified on Telegram automatically, and the app itself is three static files you drop on Netlify or Vercel.

**Files**
```
index.html            the app
app.js                logic
styles.css            styling (OPTML brand: Onest, ink, goal colours)
assets/               Onest font, wordmark, goal badges, product photos
supabase-schema.sql   run once in Supabase
README.md             this guide
```

---

## 1. Supabase (5 minutes)

1. Go to **supabase.com** → New project. Name it `optml-crm`, pick a strong database password, region **Sydney**.
2. Wait for the project to finish provisioning (~1 min).
3. Left sidebar → **SQL Editor** → **New query** → paste the entire contents of `supabase-schema.sql` → **Run**.
   You should see "Success. No rows returned." This creates all tables, security rules, and loads your 51 products with catalogue prices.
4. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
   Enter your email and a password. Tick **Auto Confirm User**. This is your login.
5. Left sidebar → **Project Settings** → **API**. Copy two things:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting `eyJ…`)

Keep those two handy for step 3.

---

## 2. Telegram courier bot (2 minutes)

1. In Telegram, message **@BotFather** → send `/newbot` → follow the prompts (name it e.g. `OPTML Orders`). Copy the **token** it gives you.
2. Create a group chat with your courier (or just use a DM with the bot). Add the bot to the group.
3. Send any message in that group (e.g. "hi") so the bot can see it.
4. Later, in the CRM Settings tab, paste the token and tap **Find chat ID** — it'll pick up the group automatically.

> If your courier prefers WhatsApp instead: every sale has a **Copy courier text** button that gives you the exact message to paste into WhatsApp.

---

## 3. Deploy

### Option A — Netlify (easiest)
1. Go to **app.netlify.com** → **Add new site** → **Deploy manually**.
2. Drag the whole `optml-crm-v2` folder onto the page.
3. Done. You get a URL like `https://something.netlify.app`. Rename it under Site settings if you want.

### Option B — Vercel
1. Go to **vercel.com** → **Add New** → **Project** → **Upload** (or connect a GitHub repo containing these files).
2. Framework preset: **Other**. Root directory: the folder. Deploy.

Both are free. Updating later = re-upload the same folder. **Your data is in Supabase, so redeploying never touches it.**

---

## 4. First login

1. Open your deployed URL.
2. Paste the Supabase URL and anon key → **Save & continue**.
3. Sign in with the email/password from step 1.4.
4. Tap **⋯** (top right) → **Courier, templates, shipping** → paste Telegram token → **Find chat ID** → **Send test** → **Save settings**.
5. Go to **Stock** → use the − / + on each row to set counts (or tap a product to edit everything). Tap the 🚀 to mark launch products.

That's it. Add the site to your iPhone home screen (Share → Add to Home Screen) and it runs like a native app.

---

## How the sale flow works

```
New Sale → Complete
   │
   ├─ Paid + I'll post it → status "Paid" → add tracking → "Dispatched" (courier never involved)
   │
   ├─ Paid + Courier  →  status "Paid"  →  Telegram sent to courier automatically  →  status "Sent to Courier"
   │                                              │
   │                                    courier posts it, tells you tracking #
   │                                              │
   │                              Sales tab → open sale → Dispatch message → enter tracking → Copy
   │                                              │
   │                                        status "Dispatched" · customer message in clipboard → paste to WhatsApp
   │
   ├─ Awaiting payment  →  status "New"  →  change to "Paid" when money lands → Resend to courier
   │
   └─ Walk-in  →  no courier message, straight to Delivered when you choose
```

**Statuses:** New → Paid → Sent to Courier → Dispatched → Delivered (or Cancelled)

---

## Features

Built phone-first. Five tabs along the bottom — **Home · Sales · Sell · Stock · People** — plus **⋯** for reports, backup and settings. On a laptop the tabs become a sidebar.

**Home** — today / 7-day revenue with trend, open orders, a 14-day revenue chart, a *Needs attention* feed (orders awaiting payment, orders not yet sent to the courier, orders waiting on tracking, launch products below minimum, overdue incoming stock — each with a one-tap action), and recent sales.

**Sell** (the + button) — three steps:
1. *Items* — search → tap product → pick single / 3-pack / 10-pack → cart. Bac water counts itself (3ml per vial, 10ml for NAD+), tap to adjust. Manual $ amount for off-catalogue sales.
2. *Customer* — Shipped or Walk-in. Find an existing customer (with their spend shown), tap a recent customer chip, or **Paste** a copied name/address/phone block and it fills the fields itself.
3. *Review* — shipping ($15 or free over $200, automatic), discount (% or $), Cash / BKP / KJ / Split, and **Paid** (sends to courier immediately) or **Awaiting payment**.
After the sale you land on the sale's detail page.

**Sales** — To dispatch / Dispatched / Delivered / All, grouped by day, search anything. Sale detail shows a status timeline, one-tap actions (mark paid, send/resend to courier, add tracking & dispatch, mark delivered, copy courier text, SMS/call), items, totals and notes. The dispatch drawer takes a tracking number (typed, or read from a label photo on phones that support it), shows the customer message, copies it and marks the sale Dispatched.

**Stock** — products are grouped by OPTML goal (Weight, Energy, Restore, Growth, Edge, Vitality, Sleep, Immunity, Glow, Essentials) with the goal badge and product photo. Three views: *Inventory* (grouped by category, 🚀 toggle, stock level with bar, − / + quick count, tap to edit; alert banner when launch products need reordering), *Incoming* (purchase orders with multiple lines, supplier, ref, ETA +14 days, delivery details; **Arrived** adds the stock), *Movements* (every stock change).

**People** — customers auto-created from sales. Spend, orders, last order, *due* flag (30+ days), *VIP* (5+ orders). Detail shows contact buttons, what they buy most, quick message templates (tap to copy), full order history and **New sale** pre-filled.

**Insights** (tap the 14-day chart on Home, or ⋯ → Insights) — pick 7 / 30 / 90 days or all time: revenue and net profit with change vs the previous period, the full profit breakdown (product cost in USD converted at your rate → gross profit → courier share → net), average order, vials per order, paid-to-dispatch time, a revenue/net trend chart, top products with gross margin, sales by goal, payment mix, best weekdays, repeat-customer rate and top customers, and stock cover (days left at the last-30-day sales pace, including incoming stock).

**Profit on every sale** — each sale's detail page shows product cost, gross profit, the courier's share and net profit. Supplier costs are snapshotted on the sale at the time, so later price changes don't rewrite history. Set the USD→AUD rate and courier share under ⋯ → Settings → Profit (defaults 1.55 and 25%; the courier share applies to shipped orders only).

**WhatsApp** — two modes, set under ⋯ → Settings → Customers — WhatsApp:
- *Open WhatsApp* (default, no setup): every "Send on WhatsApp" button opens WhatsApp / WhatsApp Business on your phone with the customer's number and the message already typed — you press send. Works from the dispatch drawer, the quote drawer, the sale page, and the customer page (quick messages). Every one of these also has a **Copy** button.
- *Business API (auto-send)*: messages go out automatically through Meta's WhatsApp Business Platform. You need a Meta Business app with WhatsApp added, a registered number (it can't be the same number you use in the WhatsApp Business app unless you migrate it), a **permanent** System User access token with `whatsapp_business_messaging`, and an **approved message template** for dispatch (customers you haven't chatted with in 24 h can only receive templates). Create the template with body `Hi {{1}}! Your order has been dispatched… Track here: https://auspost.com.au/mypost/track/#/details/{{2}}`, then enter the Phone number ID, token, template name and language in Settings and hit *Send test to my number*. If an API send fails the app falls back to opening WhatsApp.
- Optional: put your courier's WhatsApp number in Settings and every shipped sale gets a *Courier on WhatsApp* button carrying the order message (same text as Telegram).

**Courier payments** (⋯ → Courier payments) — the courier's share accrues on every courier-shipped order the moment it's marked Dispatched. The tracker shows what's owed now, earned this month, paid to date, the unpaid orders with each one's share, and a payment history. **Record payment** defaults to the full balance (or enter what you actually paid — it settles the oldest orders first and carries any remainder as credit). **Statement** prints a settlement page; if the courier's WhatsApp number is set you can send them the list in one tap. Home flags it when something has been owed for more than a week. Every sale's profit card shows whether its courier share is *owed* or *paid*.

**Fulfilment** — three options at checkout: **Courier** (Telegram goes to the courier when paid, courier earns their share), **I'll post it** (nothing goes to the courier, no share, you still get tracking + the dispatch message), **Walk-in**. Change it later from the sale page if plans change.

**Quotes** — in New Sale, build the cart, then tap **Quote** (top right). It writes the quote from your template (items, bac water, shipping, total, payment options), lets you edit it, and either opens it in WhatsApp to the customer's number or copies it. The template is editable under Settings → Quote message.

**Reports** (⋯ menu and section buttons) — Sales (today / 7 days / month / 30 / 90 / all / custom range, with payment split, by product, by day and every order), Launch & reorder (10-pack supplier order sheet), Inventory, Incoming, Movements, Customers, and a Full business report. Each opens as a clean page with **Print / PDF**.

**Backup** — ⋯ → Backup to file / Restore from file. Restore accepts backups from the old stocktake app too.

**Multi-device** — with Supabase, phone and laptop stay in sync within a couple of seconds.

---

## Settings you can change

- Telegram bot token + chat ID
- Courier message template — placeholders `{sale_no} {name} {phone} {address} {items} {bac} {notes} {total}`
- Customer dispatch template — placeholders `{first_name} {name} {tracking} {sale_no}`
- Shipping flat rate and free-shipping threshold
- USD→AUD rate for product cost, and the courier's share of gross profit

---

## Troubleshooting

**"Could not load data"** — the Supabase URL or key is wrong, or you haven't run the SQL. Check step 1.3 and 1.5.

**Sign in fails** — make sure you ticked *Auto Confirm User* when creating the user. Or go to Authentication → Users and confirm it there.

**Telegram test fails** — the bot must be in the group and someone must have sent a message after adding it. Tap Find chat ID again.

**Want to run it without Supabase?** — tap *Skip — this device only* on the connection screen. Everything works, data lives in that browser only (back it up before redeploying).

## Paste a web order

Customers order from the price list / wholesale catalogue sites, which send a formatted message to the business WhatsApp. In **Sell → Paste order**, paste that message (or tap the button with it on the clipboard): items, pack sizes, quantities, the prices they were quoted, discount, shipping, name, phone, email and address all fill in. Nothing is saved yet — change quantities, remove or add items, fix the address, then Next → Complete as usual. The order ref (OPT-xxxxx) goes into the sale notes; anything not in the catalogue becomes a manual amount and is listed in the notes.
