import config from '@payload-config'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

/** Liveness + database check for Docker healthcheck and uptime monitoring. */
export async function GET() {
  const started = Date.now()
  try {
    const payload = await getPayload({ config })
    await payload.count({ collection: 'users', overrideAccess: true })
    return Response.json(
      { status: 'ok', db: 'ok', latencyMs: Date.now() - started, time: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[health] database check failed', error)
    return Response.json(
      { status: 'error', db: 'unreachable', time: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
