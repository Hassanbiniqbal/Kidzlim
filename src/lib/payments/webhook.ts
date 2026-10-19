import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import type Stripe from 'stripe'

import { FULFILMENT_QUEUE } from '../../jobs/fulfilment'
import type { Order } from '../../payload-types'
import { fromFils } from '../integrations/stripe'
import { withOrderWriteLock } from '../order-write'

export type WebhookOutcome =
  | { result: 'processed'; orderId: number; status: Order['status'] }
  | { result: 'duplicate' }
  | { result: 'ignored'; reason: string }

type LogEntry = NonNullable<Order['fulfilmentLog']>[number]
const log = (event: string, detail: Record<string, unknown>): LogEntry => ({
  at: new Date().toISOString(),
  event,
  detail,
})

/** Runs `fn` inside a DB transaction; rolls back on any error. */
/** Runs under the order write lock until commit, so jobs never read or overwrite a half-applied change. */
async function inTransaction<T>(payload: Payload, fn: (req: PayloadRequest) => Promise<T>): Promise<T> {
  return withOrderWriteLock(() => inTransactionUnlocked(payload, fn))
}

async function inTransactionUnlocked<T>(payload: Payload, fn: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const req = await createLocalReq({}, payload)
  const owns = await initTransaction(req)
  try {
    const result = await fn(req)
    if (owns) await commitTransaction(req)
    return result
  } catch (err) {
    if (owns) await killTransaction(req)
    throw err
  }
}

async function findOrder(payload: Payload, req: PayloadRequest, session: Stripe.Checkout.Session): Promise<Order | null> {
  const bySession = await payload.find({
    collection: 'orders',
    where: { stripeSessionId: { equals: session.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (bySession.docs[0]) return bySession.docs[0]

  // The session id is saved right after creation; if that write was lost, fall back to metadata.
  const orderId = Number(session.metadata?.orderId)
  if (!Number.isInteger(orderId)) return null
  const byId = await payload.find({
    collection: 'orders',
    where: { id: { equals: orderId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const order = byId.docs[0]
  // Never let a session pay for a different order.
  return order && (!order.stripeSessionId || order.stripeSessionId === session.id) ? order : null
}

/**
 * Claims `key` in the webhook ledger. Returns false if it was already processed.
 * Concurrent deliveries race on the UNIQUE index; the loser's transaction fails,
 * Stripe retries, and the retry sees the claim and returns 'duplicate'.
 */
async function claim(
  payload: Payload,
  req: PayloadRequest,
  data: { key: string; eventId: string; type: string; order?: number },
): Promise<boolean> {
  const existing = await payload.find({
    collection: 'webhook-events',
    where: { key: { equals: data.key } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (existing.docs.length > 0) return false
  await payload.create({ collection: 'webhook-events', data: { ...data, provider: 'stripe' }, overrideAccess: true, req })
  return true
}

async function markPaid(payload: Payload, event: Stripe.Event, session: Stripe.Checkout.Session): Promise<WebhookOutcome> {
  return inTransaction(payload, async (req) => {
    const order = await findOrder(payload, req, session)
    if (!order) {
      // Throwing makes Stripe retry; if it never resolves it shows up in the Stripe dashboard.
      throw new Error(`No order for Stripe session ${session.id} (metadata orderId=${session.metadata?.orderId ?? '—'})`)
    }

    const claimed = await claim(payload, req, { key: `paid:${session.id}`, eventId: event.id, type: event.type, order: order.id })
    if (!claimed) return { result: 'duplicate' as const }

    if (order.status !== 'pending' && order.status !== 'cancelled') return { result: 'duplicate' as const }

    const paidTotal = fromFils(session.amount_total)
    const entries: LogEntry[] = [
      log('payment.completed', {
        eventId: event.id,
        sessionId: session.id,
        paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
        amountTotalAED: paidTotal,
        taxAED: fromFils(session.total_details?.amount_tax),
      }),
    ]
    if (order.status === 'cancelled') entries.push(log('payment.after_cancel', { note: 'Paid after the order was marked cancelled — review.' }))
    if (order.amountAED != null && Math.abs(paidTotal - order.amountAED) > 0.009) {
      // Prices are VAT-inclusive, so these should match exactly. Flag for review; money was still received.
      entries.push(log('amount.mismatch', { expectedAED: order.amountAED, paidAED: paidTotal }))
    }

    const updated = await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      req,
      data: {
        status: 'paid',
        paidAt: new Date((event.created ?? Date.now() / 1000) * 1000).toISOString(),
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
        amountAED: paidTotal,
        taxAmount: fromFils(session.total_details?.amount_tax),
        customerEmail: session.customer_details?.email || order.customerEmail,
        customerName: order.customerName || session.customer_details?.name || undefined,
        fulfilmentLog: [...(order.fulfilmentLog ?? []), ...entries],
      },
    })
    // Fulfilment (brief §4.6) runs as background jobs. Queued in the same transaction,
    // so they exist if and only if the payment was recorded.
    const items = updated.items ?? []
    const queue = (task: 'sendOrderConfirmation' | 'deliverDigital' | 'submitGelatoOrder') =>
      payload.jobs.queue({ task, input: { orderId: updated.id }, queue: FULFILMENT_QUEUE, req })
    await queue('sendOrderConfirmation')
    if (items.some((i) => i.variant === 'digital')) await queue('deliverDigital')
    if (items.some((i) => i.variant !== 'digital')) await queue('submitGelatoOrder')

    return { result: 'processed' as const, orderId: updated.id, status: updated.status }
  })
}

async function markCancelled(payload: Payload, event: Stripe.Event, session: Stripe.Checkout.Session): Promise<WebhookOutcome> {
  return inTransaction(payload, async (req) => {
    const order = await findOrder(payload, req, session)
    if (!order) return { result: 'ignored' as const, reason: 'no matching order' }
    const claimed = await claim(payload, req, { key: `closed:${session.id}`, eventId: event.id, type: event.type, order: order.id })
    if (!claimed) return { result: 'duplicate' as const }
    if (order.status !== 'pending') return { result: 'ignored' as const, reason: `order is ${order.status}` }

    const updated = await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      req,
      data: {
        status: 'cancelled',
        fulfilmentLog: [...(order.fulfilmentLog ?? []), log(event.type, { eventId: event.id, sessionId: session.id })],
      },
    })
    return { result: 'processed' as const, orderId: updated.id, status: updated.status }
  })
}

/**
 * Keeps refunds made in the Stripe dashboard in sync. Uses Stripe's absolute
 * `amount_refunded`, so replays and out-of-order deliveries are harmless.
 */
async function syncRefund(payload: Payload, event: Stripe.Event, charge: Stripe.Charge): Promise<WebhookOutcome> {
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntent) return { result: 'ignored', reason: 'charge has no payment intent' }

  return inTransaction(payload, async (req) => {
    const { docs } = await payload.find({
      collection: 'orders',
      where: { stripePaymentIntentId: { equals: paymentIntent } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const order = docs[0]
    if (!order) return { result: 'ignored' as const, reason: 'no matching order' }

    const claimed = await claim(payload, req, {
      key: `refund:${charge.id}:${charge.amount_refunded}`,
      eventId: event.id,
      type: event.type,
      order: order.id,
    })
    if (!claimed) return { result: 'duplicate' as const }

    const refundedAED = fromFils(charge.amount_refunded)
    if (refundedAED <= (order.refundedAmountAED ?? 0) && (!charge.refunded || order.status === 'refunded')) {
      return { result: 'ignored' as const, reason: 'already recorded' }
    }

    const updated = await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      req,
      data: {
        refundedAmountAED: refundedAED,
        ...(charge.refunded ? { status: 'refunded' as const } : {}),
        fulfilmentLog: [
          ...(order.fulfilmentLog ?? []),
          log('stripe.charge.refunded', { eventId: event.id, refundedTotalAED: refundedAED, full: charge.refunded }),
        ],
      },
    })
    return { result: 'processed' as const, orderId: updated.id, status: updated.status }
  })
}

/** Brief §4.5–4.6: fulfilment is driven by the verified webhook only, never by the success page. */
export async function handleStripeEvent(payload: Payload, event: Stripe.Event): Promise<WebhookOutcome> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object
      // Delayed payment methods complete the session before the money arrives.
      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        return { result: 'ignored', reason: `payment_status=${session.payment_status}` }
      }
      return markPaid(payload, event, session)
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      return markCancelled(payload, event, event.data.object)
    case 'charge.refunded':
      return syncRefund(payload, event, event.data.object)
    default:
      return { result: 'ignored', reason: `unhandled event ${event.type}` }
  }
}
