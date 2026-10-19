# Kidzlim Store

E-commerce application for Kidzlim Islamic children's books — printed books fulfilled by
Gelato print-on-demand and digital PDF downloads, Stripe payments, Brevo email.

**Stack:** Next.js 16 (App Router, TypeScript strict) · Payload CMS 3 · SQLite **or** PostgreSQL.

**Hosting — two supported routes:**
- **Hostinger Node.js hosting** (Business / Cloud plans) with a SQLite file → see **`HOSTINGER.md`**.
- **Docker Compose on a VPS** with PostgreSQL behind Nginx → see *Deploying to the VPS* below.

The database is picked from `DATABASE_URL`: `file:/path/kidzlim.db` → SQLite,
`postgres://…` → PostgreSQL. Each has its own migrations (`src/migrations-sqlite`,
`src/migrations`); `npm run migrate:create -- <name>` writes both. Payload has no MySQL support.

The full brief is `kidzlim-build-brief.md` in the Google Drive project folder (`H:\My Drive\Webimation Projects\Kidzlim`).

## Status

**Phase 1 — scaffold** ✅ Next.js + Payload 3 + Postgres, Docker, roles, collections, health check, brand tokens.

**Phase 2 — storefront & content** ✅

| Route | Source |
|---|---|
| `/` | Page `home` (CMS blocks) |
| `/[slug]` | Any published Page — `about`, `privacy-policy`, `terms-of-use`, … |
| `/books` | All published books, filterable by series (`/books?series=learn-arabic`) |
| `/books/[slug]` | Book detail: format picker, quantity, add to basket, Book JSON-LD |
| `/sitemap.xml`, `/robots.txt` | Generated from published pages and books |
| `/index.html`, `/privacy-policy.html`, `/terms-of-use.html` | 301 → new URLs |

Page sections editable in the admin: hero, feature grid, rich text, book grid, testimonials, FAQ, call to action.

**Phase 3 — cart, shipping quotes, address** ✅

| Piece | Where |
|---|---|
| Basket (browser storage, synced across tabs) | `components/cart/CartProvider.tsx`, `/cart` |
| Server-side pricing — the browser only sends book id + SKU + quantity | `lib/cart/pricing.ts`, `POST /api/store/cart` |
| Checkout: contact, delivery address, live delivery options | `/checkout`, `components/cart/CheckoutView.tsx` |
| Gelato quote (`POST /v4/orders:quote`), typed + Zod-validated | `lib/integrations/gelato.ts`, `lib/shipping.ts`, `POST /api/store/shipping-quote` |
| Shipping country allowlist (Settings → env `STORE_SHIPPING_COUNTRIES` → `AE`) | `lib/shipping.ts` |
| Every secret read through `getCredential()` (Settings → env → loud failure) | `lib/credentials.ts` |
| Rate limiting on cart/quote endpoints | `lib/rate-limit.ts` |

Rules: digital books are limited to 1 copy per order; physical up to 20 per line. Digital-only
orders skip the address and shipping step. A quote is discarded as soon as the cart or address
changes. Phase 4 re-quotes on the server before creating the Stripe session — the browser's
shipping price is never trusted.

Printed variants have an optional **Page count** field; fill it in for multi-page books so Gelato
can price them.

To try checkout without a Gelato key, set `GELATO_MOCK=1` in `.env` (development only).

**Phase 4 — Stripe payments** ✅

1. **Pay securely** → `POST /api/store/checkout` re-prices the cart, **re-quotes shipping**, and
   refuses if the total differs from what the customer saw (`price_changed`), then creates a
   `pending` order and a Stripe Checkout Session: one line per book + a separate shipping line,
   AED, VAT-inclusive prices with **Stripe Tax** on, order id in `metadata`, idempotency keys on
   every Stripe call.
2. Customer pays on Stripe’s hosted page.
3. **Only the webhook** (`POST /api/store/stripe/webhook`, signature verified on every request)
   marks the order `paid`, inside a DB transaction. Each session is claimed once in the
   `webhook-events` ledger (UNIQUE key), so retries and duplicate deliveries are no-ops.
   `checkout.session.expired` → `cancelled`.
4. `/checkout/success` is cosmetic: it only reads the order and clears the basket.

### Stripe setup (test mode first)

1. In the Stripe dashboard (test mode) copy the **secret key** (`sk_test_…`) into
   Admin → Store Settings → Stripe (mode: *Test*), or `STRIPE_SECRET_KEY` in `.env`.
2. **Tax:** Stripe dashboard → Tax → add your UAE registration and origin address.
   Without a registration Stripe Tax charges/shows **0 VAT**.
3. **Webhook:** Developers → Webhooks → add endpoint
   `https://<domain>/api/store/stripe/webhook` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
   Copy its signing secret (`whsec_…`) into Settings or `STRIPE_WEBHOOK_SECRET`.
4. Locally, use the Stripe CLI to forward events:

   ```bash
   stripe listen --forward-to localhost:3000/api/store/stripe/webhook
   ```

   and use the `whsec_…` it prints. Pay with test card `4242 4242 4242 4242`.

The mode switch refuses to run with a mismatched key (Live mode + `sk_test_` key, or vice versa).

**Phase 5 — fulfilment** ✅

When the webhook marks an order paid it queues background jobs **in the same transaction**
(`src/jobs/fulfilment.ts`, queue `fulfilment`):

| Job | What it does | Done when |
|---|---|---|
| `sendOrderConfirmation` | Brevo “order confirmation” email | `confirmationSentAt` set |
| `deliverDigital` | New download token (only its SHA-256 is stored), expiry from Settings, Brevo “digital delivery” email. Digital-only orders → `delivered` | `digitalDeliveredAt` set |
| `submitGelatoOrder` | `POST /v4/orders` (`orderType: order`, `orderReferenceId` = order number, signed print-file URL, address, shipment method), idempotency key | `gelatoOrderId` set, status `submitted_to_gelato` |
| `resendDownload` | Queued by **Resend my download**; new token (old link stops working), “download resend” email | — |

- Jobs are idempotent and retry 8× with exponential backoff (~4 h). Failures are written to
  the order's fulfilment log. Only **one job per order runs at a time** (concurrency key) —
  Payload's `update` writes the whole document, so parallel steps would overwrite each other.
- The webhook starts the jobs right after answering Stripe; a cron (`jobs.autoRun`, every minute,
  started at boot by `src/instrumentation.ts`) is the safety net. `JOBS_AUTORUN=0` disables it.

**Digital files** (brief §5) live in **Shop → Book PDFs** (`protected-files`), stored in
`PROTECTED_MEDIA_DIR` outside the web root and readable only by admin/staff.

- Customers: `/download/<token>` → `/api/store/download/<token>/<sku>`. Checks the token, order
  status, expiry and a **per-book** download limit (Settings → *Max downloads*), then streams the
  PDF **stamped with the buyer's email and order number** on every page.
- Gelato: `/api/store/print-files/<id>?exp&sig` — HMAC-signed, valid 14 days, print files only.
- `/downloads/resend` — email + order number, rate-limited, same answer whether or not the order exists.
- Uploads are checked: valid unencrypted PDF, page count, page size, bleed (print files must have
  one page size). Printed variants' **Page count** fills in from the print file.

**Emails:** paste the templates from [`docs/brevo-templates/`](docs/brevo-templates/README.md)
into Brevo and put their IDs in Store Settings → Brevo.

Local testing without the real services: `GELATO_MOCK=1`, `BREVO_MOCK=1` (development only).

**Phase 6 — Gelato status, tracking emails, order management** ✅

**Gelato webhooks** → `POST /api/store/gelato/webhook`. Gelato doesn't sign webhooks, so every
request must carry the shared secret (header `x-kidzlim-webhook-secret`, or `?secret=` if Gelato is
set to query-parameter auth); anything else gets 401. Each delivery is recorded once in
`webhook-events`, then a `syncGelatoStatus` job **re-reads the order from Gelato's API** (the
webhook body is only a fallback) and:

- moves the order forward only (`submitted_to_gelato → in_production → shipped → delivered`);
  out-of-order events are ignored, cancelled/refunded orders are never revived;
- saves the tracking code + URL and, the first time it ships, sends the **shipping email**;
- flags **needs attention** for `failed`, `on_hold`, `returned` or a Gelato-side cancellation.

Setup: Gelato → Developer → Webhooks → add the URL above for `order_status_updated` (and
`order_item_status_updated` / `order_item_tracking_code_updated` if offered), enable
**Authorization → HTTP header**, name `x-kidzlim-webhook-secret`, value = Store Settings → Gelato →
*Webhook secret* (or `GELATO_WEBHOOK_SECRET`).

**Order actions** (sidebar of every order in the admin, rules in `lib/order-actions.ts`):

| Action | Who | When |
|---|---|---|
| Sync from Gelato | admin, staff | sent to Gelato |
| Send to Gelato again | admin, staff | paid, printed items, never submitted |
| Cancel print order | admin, staff | before printing starts (Gelato `:cancel`) — does **not** refund |
| Refund payment… | **admin only** | full or partial Stripe refund; full refund → `refunded` and download links stop working |
| Resend confirmation / download link | admin, staff | paid orders |
| Clear “needs attention” | admin, staff | when flagged |

Refunds made directly in the Stripe dashboard are picked up by the `charge.refunded` webhook.
The Orders list shows a **Needs attention** column.

**Phase 7 — credentials, test connection, roles, audit log** ✅

- **Encrypted secrets** (`fields/secret.ts`, `lib/crypto.ts`): Stripe secret + webhook secret,
  Gelato API key + webhook secret and Brevo API key are AES-256-GCM encrypted with
  `CREDENTIALS_ENCRYPTION_KEY` (server env only, never in the DB) before they are saved.
  They are **write-only**: every read — admin panel, REST, GraphQL — returns a mask such as
  `sk_live_••••4821`. Saving the form unchanged keeps the stored secret; clearing a field removes
  it. Values pasted in the wrong format (e.g. a `pk_` key in the secret field) are rejected.
- **Resolution order** (`lib/credentials-core.ts`): encrypted Settings value → environment
  variable → failure. If the key is missing or a stored value can't be decrypted, every admin
  page shows a **warning banner** to admins.
- **Test connection** buttons on the Stripe, Gelato and Brevo tabs make one harmless call each
  (`GET /v1/balance`, Gelato catalogue, `GET /v3/account`) and also check the webhook secrets,
  live/test mode, Brevo template IDs and sender. They test the **saved** settings.
- **Roles:** Store Settings, Pages, Users, the audit log, webhook log and job queue are
  admin-only. Staff manage Books (incl. images and book PDFs) and Orders, and can't refund or
  change their own role.
- **Audit log** (Admin → Audit log): every change a person makes to Orders, Store Settings and
  Users — who, when, field-by-field before/after — plus order actions and connection tests.
  Secret values are never written (only “changed”). Entries can't be edited or deleted.
  Automated changes are in each order's fulfilment log.

**Key rotation:** set the new key as `CREDENTIALS_ENCRYPTION_KEY`, the old one as
`CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`, restart, open Store Settings and save once, then remove the
old key. Losing the key means re-entering the API keys — back it up separately from the database.

**Phase 8 — catalogue, dashboard, hardening, launch prep** ✅ (launch itself: see `LAUNCH.md`)

- **Catalogue:** 97 books in 7 **Series** (Shop → Series), seeded with their covers by
  `npm run seed:books`. The shop page filters by series; each book page links its series and
  shows “More from this series”. Prices, page counts and descriptions are placeholders.
- **Admin dashboard** (`components/admin/StoreOverview.tsx`): orders today, net revenue for 7
  days, orders being fulfilled, orders needing attention, recent orders and — for admins — a
  **launch-readiness checklist** (API keys, Stripe live mode, support/sender email, shipping
  countries, Gelato product UIDs, print PDFs, digital PDFs).
- **Order write lock** (`lib/order-write.ts`): every programmatic order write (webhooks, jobs,
  admin actions, downloads) is serialised and re-reads the fulfilment log, so an admin action
  can no longer overwrite a background job's changes or vice versa.
- **Single job runner** (`lib/job-runner.ts`): Payload's job claiming isn't atomic, so
  overlapping runs could pick up the same job — testing showed four admin clicks sending a
  buyer four download emails. Jobs now run one pass at a time (every minute, plus straight after
  webhooks and admin actions). Payload's `autoRun` is no longer used.
- **Security headers** on every response (nosniff, frame, referrer, permissions; HSTS in
  production). Checkout, download and store-API responses are `noindex` and not cached.
- **Redirects:** `/shop`, `/store` → `/books`; `/book/<slug>` → `/books/<slug>` (plus the
  Phase 2 `.html` redirects).
- **Nightly backups** (`backup` compose service): Postgres dump + both upload volumes to
  `./backups`, 14 days kept. See **Backups** below.

**Run one app container.** The order lock and job runner work inside one Node process.


## Tests

```bash
npm test       # unit tests: pricing, shipping, Stripe, PDFs, signed URLs, Gelato/Brevo clients
npm run lint
```

## Seeding launch content

Creates the brand artwork in Media and the Home, About, Privacy and Terms pages (rewritten
from the original site for the book store). Safe to re-run — it updates pages by slug.

```bash
npm run seed
```

To also create the **book catalogue** — 97 published books in 7 series, with covers:

```bash
npm run seed:books
```

Existing books (matched by slug) are never overwritten, so edits made in the admin survive
re-runs. Printed editions use the placeholder Gelato UID `REPLACE_ME` and no book has a PDF yet —
the dashboard's launch checklist lists what's missing. On the VPS:
`docker compose --profile tools run --rm seed`.

## Access model

| | Admin | Staff | Public |
|---|---|---|---|
| Books | full | create / edit | published only |
| Series | full | create / edit | read |
| Book PDFs (protected files) | full | create / edit | — |
| Orders | full | read / edit + order actions (no refunds) | — |
| Pages | full | — | published only |
| Media | full | full | read |
| Users | full | own profile (can't change own role) | — |
| Store Settings | full (secrets masked) | — | — |
| Audit log | read only | — | — |
| Webhook log, job queue | read | — | — |

## Project layout

```
src/
  access/roles.ts          role helpers (admin, staff)
  app/(frontend)/          storefront (Kidzlim theme)
  app/(payload)/           Payload admin + REST/GraphQL (generated, don't edit)
  app/api/health/          health check
  blocks/                  page-builder blocks: hero, features, richText, bookGrid, testimonials, faq, cta
  collections/             Users, Media, Books, Pages, Orders
  components/              header, footer, book card, icons, block renderers
  components/admin/        Kidzlim logo/icon in the admin panel
  lib/                     CMS queries, cart pricing, shipping, credentials, media URLs, SEO
  lib/integrations/        thin typed API wrappers (Gelato; Stripe and Brevo in later phases)
  seed/                    launch content + brand artwork (npm run seed)
tests/                     vitest unit tests
  fields/                  shared seo + slug fields
  globals/Settings.ts      Stripe / Gelato / Brevo / store settings
  migrations/              production DB migrations
  styles/brand.css         brand tokens (colours, gradients, fonts, buttons)
  env.ts                   zod-validated environment
  payload.config.ts
```

## Local development (Windows)

1. Copy `.env.example` to `.env` and set `PAYLOAD_SECRET`. The default
   `DATABASE_URL=file:./data/kidzlim.db` uses a local SQLite file — nothing to install.
   (To use the local PostgreSQL instead, set `DATABASE_URL=postgres://postgres:<password>@127.0.0.1:5432/kidzlim`
   after `createdb kidzlim`.)

2. Seed content: `npm.cmd run seed:books` (pages + catalogue).

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000/admin and create the first user — it becomes **admin**.

In development Payload pushes schema changes to the database automatically.

**Troubleshooting**

- *“We’ll be right back” / `password authentication failed for user "postgres"`* — the password in
  `DATABASE_URL` (`.env`) is wrong or still the placeholder. Fix it and restart the dev server.
- *PowerShell: `npm.ps1 cannot be loaded because running scripts is disabled`* — run commands from
  `D:\dev\kidzlim-store` with `npm.cmd` instead of `npm` (e.g. `npm.cmd run dev`), or use Git Bash.

After changing any collection or global:

```bash
npm run generate:types       # refresh src/payload-types.ts
npm run generate:importmap   # only if admin components changed
```

## Database migrations

Production does **not** auto-push schema. Before deploying a schema change:

```bash
npm run migrate:create -- <name>
```

This writes a migration for SQLite (`src/migrations-sqlite/`) and PostgreSQL (`src/migrations/`).
Commit both. They are applied automatically when the
production container boots (`prodMigrations` in `payload.config.ts`).

## Deploying to the VPS

1. On the VPS, clone the repo into e.g. `/home/kidzlim/store`.
2. Create `.env` from `.env.example`. Set `POSTGRES_PASSWORD`, `PAYLOAD_SECRET`,
   `CREDENTIALS_ENCRYPTION_KEY` (generate with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and keep a copy
   somewhere safe), `NEXT_PUBLIC_SERVER_URL=https://<domain>` and `APP_PORT` (a free local port).
   `DATABASE_URL` and `MEDIA_DIR` are set by compose.
3. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

4. In CloudPanel, add a **Reverse Proxy** site for the domain pointing to
   `http://127.0.0.1:<APP_PORT>`, and enable Let's Encrypt. Raise the upload limit in the
   vhost for print PDFs: `client_max_body_size 200M;`
5. Check `https://<domain>/api/health` returns `{"status":"ok"}`, then create the admin user at
   `/admin`.

Updating: `git pull && docker compose up -d --build`.

Data lives in the named volumes `pgdata` (database), `media` (public images) and
`protected-media` (paid PDFs).

## Backups

The `backup` service writes a nightly snapshot at `BACKUP_AT` (UTC, default 02:30) to
`./backups/<timestamp>/`: `db.dump` (pg_dump, custom format), `media.tar.gz`,
`protected-media.tar.gz` and `SHA256SUMS`. Snapshots older than `BACKUP_KEEP_DAYS` (14) are
deleted. Take one now with `docker compose run --rm backup --now`.

**Copy them off the VPS** — a backup on the same disk doesn't survive losing the server. For
example with [rclone](https://rclone.org) configured for any cloud storage, add a host cron entry:

```bash
15 3 * * * rclone copy /home/kidzlim/store/backups remote:kidzlim-backups --max-age 48h
```

Keep `CREDENTIALS_ENCRYPTION_KEY` and `.env` somewhere separate (e.g. a password manager): the
backups don't contain them, and the database is useless for API keys without the key.

**Restore** (into the running stack). Volume names are prefixed with the compose project name —
check them with `docker volume ls` (e.g. `store_media`):

```bash
docker compose stop app
docker compose exec -T db pg_restore -U kidzlim -d kidzlim --clean --if-exists --no-owner < backups/<stamp>/db.dump
docker run --rm -v store_media:/data/media -v store_protected-media:/data/protected-media -v "$PWD/backups:/backups:ro" alpine   sh -c "tar -xzf /backups/<stamp>/media.tar.gz -C /data && tar -xzf /backups/<stamp>/protected-media.tar.gz -C /data"
docker compose start app
```

Practise a restore once before launch.
