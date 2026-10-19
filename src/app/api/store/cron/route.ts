import { timingSafeEqual } from 'crypto'

import { getPayloadClient } from '@/lib/cms'
import { runFulfilmentJobs } from '@/lib/job-runner'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { snapshotSqlite } from '@/lib/sqlite-backup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected || expected.length < 24) return false
  const url = new URL(req.url)
  const given = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Scheduled work for hosts that stop idle apps (Hostinger Node.js hosting): an hPanel cron job
 * calls this every few minutes. Runs pending fulfilment jobs (retries included) and takes the
 * daily SQLite snapshot. Requires CRON_SECRET (≥ 24 characters).
 */
async function handle(req: Request) {
  if (!rateLimit(`cron:${clientIp(req)}`, 30, 60_000).ok) return new Response('Too many requests', { status: 429 })
  if (!authorised(req)) return new Response('Forbidden', { status: 403 })

  const payload = await getPayloadClient()
  const started = Date.now()
  await runFulfilmentJobs(payload)
  let backup: string
  try {
    backup = await snapshotSqlite(payload)
  } catch (err) {
    payload.logger.error({ err, msg: '[cron] SQLite snapshot failed' })
    backup = 'failed — see logs'
  }
  return Response.json({ ok: true, jobs: 'run', backup, ms: Date.now() - started }, { headers: { 'Cache-Control': 'no-store' } })
}

export const GET = handle
export const POST = handle
