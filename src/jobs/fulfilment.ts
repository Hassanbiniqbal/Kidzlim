import type { Field, Payload, TaskConfig } from 'payload'

import {
  deliverDigital,
  logFulfilmentFailure,
  sendOrderConfirmation,
  sendShippingNotification,
  submitGelatoOrder,
  syncGelatoOrder,
  type StepResult,
} from '../lib/fulfilment'
import { gelatoOrderSchema } from '../lib/integrations/gelato'

/**
 * Background fulfilment (brief §4.6 — "push email and the Gelato call onto a queue").
 * Queued by the Stripe/Gelato webhooks and admin actions. Each step is idempotent;
 * failures retry with backoff.
 */
export const FULFILMENT_QUEUE = 'fulfilment'

// `hint` carries the authenticated Gelato webhook body for syncGelatoStatus (fallback only).
const orderInput: Field[] = [
  { name: 'orderId', type: 'number', required: true },
  { name: 'hint', type: 'json' },
]
const resultOutput: Field[] = [{ name: 'result', type: 'text' }]

// 1m, 2m, 4m, 8m … about 4 hours in total before giving up.
const retries = { attempts: 8, backoff: { type: 'exponential' as const, delay: 60_000 } }

type OrderTask = { input: { orderId: number; hint?: unknown }; output: { result: string } }
type Step = (payload: Payload, input: OrderTask['input']) => Promise<StepResult>

function task(slug: string, label: string, run: Step): TaskConfig<OrderTask> {
  return {
    slug,
    label,
    inputSchema: orderInput,
    outputSchema: resultOutput,
    retries,
    // One job per order at a time. Payload's update writes the whole document, so two steps
    // updating the same order in parallel would overwrite each other's fields.
    concurrency: { key: ({ input }) => `order:${input.orderId}`, exclusive: true },
    handler: async ({ input, req }) => {
      try {
        const result = await run(req.payload, input)
        req.payload.logger.info(`[fulfilment] ${slug} order=${input.orderId} → ${result}`)
        return { output: { result } }
      } catch (err) {
        await logFulfilmentFailure(req.payload, input.orderId, slug, err)
        throw err // let the queue retry
      }
    },
  }
}

export const fulfilmentTasks: TaskConfig<OrderTask>[] = [
  task('sendOrderConfirmation', 'Send order confirmation email', (p, i) => sendOrderConfirmation(p, i.orderId)),
  task('resendConfirmation', 'Re-send order confirmation email', (p, i) => sendOrderConfirmation(p, i.orderId, { force: true })),
  task('deliverDigital', 'Email digital download link', (p, i) => deliverDigital(p, i.orderId)),
  task('resendDownload', 'Re-send digital download link', (p, i) => deliverDigital(p, i.orderId, { resend: true })),
  task('submitGelatoOrder', 'Submit print order to Gelato', (p, i) => submitGelatoOrder(p, i.orderId)),
  task('syncGelatoStatus', 'Sync status and tracking from Gelato', (p, i) => {
    const hint = gelatoOrderSchema.safeParse(i.hint)
    return syncGelatoOrder(p, i.orderId, hint.success ? hint.data : null)
  }),
  task('sendShippingNotification', 'Send shipping/tracking email', (p, i) => sendShippingNotification(p, i.orderId)),
]
