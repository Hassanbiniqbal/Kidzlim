import 'server-only'

import type { Payload } from 'payload'

import type { Order } from '@/payload-types'

import { toFils } from '../integrations/stripe'
import { appendToOrder } from '../order-write'
import { getStripe } from './stripe-config'

export class RefundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RefundError'
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function refundableAmount(order: Pick<Order, 'amountAED' | 'refundedAmountAED'>): number {
  return Math.max(0, round2((order.amountAED ?? 0) - (order.refundedAmountAED ?? 0)))
}

/**
 * Explicit admin action (brief §7: "Stripe refund should be a separate explicit action").
 * Full refunds move the order to `refunded`, which also disables its download link.
 * Does NOT cancel a Gelato print order — that's its own action.
 */
export async function refundOrder(payload: Payload, orderId: number, opts: { amountAED?: number; by: string }): Promise<Order> {
  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })
  if (!order.stripePaymentIntentId) throw new RefundError('This order has no Stripe payment to refund.')

  const refundable = refundableAmount(order)
  const amount = round2(opts.amountAED ?? refundable)
  if (refundable <= 0) throw new RefundError('This order has already been fully refunded.')
  if (!(amount > 0) || amount > refundable + 0.001) {
    throw new RefundError(`Refund amount must be between AED 0.01 and AED ${refundable.toFixed(2)}.`)
  }

  const refundedTotal = round2((order.refundedAmountAED ?? 0) + amount)
  const stripe = await getStripe()
  const refund = await stripe.createRefund(
    {
      payment_intent: order.stripePaymentIntentId,
      amount: toFils(amount),
      reason: 'requested_by_customer',
      metadata: { orderId: String(order.id), orderNumber: order.orderNumber, by: opts.by },
    },
    // Same order + same running total → same key, so a double-click can't refund twice.
    `refund-${order.orderNumber}-${toFils(refundedTotal)}`,
  )

  const full = refundedTotal >= round2(order.amountAED ?? 0) - 0.009
  return appendToOrder(payload, order.id, { refundedAmountAED: refundedTotal, ...(full ? { status: 'refunded' as const } : {}) }, [
    {
      at: new Date().toISOString(),
      event: 'payment.refunded',
      detail: { amountAED: amount, refundedTotalAED: refundedTotal, full, refundId: refund.id, status: refund.status, by: opts.by },
    },
  ])
}
