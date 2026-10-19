import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'

import { buildCheckoutSessionParams, fromFils, toFils, verifyStripeEvent } from '@/lib/integrations/stripe'

const base = {
  orderId: 42,
  orderNumber: 'KZ-261013-ABCDE',
  lines: [
    { title: 'Stories of the Prophets', variantType: 'paperback' as const, sku: 'SP-PB', bookId: 7, quantity: 2, unitPriceAED: 49.5 },
    { title: 'Stories of the Prophets', variantType: 'digital' as const, sku: 'SP-PDF', bookId: 7, quantity: 1, unitPriceAED: 25 },
  ],
  shipping: { name: 'Standard', priceAED: 18.25 },
  email: 'parent@example.com',
  customerId: null,
  baseUrl: 'https://kidzlim.com',
  expiresAt: 1_900_000_000,
}

describe('buildCheckoutSessionParams', () => {
  const params = buildCheckoutSessionParams(base)

  it('charges in AED fils with VAT-inclusive prices and Stripe Tax on', () => {
    expect(params.currency).toBe('aed')
    expect(params.automatic_tax).toEqual({ enabled: true })
    const first = params.line_items?.[0]
    expect(first?.quantity).toBe(2)
    expect(first?.price_data).toMatchObject({ currency: 'aed', unit_amount: 4950, tax_behavior: 'inclusive' })
    expect(first?.price_data?.product_data?.name).toBe('Stories of the Prophets — Paperback')
  })

  it('adds shipping as its own line item', () => {
    const last = params.line_items?.at(-1)
    expect(params.line_items).toHaveLength(3)
    expect(last?.price_data?.unit_amount).toBe(1825)
    expect(last?.price_data?.product_data?.name).toBe('Shipping — Standard')
  })

  it('omits the shipping line for digital-only orders', () => {
    const digital = buildCheckoutSessionParams({ ...base, lines: [base.lines[1]], shipping: null })
    expect(digital.line_items).toHaveLength(1)
  })

  it('carries our order id for the webhook', () => {
    expect(params.client_reference_id).toBe('42')
    expect(params.metadata).toEqual({ orderId: '42', orderNumber: 'KZ-261013-ABCDE' })
    expect(params.payment_intent_data?.metadata).toEqual(params.metadata)
  })

  it('uses customer_email for guests and the customer for physical orders', () => {
    expect(params.customer_email).toBe('parent@example.com')
    const withCustomer = buildCheckoutSessionParams({ ...base, customerId: 'cus_123' })
    expect(withCustomer.customer).toBe('cus_123')
    expect(withCustomer.customer_email).toBeUndefined()
  })

  it('returns to the success page with the session id placeholder', () => {
    expect(params.success_url).toBe('https://kidzlim.com/checkout/success?session_id={CHECKOUT_SESSION_ID}')
    expect(params.cancel_url).toBe('https://kidzlim.com/checkout?cancelled=1')
  })
})

describe('money helpers', () => {
  it('converts without float drift', () => {
    expect(toFils(0.1 + 0.2)).toBe(30)
    expect(toFils(19.99)).toBe(1999)
    expect(fromFils(1999)).toBe(19.99)
    expect(fromFils(null)).toBe(0)
  })
})

describe('verifyStripeEvent', () => {
  const secret = 'whsec_test_secret'
  const body = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: {} } })

  it('accepts a correctly signed payload', () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret })
    expect(verifyStripeEvent(body, header, secret).id).toBe('evt_1')
  })

  it('rejects a tampered body', () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret })
    expect(() => verifyStripeEvent(body.replace('evt_1', 'evt_2'), header, secret)).toThrow()
  })

  it('rejects the wrong secret', () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_other' })
    expect(() => verifyStripeEvent(body, header, secret)).toThrow()
  })
})
