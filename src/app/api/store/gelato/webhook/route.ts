import { createHash, timingSafeEqual } from 'crypto'
import { after } from 'next/server'
import { z } from 'zod'

import { FULFILMENT_QUEUE } from '@/jobs/fulfilment'
import { getPayloadClient } from '@/lib/cms'
import { getCredential, MissingCredentialError } from '@/lib/credentials'
import { GELATO_SECRET_HEADER, gelatoOrderSchema } from '@/lib/integrations/gelato'
import { runFulfilmentJobs } from '@/lib/job-runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HANDLED = new Set(['order_status_updated', 'order_item_status_updated', 'order_item_tracking_code_updated'])

const bodySchema = gelatoOrderSchema.and(
  z.object({ id: z.string().optional(), event: z.string(), orderId: z.string().optional() }).passthrough(),
)

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false
  // Compare fixed-length digests so neither length nor content leaks through timing.
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * Gelato webhooks (brief §4.7). Gelato doesn't sign payloads, so the request must carry the
 * shared secret (header, or `?secret=` if Gelato is set to query-parameter auth). The body is
 * treated as a hint only: the sync job re-reads the order from Gelato's API.
 * URL: https://<domain>/api/store/gelato/webhook
 */
export async function POST(req: Request) {
  const payload = await getPayloadClient()

  let secret: string
  try {
    secret = await getCredential('gelato.webhookSecret', payload)
  } catch (err) {
    if (err instanceof MissingCredentialError) {
      console.error(`[gelato-webhook] ${err.message}`)
      return new Response('Webhook not configured', { status: 500 })
    }
    throw err
  }
  const provided = req.headers.get(GELATO_SECRET_HEADER) ?? new URL(req.url).searchParams.get('secret')
  if (!secretMatches(provided, secret)) return new Response('Unauthorized', { status: 401 })

  const raw = await req.text()
  let parsed
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw))
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  if (!parsed.success) return new Response('Unexpected payload', { status: 400 })
  const body = parsed.data
  if (!HANDLED.has(body.event)) return Response.json({ received: true, result: 'ignored', reason: body.event })

  const orderNumber = body.orderReferenceId
  if (!orderNumber) return Response.json({ received: true, result: 'ignored', reason: 'no orderReferenceId' })

  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const order = docs[0]
  const gelatoId = body.orderId ?? body.id
  // Ignore events for unknown orders or a different Gelato order (answer 200 so Gelato stops retrying).
  if (!order || (order.gelatoOrderId && gelatoId && order.gelatoOrderId !== gelatoId)) {
    console.warn(`[gelato-webhook] ${body.event} for unknown order ${orderNumber} (${gelatoId ?? '—'})`)
    return Response.json({ received: true, result: 'ignored', reason: 'unknown order' })
  }

  // Exactly-once per delivery: the event id if Gelato sends one, else a hash of the body.
  const key = `gelato:${body.id && body.id !== gelatoId ? body.id : createHash('sha256').update(raw).digest('hex')}`
  const seen = await payload.find({ collection: 'webhook-events', where: { key: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
  if (seen.docs.length > 0) return Response.json({ received: true, result: 'duplicate' })

  try {
    await payload.create({
      collection: 'webhook-events',
      data: { key, provider: 'gelato', eventId: body.id, type: body.event, order: order.id },
      overrideAccess: true,
    })
  } catch {
    return Response.json({ received: true, result: 'duplicate' }) // lost a race with a parallel delivery
  }

  await payload.jobs.queue({
    task: 'syncGelatoStatus',
    input: { orderId: order.id, hint: JSON.parse(raw) },
    queue: FULFILMENT_QUEUE,
  })
  after(() => runFulfilmentJobs(payload))

  return Response.json({ received: true, result: 'queued', orderId: order.id })
}
