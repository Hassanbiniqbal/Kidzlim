import { after } from 'next/server'
import { z } from 'zod'

import { FULFILMENT_QUEUE } from '@/jobs/fulfilment'
import { getPayloadClient } from '@/lib/cms'
import { PAID_STATUSES } from '@/lib/fulfilment'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { runFulfilmentJobs } from '@/lib/job-runner'

export const dynamic = 'force-dynamic'

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^KZ-[A-Z0-9-]{4,30}$/),
})

// Same answer whether or not the order exists, so the form can't be used to probe for orders.
const GENERIC = {
  message: 'If those details match a digital order, a new download link is on its way. Please check your inbox and spam folder.',
}

/** Brief §5: "resend my download", keyed on email + order number, rate-limited. */
export async function POST(req: Request) {
  const ip = clientIp(req)
  const ipLimit = rateLimit(`resend:ip:${ip}`, 5, 15 * 60_000)
  if (!ipLimit.ok) {
    return Response.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSec) } },
    )
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Please enter your email and order number (e.g. KZ-261013-ABCDE).' }, { status: 400 })

  const { email, orderNumber } = parsed.data
  // Max 3 resends per order per hour, regardless of IP.
  if (!rateLimit(`resend:order:${orderNumber}`, 3, 60 * 60_000).ok) return Response.json(GENERIC)

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'orders',
    where: { and: [{ orderNumber: { equals: orderNumber } }, { customerEmail: { equals: email } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const order = docs[0]
  const eligible = order && PAID_STATUSES.includes(order.status) && (order.items ?? []).some((i) => i.variant === 'digital')

  if (eligible) {
    await payload.jobs.queue({ task: 'resendDownload', input: { orderId: order.id }, queue: FULFILMENT_QUEUE })
    after(() => runFulfilmentJobs(payload))
  }
  return Response.json(GENERIC)
}
