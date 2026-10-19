import Stripe from 'stripe'

import { VARIANT_LABELS } from '../format'
import type { PricedLine } from '../cart/pricing'

/**
 * Thin typed wrapper around the Stripe SDK — only the calls the store makes,
 * so tests can swap in a fake. API version is pinned to the SDK's.
 */
export const STRIPE_API_VERSION = '2026-08-26.dahlia' as const

export interface StripeGateway {
  createCustomer(params: Stripe.CustomerCreateParams, idempotencyKey: string): Promise<Stripe.Customer>
  createCheckoutSession(params: Stripe.Checkout.SessionCreateParams, idempotencyKey: string): Promise<Stripe.Checkout.Session>
  createRefund(params: Stripe.RefundCreateParams, idempotencyKey: string): Promise<Stripe.Refund>
  /** Harmless authenticated call used by "Test connection" (brief §6). */
  retrieveBalance(): Promise<Stripe.Balance>
}

export function createStripeGateway(secretKey: string): StripeGateway {
  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 15_000 })
  return {
    createCustomer: (params, idempotencyKey) => stripe.customers.create(params, { idempotencyKey }),
    createCheckoutSession: (params, idempotencyKey) => stripe.checkout.sessions.create(params, { idempotencyKey }),
    createRefund: (params, idempotencyKey) => stripe.refunds.create(params, { idempotencyKey }),
    retrieveBalance: () => stripe.balance.retrieve(),
  }
}

/** Verifies the `Stripe-Signature` header against the raw body. Throws on any mismatch. */
export function verifyStripeEvent(rawBody: string, signature: string, webhookSecret: string): Stripe.Event {
  return Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}

/** Stripe amounts are integers in the smallest unit — fils for AED. */
export const toFils = (aed: number) => Math.round(aed * 100)
export const fromFils = (fils: number | null | undefined) => (fils ?? 0) / 100

export type CheckoutSessionInput = {
  orderId: number
  orderNumber: string
  lines: Pick<PricedLine, 'title' | 'variantType' | 'sku' | 'bookId' | 'quantity' | 'unitPriceAED'>[]
  shipping: { name: string; priceAED: number } | null
  email: string
  customerId: string | null
  baseUrl: string
  /** Unix seconds; Stripe requires 30 min – 24 h from now. */
  expiresAt: number
}

/**
 * Pure: builds the Checkout Session request (brief §4.3).
 * - Prices are VAT-inclusive (UAE consumer pricing); Stripe Tax extracts the 5% portion.
 * - Shipping is its own line item.
 * - Our order id travels in metadata (session + payment intent) for the webhook.
 */
export function buildCheckoutSessionParams(input: CheckoutSessionInput): Stripe.Checkout.SessionCreateParams {
  const meta = { orderId: String(input.orderId), orderNumber: input.orderNumber }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map((l) => ({
    quantity: l.quantity,
    price_data: {
      currency: 'aed',
      unit_amount: toFils(l.unitPriceAED),
      tax_behavior: 'inclusive',
      product_data: {
        name: `${l.title} — ${VARIANT_LABELS[l.variantType]}`,
        metadata: { sku: l.sku, bookId: String(l.bookId) },
      },
    },
  }))

  if (input.shipping) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'aed',
        unit_amount: toFils(input.shipping.priceAED),
        tax_behavior: 'inclusive',
        product_data: { name: `Shipping — ${input.shipping.name}`, metadata: { kind: 'shipping' } },
      },
    })
  }

  return {
    mode: 'payment',
    currency: 'aed',
    line_items: lineItems,
    automatic_tax: { enabled: true },
    billing_address_collection: 'auto',
    ...(input.customerId
      ? { customer: input.customerId, customer_update: { address: 'auto', name: 'auto' } }
      : { customer_email: input.email }),
    client_reference_id: String(input.orderId),
    metadata: meta,
    payment_intent_data: { metadata: meta },
    locale: 'auto',
    expires_at: input.expiresAt,
    success_url: `${input.baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.baseUrl}/checkout?cancelled=1`,
  }
}
