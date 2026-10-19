// Creates a migration for BOTH databases (SQLite for Hostinger, PostgreSQL for Docker/VPS) so
// they never drift:  npm run migrate:create -- <name>
import { spawnSync } from 'child_process'
import fs from 'fs'

const name = process.argv[2]
if (!name) {
  console.error('Usage: npm run migrate:create -- <name>')
  process.exit(1)
}

const targets = [
  ['SQLite', 'file:./data/.migrate-tmp.db'],
  // Only the schema snapshot is compared; the database doesn't need to be reachable.
  ['PostgreSQL', 'postgres://migrate:migrate@127.0.0.1:5432/migrate'],
]
for (const [label, url] of targets) {
  console.log(`\n── ${label} ──`)
  const r = spawnSync('npx', ['payload', 'migrate:create', name], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: url, NODE_OPTIONS: '--no-deprecation' },
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
fs.rmSync('data/.migrate-tmp.db', { force: true })
