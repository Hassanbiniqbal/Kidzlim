# Deploying to Hostinger Node.js hosting (Business / Cloud plans)

This runs the store as a **Node.js web app** in hPanel with a **SQLite** database file.
(Payload CMS doesn't support MySQL, so the hosting's MySQL databases aren't used.)
For the Docker/VPS route with PostgreSQL, see the README instead.

## How it fits Hostinger

| Hostinger behaviour | What the store does about it |
|---|---|
| Every deploy builds into a fresh `hbuilds/versions/<id>` folder and replaces `public_html` | The database, images and book PDFs live in **`/home/<user>/kidzlim-data`**, outside the app folder, via environment variables |
| Hostinger installs dependencies and runs `npm run build` itself (15-minute limit) | Upload the **source** bundle; `postbuild` completes Next's standalone server, which Hostinger starts |
| Idle apps are stopped and woken by the next request | An **hPanel cron job** calls `/api/store/cron` every 5 minutes: runs pending fulfilment jobs (emails, Gelato) and takes the daily database snapshot |
| One running process | Matches the store's in-process order lock and job runner |

## 1. Prepare on your PC

In `D:\dev\kidzlim-store`:

```bash
npm.cmd run seed:hostinger
```

```bash
npm.cmd run package:hostinger
```

`seed:hostinger` creates a production database with the pages and the 97-book catalogue in
`deploy/data/` (images included). `package:hostinger` writes two files to `deploy/`:

- `kidzlim-source.tar.gz` — the app source (no secrets, no `node_modules`, no data).
- `kidzlim-data.tar.gz` — the seeded database + images.

Skip `seed:hostinger` if you'd rather start with an empty store (the database is then created
on first start).

## 2. Create the data folder

hPanel → **File Manager**. Note your home path at the top (e.g. `/home/u123456789`).

1. In the home folder (not inside `domains/` or `public_html`), create **`kidzlim-data`**.
2. Upload `kidzlim-data.tar.gz` into it and **Extract** it there. You should see `kidzlim.db`
   and a `media` folder directly inside `kidzlim-data`.

## 3. Create the Node.js app

hPanel → **Websites → Add website → Node.js app** (or your site → **Node.js**):

- Source: **Upload archive** → `deploy/kidzlim-source.tar.gz`
  (or connect a GitHub repo, which redeploys on every push).
- Framework: **Next.js** · Node version: **22** · Root directory: `/`
  · Build script: `build` · Output directory: `.next` · Package manager: npm.
- **Environment variables:** fill in `.env.hostinger.example` (paths with your username,
  domain, three generated secrets) and import it. Don't set `NODE_ENV`.

Deploy and watch the build log. When it finishes, open `https://<domain>/api/health` →
`{"status":"ok","db":"ok"}`.

## 4. Cron job

hPanel → **Advanced → Cron Jobs** → custom command, **every 5 minutes**:

```bash
curl -fsS -m 120 -H "x-cron-secret: <your CRON_SECRET>" https://<domain>/api/store/cron > /dev/null
```

To check it, run the same command once from hPanel's cron "Run now" (or SSH): it should print
nothing and exit without error. A wrong secret returns 403.

## 5. First login and settings

1. `https://<domain>/admin` → create the first admin user (strong password).
2. Admin → **Store Settings**: Stripe, Gelato and Brevo keys; support and sender email;
   shipping countries. Use **Test connection** on each tab.
3. Webhooks:
   - Stripe → `https://<domain>/api/store/stripe/webhook` (events listed in `LAUNCH.md`).
   - Gelato → `https://<domain>/api/store/gelato/webhook?secret=<Gelato webhook secret>`.
4. Follow `LAUNCH.md` from section 2 (catalogue, email DNS, test orders, go live).

## Updating the site

Run `npm.cmd run package:hostinger` and upload the new `kidzlim-source.tar.gz` under the app's
**Deployments** (or push to GitHub). Data in `kidzlim-data` is untouched. Schema changes are
applied automatically on start from `src/migrations-sqlite`. When the schema changes, create
migrations for both databases with:

```bash
npm.cmd run migrate:create -- <name>
```

## Backups

- **Database:** the cron call saves one consistent snapshot a day to `kidzlim-data/backups/`
  (`kidzlim-YYYYMMDD-HHMMSS.db`), keeping `BACKUP_KEEP_DAYS` days.
- **Images and PDFs:** plain files in `kidzlim-data/media` and `kidzlim-data/protected-media`.
- Hostinger's own backups (hPanel → **Backups**) include the home folder. Also download
  `kidzlim-data` every week or so (File Manager → compress → download) to keep a copy off Hostinger.
- **Restore:** stop the app (Node.js app → Stop), replace `kidzlim.db` with a snapshot
  (rename it to `kidzlim.db`), start the app.
- Keep `PAYLOAD_SECRET`, `CREDENTIALS_ENCRYPTION_KEY` and `CRON_SECRET` in a password manager.

## Things to check early

- **Large uploads:** print-ready PDFs can be big. Upload one in Admin → Book PDFs straight after
  the first deploy; if it fails, ask Hostinger support to raise the request-size limit for the site.
- **Cold starts:** after the app has been idle, the first visit takes a few seconds while it
  starts. The 5-minute cron call keeps this rare.
- **Build memory/time:** if the build log shows an out-of-memory error or the 15-minute limit,
  contact Hostinger support or use a Cloud plan.
