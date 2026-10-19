# Kidzlim store — launch checklist

Work top to bottom. The admin dashboard's **Launch readiness** panel shows the checks the app can
make for itself; everything else is here. Steps marked 🧪 are done with **test** keys first.

## 1. Server

- [ ] VPS stack running: `docker compose up -d --build`, then `https://<domain>/api/health` → `{"status":"ok"}`.
- [ ] Only **one** `app` container (no `--scale`); the order lock and job runner are in-process.
- [ ] `.env` filled from `.env.example`: `PAYLOAD_SECRET`, `POSTGRES_PASSWORD`,
      `CREDENTIALS_ENCRYPTION_KEY`, `NEXT_PUBLIC_SERVER_URL=https://<domain>`.
- [ ] `.env` and `CREDENTIALS_ENCRYPTION_KEY` saved in a password manager (not only on the VPS).
- [ ] CloudPanel reverse proxy + Let's Encrypt; `client_max_body_size 200M;` for print PDFs.
- [ ] First admin user created at `/admin` with a strong, unique password; staff accounts created
      with the **Staff** role.
- [ ] Content seeded: `docker compose --profile tools run --rm seed` (pages + catalogue).

## 2. Catalogue (Admin → Shop)

The seeded catalogue is placeholder content. For each book you'll sell:

- [ ] Title, description, age range and **prices** checked (AED, VAT-inclusive).
- [ ] **Digital edition:** upload the PDF under *Book PDFs* (type: digital) and pick it on the variant.
- [ ] **Printed editions:** upload the print-ready PDF with bleed (type: print), pick it on the
      variant, and replace `REPLACE_ME` with the real **Gelato product UID** for that size/binding.
- [ ] Books you won't sell yet: set to **Draft** (or untick *Active* on a variant you don't offer).
- [ ] Dashboard → Launch readiness shows ✓ for Gelato UIDs, print PDFs and digital PDFs.

## 3. Email (Brevo)

- [ ] Brevo → Senders & IP → **authenticate the domain**: add the SPF, DKIM and DMARC DNS records
      Brevo gives you. Without these, Gmail will junk order emails.
- [ ] Create the templates from `docs/brevo-templates/` and put their IDs in Store Settings → Brevo.
- [ ] Sender email (on the authenticated domain) and **support email** set in Store Settings.
- [ ] Store Settings → Brevo → **Test connection** all ✓.

## 4. Payments (Stripe) 🧪

- [ ] Stripe account activated (business details, bank account).
- [ ] Stripe → Tax: UAE VAT registration added (otherwise VAT shows as 0).
- [ ] Webhook endpoint `https://<domain>/api/store/stripe/webhook` with events
      `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
      `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
- [ ] Secret key + webhook signing secret in Store Settings → Stripe; **Test connection** all ✓.

## 5. Printing (Gelato)

- [ ] Live Gelato API key in Store Settings → Gelato.
- [ ] Gelato webhook: `https://<domain>/api/store/gelato/webhook?secret=<webhook secret>` (status events).
- [ ] Shipping countries chosen in Store Settings; **Test connection** all ✓.

## 6. Test orders 🧪 (Stripe in test mode, card `4242 4242 4242 4242`)

For each order check: the confirmation email arrives (inbox, not spam), the order in the admin
reaches the right status and its fulfilment log has no `.failed` entries.

- [ ] **Digital only** → download email arrives, the PDF opens and is stamped with the buyer's email,
      the link stops working after the download limit.
- [ ] **Printed only** → order appears in the Gelato dashboard. Cancel it there (or with
      *Cancel print order* in the admin) so it isn't printed.
- [ ] **Mixed** (digital + printed) → both of the above on one order.
- [ ] **Refund** a test order from the admin → Stripe shows the refund, the download link stops working.
- [ ] A country you don't ship to is refused at checkout with a clear message.
- [ ] *Resend my download link* page sends a new link for a past digital order.

## 7. Go live

- [ ] Store Settings → Stripe: switch to **Live**, paste the **live** secret key and the live
      webhook's signing secret (live mode has its own webhook endpoint — create it).
- [ ] **Test connection** ✓ in live mode; dashboard Launch readiness all ✓.
- [ ] One real order to your own address (printed + digital), then refund it if you like.
- [ ] Point the domain's DNS at the VPS. Old URLs (`/index.html`, `/privacy-policy.html`,
      `/terms-of-use.html`) redirect automatically.
- [ ] Google Search Console: add the domain, submit `https://<domain>/sitemap.xml`.

## 8. After launch

- [ ] First nightly backup present in `./backups` and copied off the VPS (see README → Backups).
- [ ] Restore practised once.
- [ ] An uptime monitor on `https://<domain>/api/health`.
- [ ] Check the dashboard daily for **Needs attention** orders.
