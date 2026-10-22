# Deploying to a Hostinger VPS with CloudPanel

The store runs as a **CloudPanel Node.js site**: CloudPanel's Nginx serves the domain and HTTPS and
forwards requests to the app on a local port; **PM2** keeps the app running; the database is a
**SQLite file** next to the uploaded images and PDFs in a folder outside the project.

Example values below: site user `webi-kidzlim`, domain `kidzlim.webimation.io`, project folder
`/home/webi-kidzlim/htdocs/kidzlim.webimation.io`. Replace them if yours differ.

## 0. Check the site type

The site must be a **Node.js** site. In CloudPanel → Sites, the site's type is shown in the list;
a Node.js site's Settings tab also has a **Node.js Settings** box (Node version + **App Port**).

If it was created as a PHP or Static site, delete it (it's empty) and add it again:
**Add Site → Create a Node.js Site** → domain `kidzlim.webimation.io`, **Node.js 22**, App Port
`3000` (or any free port — note it), site user `webi-kidzlim`.

## 1. SSL

Site → **SSL/TLS → Actions → New Let's Encrypt Certificate**. The domain must already point to
the VPS IP. (The admin login cookie only works over HTTPS.)

## 2. Allow big uploads (print PDFs)

Site → **Vhost**: inside the `server { … }` block for port 443 add

```nginx
client_max_body_size 256M;
```

and **Save**.

## 3. SSH in and prepare

Use the site user's SSH login (Site → SSH/FTP; add your SSH key under Site User Settings, or
set a password).

```bash
ssh webi-kidzlim@72.62.31.211
```

Check Node and install PM2 for this user:

```bash
node -v
```

```bash
npm install -g pm2
```

`node -v` should print v22 (CloudPanel installs the version chosen for the site).

## 4. Get the code

The project folder CloudPanel created must be empty for `git clone`:

```bash
cd ~/htdocs && rm -rf kidzlim.webimation.io && git clone https://github.com/Hassanbiniqbal/Kidzlim.git kidzlim.webimation.io
```

If the repository is **private**, create a read-only deploy key first and clone over SSH:

```bash
ssh-keygen -t ed25519 -C kidzlim-vps -f ~/.ssh/id_ed25519 -N ""
```

```bash
cat ~/.ssh/id_ed25519.pub
```

Add that key on GitHub → repo → Settings → Deploy keys (read-only), then clone with
`git clone git@github.com:Hassanbiniqbal/Kidzlim.git kidzlim.webimation.io`.

## 5. Data folder (database, images, PDFs)

```bash
mkdir -p ~/kidzlim-data
```

To start with the 97-book catalogue: on your PC run `npm.cmd run seed:hostinger` and
`npm.cmd run package:hostinger`, upload `deploy/kidzlim-data.tar.gz` to `/home/webi-kidzlim/`
(CloudPanel File Manager or SFTP), then:

```bash
tar -xzf ~/kidzlim-data.tar.gz -C ~/kidzlim-data && rm ~/kidzlim-data.tar.gz
```

Skip this to start with an empty store (the database is created on first start).

## 6. Settings file

```bash
cp ~/htdocs/kidzlim.webimation.io/.env.vps.example ~/kidzlim.env && chmod 600 ~/kidzlim.env
```

Generate the three secrets and paste them into `~/kidzlim.env` (`nano ~/kidzlim.env`). Set
`APP_PORT` to the site's App Port. Keep a copy of the file in a password manager.

```bash
openssl rand -hex 32
```

```bash
openssl rand -base64 32
```

(`hex` → `PAYLOAD_SECRET` and `CRON_SECRET`; `base64` → `CREDENTIALS_ENCRYPTION_KEY`.)

## 7. Build and start

```bash
cd ~/htdocs/kidzlim.webimation.io && bash scripts/deploy-vps.sh
```

It installs, builds (~2–5 minutes), starts the app with PM2 and ends with `✓ Kidzlim is running`.
Then open `https://kidzlim.webimation.io/admin` and create the first admin account.

## 8. Cron jobs (Site → Cron Jobs)

| Schedule | Command |
|---|---|
| `*/5 * * * *` | `curl -fsS -m 120 -H "x-cron-secret: <CRON_SECRET>" http://127.0.0.1:3000/api/store/cron > /dev/null` |
| `@reboot` | `cd /home/webi-kidzlim/htdocs/kidzlim.webimation.io && /home/webi-kidzlim/.nvm/versions/node/$(ls /home/webi-kidzlim/.nvm/versions/node \| tail -1)/bin/pm2 resurrect` |

The first runs pending order jobs and takes the daily database snapshot; the second restarts the
app after a server reboot (site users can't use `pm2 startup`). If your Node isn't under `~/.nvm`,
use the path from `which pm2`. Use the App Port if it isn't 3000.

## Updating the site

Push to GitHub from your PC, then on the VPS:

```bash
cd ~/htdocs/kidzlim.webimation.io && bash scripts/deploy-vps.sh
```

Data in `~/kidzlim-data` and settings in `~/kidzlim.env` are never touched by updates.

## Useful commands

```bash
pm2 status
```

```bash
pm2 logs kidzlim --lines 100
```

```bash
pm2 restart kidzlim
```

## Backups

- `~/kidzlim-data/backups/` gets one consistent database snapshot per day (14 kept).
- CloudPanel → **Admin Area → Backups** can copy sites to remote storage (S3, Dropbox, …); also
  include `/home/webi-kidzlim/kidzlim-data` or download it regularly.
- Keep `~/kidzlim.env` (or at least its secrets) in a password manager — without
  `CREDENTIALS_ENCRYPTION_KEY` the saved API keys can't be read.

Then follow `LAUNCH.md` from section 2 (catalogue, email DNS, Stripe/Gelato keys and webhooks,
test orders, go live).
