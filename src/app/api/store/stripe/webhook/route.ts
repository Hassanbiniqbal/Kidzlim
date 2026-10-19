import { after } from 'next/server'

import { getPayloadClient } from '@/lib/cms'
import { getCredential, MissingCredentialError } from '@/lib/credentials'
import { verifyStripeEvent } from '@/lib/integrations/stripe'
import { handleStripeEvent } from '@/lib/payments/webhook'
import { runFulfilmentJobs } from '@/lib/job-runner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Stripe webhook endpoint. Point Stripe at:  https://<domain>/api/store/stripe/webhook
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *         checkout.session.async_payment_failed, checkout.session.expired
 */
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  // The signature covers the exact bytes — read the raw body, never re-serialised JSON.
  const rawBody = await req.text()
  const payload = await getPayloadClient()

  let secret: string
  try {
    secret = await getCredential('stripe.webhookSigningSecret', payload)
  } catch (err) {
    if (err instanceof MissingCredentialError) {
      console.error(`[stripe-webhook] ${err.message}`)
      return new Response('Webhook not configured', { status: 500 }) // Stripe will retry
    }
    throw err
  }

  let event
  try {
    event = verifyStripeEvent(rawBody, signature, secret)
  } catch (err) {
    console.warn('[stripe-webhook] signature verification failed', err instanceof Error ? err.message : err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    const outcome = await handleStripeEvent(payload, event)
    if (outcome.result !== 'ignored') console.info(`[stripe-webhook] ${event.type} ${event.id} → ${outcome.result}`)
    if (outcome.result === 'processed') {
      // Answer Stripe now; start fulfilment right after the response (the cron is the safety net).
      after(() => runFulfilmentJobs(payload))
    }
    return Response.json({ received: true, ...outcome })
  } catch (err) {
    console.error(`[stripe-webhook] failed to process ${event.type} ${event.id}`, err)
    return new Response('Processing failed', { status: 500 }) // non-2xx → Stripe retries for up to 3 days
  }
}
