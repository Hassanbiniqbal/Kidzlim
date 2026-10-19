import type { Order } from '../payload-types'

/**
 * Admin order actions and the rules for when each is allowed. Shared by the API endpoint
 * (enforcement) and the admin panel (which buttons are enabled), so they can't disagree.
 */
export const ORDER_ACTIONS = [
  'sync-gelato',
  'retry-gelato',
  'cancel-gelato',
  'refund',
  'resend-confirmation',
  'resend-download',
  'clear-attention',
] as const
export type OrderAction = (typeof ORDER_ACTIONS)[number]

export type ActionOrder = Pick<
  Order,
  | 'status'
  | 'gelatoOrderId'
  | 'gelatoStatus'
  | 'stripePaymentIntentId'
  | 'amountAED'
  | 'refundedAmountAED'
  | 'needsAttention'
  | 'items'
>

export type ActionState = { allowed: boolean; reason?: string }

const PAID: Order['status'][] = ['paid', 'submitted_to_gelato', 'in_production', 'shipped', 'delivered']
const LATE_GELATO = ['in_production', 'printed', 'shipped', 'delivered', 'canceled', 'cancelled']

const hasPrinted = (o: ActionOrder) => (o.items ?? []).some((i) => i.variant !== 'digital')
const hasDigital = (o: ActionOrder) => (o.items ?? []).some((i) => i.variant === 'digital')
const refundable = (o: ActionOrder) => Math.max(0, (o.amountAED ?? 0) - (o.refundedAmountAED ?? 0))

/** Money-moving actions are admin-only; staff can do the rest (brief §6: staff manage Orders). */
const ADMIN_ONLY: OrderAction[] = ['refund']

export function actionState(action: OrderAction, o: ActionOrder, role: 'admin' | 'staff' | null | undefined): ActionState {
  if (!role) return { allowed: false, reason: 'Not signed in' }
  if (ADMIN_ONLY.includes(action) && role !== 'admin') return { allowed: false, reason: 'Admins only' }

  switch (action) {
    case 'sync-gelato':
      return o.gelatoOrderId ? { allowed: true } : { allowed: false, reason: 'Not sent to Gelato yet' }
    case 'retry-gelato':
      if (!hasPrinted(o)) return { allowed: false, reason: 'No printed books' }
      if (o.gelatoOrderId) return { allowed: false, reason: 'Already sent to Gelato' }
      return o.status === 'paid' ? { allowed: true } : { allowed: false, reason: `Order is ${o.status}` }
    case 'cancel-gelato':
      if (!o.gelatoOrderId) return { allowed: false, reason: 'No print order' }
      if (o.status === 'cancelled' || o.status === 'refunded') return { allowed: false, reason: `Order is already ${o.status}` }
      if (o.status !== 'submitted_to_gelato' || LATE_GELATO.includes((o.gelatoStatus ?? '').toLowerCase())) {
        return { allowed: false, reason: 'Printing has started — too late to cancel' }
      }
      return { allowed: true }
    case 'refund':
      if (!o.stripePaymentIntentId) return { allowed: false, reason: 'No Stripe payment' }
      return refundable(o) > 0 ? { allowed: true } : { allowed: false, reason: 'Fully refunded' }
    case 'resend-confirmation':
      return PAID.includes(o.status) ? { allowed: true } : { allowed: false, reason: `Order is ${o.status}` }
    case 'resend-download':
      if (!hasDigital(o)) return { allowed: false, reason: 'No digital books' }
      return PAID.includes(o.status) ? { allowed: true } : { allowed: false, reason: `Order is ${o.status}` }
    case 'clear-attention':
      return o.needsAttention ? { allowed: true } : { allowed: false, reason: 'Nothing flagged' }
  }
}
