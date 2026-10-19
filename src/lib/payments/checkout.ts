import 'server-only'

import { randomInt } from 'crypto'
import type { Payload } from 'payload'
import { z } from 'zod'

import { priceCart } from '../cart/server'
import { addressSchema, cartSchema, type Address } from '../cart/schema'
import type { PricedCart } from '../cart/pricing'
import { getPayloadClient } from '../cms'
import { buildCheckoutSessionParams } from '../integrations/stripe'
import { appendToOrder } from '../order-write'
import { quoteShipping, type ShippingOption } from '../shipping'
import { getStripe } from './stripe-config'

export const checkoutRequestSchema = z.object({
  lines: cartSchema.shape.lines.min(1),
  contact: addressSchema.pick({ firstName: true, lastName: true, email: true }),
  address: addressSchema.optional(),
  shippingOptionId: z.string().trim().max(200).optional(),
  /** What the customer saw. If the server total differs, we stop and show the new total. */
  expectedTotalAED: z.number().nonnegative(),
})
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>

export type CheckoutFailure =
  | { code: 'cart_changed'; message: string; cart: PricedCart }
  | { code: 'address_required'; message: string }
  | { code: 'shipping_changed'; message: string; options: ShippingOption[] }
  | { code: 'price_changed'; message: string; totalAED: number }

export class CheckoutError extends Error {
  constructor(public readonly failure: CheckoutFailure) {
    super(failure.message)
    this.name = 'CheckoutError'
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** KZ-261013-7QH4P — date + 5 unambiguous characters. */
export function generateOrderNumber(now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, '')
  const rand = Array.from({ length: 5 }, () => ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)]).join('')
  return `KZ-${d}-${rand}`
}

async function createPendingOrder(
  payload: Payload,
  data: {
    cart: PricedCart
    contact: CheckoutRequest['contact']
    address: Address | null
    shipping: ShippingOption | null
    totalAED: number
  },
) {
  const { cart, contact, address, shipping, totalAED } = data
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await payload.create({
        collection: 'orders',
        overrideAccess: true,
        data: {
          orderNumber: generateOrderNumber(),
          status: 'pending',
          customerEmail: contact.email,
          customerName: `${contact.firstName} ${contact.lastName}`.trim(),
          currency: 'AED',
          subtotalAED: cart.subtotalAED,
          shippingAmount: shipping?.priceAED ?? 0,
          amountAED: totalAED,
          items: cart.lines.map((l) => ({
            book: l.bookId,
            variant: l.variantType,
            sku: l.sku,
            quantity: l.quantity,
            unitPrice: l.unitPriceAED,
          })),
          shippingAddress: address,
          shippingMethod: shipping ? { name: shipping.name, gelatoMethodUids: shipping.methodUids } : undefined,
          fulfilmentLog: [
            {
              at: new Date().toISOString(),
              event: 'order.created',
              detail: { items: cart.itemCount, totalAED, shipping: shipping?.name ?? null },
            },
          ],
        },
      })
    } catch (err) {
      // Order-number collision is astronomically unlikely; retry with a new one.
      if (attempt === 2) throw err
    }
  }
  throw new Error('unreachable')
}

/**
 * Brief §4.1–4.4: re-price everything server-side, re-quote shipping, create a pending
 * order, then a Stripe Checkout Session. Returns the hosted payment page URL.
 */
export async function startCheckout(input: CheckoutRequest, baseUrl: string): Promise<{ url: string; orderNumber: string }> {
  const payload = await getPayloadClient()
  const cart = await priceCart(input.lines)

  if (cart.lines.length === 0 || cart.issues.length > 0) {
    throw new CheckoutError({ code: 'cart_changed', message: 'Your basket has changed. Please review it and try again.', cart })
  }

  const physical = cart.lines.filter((l) => l.physical)
  let shipping: ShippingOption | null = null
  let address: Address | null = null

  if (physical.length > 0) {
    if (!input.address || !input.shippingOptionId) {
      throw new CheckoutError({ code: 'address_required', message: 'Please add a delivery address and choose a delivery option.' })
    }
    address = input.address
    // Never trust the browser's shipping price: quote again now.
    const options = await quoteShipping(physical, address)
    shipping = options.find((o) => o.id === input.shippingOptionId) ?? null
    if (!shipping) {
      throw new CheckoutError({
        code: 'shipping_changed',
        message: 'Delivery options have changed. Please choose one again.',
        options,
      })
    }
  }

  const totalAED = round2(cart.subtotalAED + (shipping?.priceAED ?? 0))
  if (Math.abs(totalAED - input.expectedTotalAED) > 0.009) {
    throw new CheckoutError({
      code: 'price_changed',
      message: `The total has changed to AED ${totalAED.toFixed(2)}. Please review your order and try again.`,
      totalAED,
    })
  }

  const stripe = await getStripe()
  const order = await createPendingOrder(payload, { cart, contact: input.contact, address, shipping, totalAED })

  try {
    const customer = address
      ? await stripe.createCustomer(
          {
            email: input.contact.email,
            name: `${address.firstName} ${address.lastName}`,
            phone: address.phone,
            address: {
              line1: address.addressLine1,
              line2: address.addressLine2,
              city: address.city,
              state: address.state,
              postal_code: address.postCode,
              country: address.country,
            },
            shipping: {
              name: `${address.firstName} ${address.lastName}`,
              phone: address.phone,
              address: {
                line1: address.addressLine1,
                line2: address.addressLine2,
                city: address.city,
                state: address.state,
                postal_code: address.postCode,
                country: address.country,
              },
            },
            metadata: { orderId: String(order.id), orderNumber: order.orderNumber },
          },
          `customer-${order.orderNumber}`,
        )
      : null

    const session = await stripe.createCheckoutSession(
      buildCheckoutSessionParams({
        orderId: order.id,
        orderNumber: order.orderNumber,
        lines: cart.lines,
        shipping: shipping ? { name: shipping.name, priceAED: shipping.priceAED } : null,
        email: input.contact.email,
        customerId: customer?.id ?? null,
        baseUrl,
        expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
      }),
      `session-${order.orderNumber}`,
    )
    if (!session.url) throw new Error('Stripe returned no checkout URL')

    await appendToOrder(payload, order.id, { stripeSessionId: session.id, stripeCustomerId: customer?.id }, [
      { at: new Date().toISOString(), event: 'stripe.session.created', detail: { sessionId: session.id } },
    ])
    return { url: session.url, orderNumber: order.orderNumber }
  } catch (err) {
    await appendToOrder(payload, order.id, { status: 'cancelled' }, [
      { at: new Date().toISOString(), event: 'stripe.session.failed', detail: { message: err instanceof Error ? err.message : String(err) } },
    ])
      .catch(() => undefined)
    throw err
  }
}
