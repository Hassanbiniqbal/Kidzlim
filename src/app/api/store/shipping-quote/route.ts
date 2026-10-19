import { priceCart } from '@/lib/cart/server'
import { shippingQuoteRequestSchema } from '@/lib/cart/schema'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { quoteShipping, ShippingError } from '@/lib/shipping'

export const dynamic = 'force-dynamic'

const STATUS: Record<ShippingError['code'], number> = {
  unsupported_country: 422,
  missing_product: 422,
  no_options: 422,
  not_configured: 503,
  provider_error: 502,
}

/**
 * Real shipping cost from Gelato for the physical items in the cart (brief §4.2).
 * Prices are recalculated server-side; Phase 4 re-quotes before creating the Stripe session.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`quote:${clientIp(req)}`, 15, 60_000)
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many shipping requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  const parsed = shippingQuoteRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] === 'address' ? issue.path[1] : undefined
      if (typeof field === 'string' && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return Response.json({ error: 'Please check the highlighted fields.', fieldErrors }, { status: 400 })
  }

  try {
    const cart = await priceCart(parsed.data.lines)
    const physical = cart.lines.filter((l) => l.physical)
    if (physical.length === 0) return Response.json({ options: [], shippingRequired: false })

    const options = await quoteShipping(physical, parsed.data.address)
    return Response.json({ options, shippingRequired: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof ShippingError) {
      return Response.json({ error: err.message, code: err.code }, { status: STATUS[err.code] })
    }
    console.error('[shipping] quote failed', err)
    return Response.json({ error: 'Shipping quotes are temporarily unavailable.' }, { status: 500 })
  }
}
