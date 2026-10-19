import { env } from '@/env'
import { MissingCredentialError } from '@/lib/credentials'
import { CheckoutError, checkoutRequestSchema, startCheckout } from '@/lib/payments/checkout'
import { StripeConfigError } from '@/lib/payments/stripe-config'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { ShippingError } from '@/lib/shipping'

export const dynamic = 'force-dynamic'

/** Creates the pending order + Stripe Checkout Session and returns the hosted payment URL. */
export async function POST(req: Request) {
  const limit = rateLimit(`checkout:${clientIp(req)}`, 10, 60_000)
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many attempts. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  const parsed = checkoutRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Please check your details and try again.' }, { status: 400 })

  try {
    const { url, orderNumber } = await startCheckout(parsed.data, env.NEXT_PUBLIC_SERVER_URL)
    return Response.json({ url, orderNumber }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof CheckoutError) {
      const { message, ...rest } = err.failure
      // Never expose fulfilment-only fields (Gelato product ids) to the browser.
      const safe =
        rest.code === 'cart_changed'
          ? { ...rest, cart: { ...rest.cart, lines: rest.cart.lines.map(({ gelatoProductUid: _g, pageCount: _p, ...l }) => l) } }
          : rest
      return Response.json({ error: message, ...safe }, { status: 409 })
    }
    if (err instanceof ShippingError) return Response.json({ error: err.message, code: err.code }, { status: 422 })
    if (err instanceof MissingCredentialError || err instanceof StripeConfigError) {
      console.error(`[checkout] ${err.message}`)
      return Response.json({ error: 'Online payment is temporarily unavailable. Please try again later.' }, { status: 503 })
    }
    console.error('[checkout] failed', err)
    return Response.json({ error: 'We couldn’t start the payment. Please try again.' }, { status: 502 })
  }
}
