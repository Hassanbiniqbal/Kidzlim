import { after } from 'next/server'
import { z } from 'zod'

import { env } from '@/env'
import { FULFILMENT_QUEUE } from '@/jobs/fulfilment'
import { recordAudit } from '@/lib/audit'
import { getPayloadClient } from '@/lib/cms'
import { MissingCredentialError } from '@/lib/credentials'
import { cancelGelatoOrder, FulfilmentError } from '@/lib/fulfilment'
import { GelatoError } from '@/lib/integrations/gelato'
import { actionState, ORDER_ACTIONS } from '@/lib/order-actions'
import { appendToOrder } from '@/lib/order-write'
import { refundableAmount, refundOrder, RefundError } from '@/lib/payments/refund'
import { StripeConfigError } from '@/lib/payments/stripe-config'
import { runFulfilmentJobs } from '@/lib/job-runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const bodySchema = z.object({
  action: z.enum(ORDER_ACTIONS),
  amountAED: z.number().positive().max(1_000_000).optional(),
})

const TASK_FOR = {
  'sync-gelato': 'syncGelatoStatus',
  'retry-gelato': 'submitGelatoOrder',
  'resend-confirmation': 'resendConfirmation',
  'resend-download': 'resendDownload',
} as const

/** Order actions for the admin panel (brief §6/§7). Requires a signed-in admin/staff user. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Same-origin only: the admin session cookie must not be usable from other sites.
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(env.NEXT_PUBLIC_SERVER_URL).origin && origin !== new URL(req.url).origin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  const role = user && 'role' in user ? user.role : null
  if (!user || (role !== 'admin' && role !== 'staff')) return Response.json({ error: 'Sign in to the admin first.' }, { status: 401 })

  const { id } = await params
  const orderId = Number(id)
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!Number.isInteger(orderId) || !parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 })
  const { action, amountAED } = parsed.data

  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
  const current = order // narrowed, for use inside perform()

  const state = actionState(action, order, role)
  if (!state.allowed) return Response.json({ error: state.reason ?? 'Not allowed' }, { status: 409 })

  const by = user.email
  try {
    const message = await perform()
    await recordAudit(payload, {
      user,
      action: 'order-action',
      entity: 'orders',
      entityId: orderId,
      entityLabel: order.orderNumber,
      summary: action === 'refund' ? `refund (AED ${(amountAED ?? refundableAmount(order)).toFixed(2)})` : action,
    })
    return Response.json({ ok: true, message })
  } catch (err) {
    if (err instanceof FulfilmentError || err instanceof RefundError || err instanceof GelatoError) {
      return Response.json({ error: err.message }, { status: 422 })
    }
    if (err instanceof MissingCredentialError || err instanceof StripeConfigError) {
      return Response.json({ error: err.message }, { status: 503 })
    }
    console.error(`[admin-actions] ${action} on order ${orderId} failed`, err)
    return Response.json({ error: err instanceof Error ? err.message : 'Action failed' }, { status: 500 })
  }

  async function perform(): Promise<string> {
    switch (action) {
      case 'cancel-gelato': {
        await cancelGelatoOrder(payload, orderId, by)
        return 'Print order cancelled at Gelato. Refund the payment separately if needed.'
      }
      case 'refund': {
        const updated = await refundOrder(payload, orderId, { amountAED, by })
        return updated.status === 'refunded'
          ? 'Payment fully refunded. Download links for this order no longer work.'
          : `Refunded. Total refunded: AED ${(updated.refundedAmountAED ?? 0).toFixed(2)}.`
      }
      case 'clear-attention': {
        await appendToOrder(payload, orderId, { needsAttention: false }, [
          { at: new Date().toISOString(), event: 'attention.cleared', detail: { by, reason: current.attentionReason ?? null } },
        ])
        return 'Flag cleared.'
      }
      default: {
        await payload.jobs.queue({ task: TASK_FOR[action], input: { orderId }, queue: FULFILMENT_QUEUE })
        after(() => runFulfilmentJobs(payload))
        return 'Queued — refresh in a few seconds to see the result in the fulfilment log.'
      }
    }
  }
}
