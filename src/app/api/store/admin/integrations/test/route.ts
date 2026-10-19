import { z } from 'zod'

import { env } from '@/env'
import { recordAudit } from '@/lib/audit'
import { getPayloadClient } from '@/lib/cms'
import { INTEGRATIONS, testIntegration } from '@/lib/integration-checks'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bodySchema = z.object({ integration: z.enum(INTEGRATIONS) })

/** "Test connection" for Store Settings (brief §6). Admin only. */
export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(env.NEXT_PUBLIC_SERVER_URL).origin && origin !== new URL(req.url).origin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !('role' in user) || user.role !== 'admin') return Response.json({ error: 'Admins only' }, { status: 403 })

  if (!rateLimit(`integration-test:${user.id}:${clientIp(req)}`, 20, 60_000).ok) {
    return Response.json({ error: 'Too many tests — wait a minute.' }, { status: 429 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Unknown integration' }, { status: 400 })

  const result = await testIntegration(payload, parsed.data.integration)
  await recordAudit(payload, {
    user,
    action: 'test-connection',
    entity: 'settings',
    summary: `Tested ${parsed.data.integration} connection: ${result.ok ? 'passed' : 'FAILED'}`,
  })
  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
