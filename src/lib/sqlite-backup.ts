import 'server-only'

import fs from 'fs/promises'
import path from 'path'
import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { env, isSqliteUrl } from '@/env'

const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS ?? 14)
const NAME = /^kidzlim-\d{8}-\d{6}\.db$/

/** Folder for snapshots: BACKUP_DIR, or `backups/` next to the database file. */
export function backupDir(): string | null {
  if (!isSqliteUrl(env.DATABASE_URL)) return null
  if (process.env.BACKUP_DIR) return path.resolve(process.env.BACKUP_DIR)
  const dbFile = path.resolve(env.DATABASE_URL.replace(/^file:(\/\/)?/, ''))
  return path.join(path.dirname(dbFile), 'backups')
}

type SqliteDb = { drizzle: { run: (query: ReturnType<typeof sql>) => Promise<unknown> } }

/**
 * Consistent snapshot of the live SQLite database (`VACUUM INTO`, safe while the app is
 * running), at most one per day; old snapshots are pruned. Uploads (images, PDFs) are plain files
 * covered by Hostinger's own backups — see README.
 */
export async function snapshotSqlite(payload: Payload): Promise<string> {
  const dir = backupDir()
  if (!dir) return 'skipped (not SQLite)'
  await fs.mkdir(dir, { recursive: true })

  const files = (await fs.readdir(dir)).filter((f) => NAME.test(f)).sort()
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  if (files.some((f) => f.startsWith(`kidzlim-${today}-`))) return 'already done today'

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  const target = path.join(dir, `kidzlim-${stamp}.db`)
  await (payload.db as unknown as SqliteDb).drizzle.run(sql`VACUUM INTO ${target}`)

  const cutoff = Date.now() - KEEP_DAYS * 24 * 3600 * 1000
  for (const f of files) {
    const full = path.join(dir, f)
    if ((await fs.stat(full)).mtimeMs < cutoff) await fs.rm(full, { force: true })
  }
  return `saved ${path.basename(target)}`
}
