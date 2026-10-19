import type { Order } from '../payload-types'
import type { GelatoOrder } from './integrations/gelato'

type Status = Order['status']

/** Forward-only order of our fulfilment statuses. */
const RANK: Record<Status, number> = {
  pending: 0,
  paid: 1,
  submitted_to_gelato: 2,
  in_production: 3,
  shipped: 4,
  delivered: 5,
  cancelled: 9,
  refunded: 9,
}

export type StatusDecision = {
  /** New order status, or null to leave it unchanged. */
  status: Status | null
  /** Set when a person should look at the order. */
  attention: string | null
}

/**
 * Maps a Gelato fulfillmentStatus onto ours (brief §4.7). Never moves an order backwards
 * (webhooks can arrive out of order) and never resurrects a cancelled/refunded order.
 */
export function decideStatus(gelatoStatus: string | undefined | null, current: Status): StatusDecision {
  const s = (gelatoStatus ?? '').toLowerCase()
  if (current === 'cancelled' || current === 'refunded') return { status: null, attention: null }

  const forward = (target: Status): StatusDecision =>
    RANK[target] > RANK[current] ? { status: target, attention: null } : { status: null, attention: null }

  switch (s) {
    case 'created':
    case 'uploading':
    case 'passed':
    case 'digitizing':
    case 'pending_approval':
    case 'pending_personalization':
      return forward('submitted_to_gelato')
    case 'in_production':
    case 'printed':
      return forward('in_production')
    case 'shipped':
      return forward('shipped')
    case 'delivered':
      return forward('delivered')
    case 'canceled':
    case 'cancelled':
      return { status: 'cancelled', attention: 'Gelato cancelled this order. Check whether a refund is needed.' }
    case 'failed':
      return { status: null, attention: 'Gelato reports the print order FAILED. Check the print file and contact Gelato.' }
    case 'on_hold':
    case 'not_connected':
      return { status: null, attention: `Gelato order is "${s}". Check the Gelato dashboard.` }
    case 'returned':
      return { status: null, attention: 'The parcel was returned to sender. Contact the customer.' }
    default:
      return { status: null, attention: null }
  }
}

/**
 * True when a Gelato status is older than what we've already recorded (an out-of-order
 * webhook), so it shouldn't overwrite the displayed Gelato status either.
 */
export function isStaleGelatoStatus(gelatoStatus: string | undefined | null, current: Status): boolean {
  const target = decideStatus(gelatoStatus, 'paid').status
  return target !== null && target !== 'cancelled' && RANK[target] < RANK[current] && RANK[current] < 9
}

/** First tracking code/URL found on any item's fulfilments. */
export function extractTracking(order: GelatoOrder | null | undefined): { trackingCode: string | null; trackingUrl: string | null } {
  for (const item of order?.items ?? []) {
    for (const f of item.fulfillments ?? []) {
      if (f.trackingCode || f.trackingUrl) return { trackingCode: f.trackingCode ?? null, trackingUrl: f.trackingUrl ?? null }
    }
  }
  return { trackingCode: null, trackingUrl: null }
}
