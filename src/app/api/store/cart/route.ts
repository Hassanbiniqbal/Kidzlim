import { priceCart } from '@/lib/cart/server'
import { cartSchema } from '@/lib/cart/schema'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Prices a cart from the database. The browser sends ids + quantities only. */
export async function POST(req: Request) {
  const limit = rateLimit(`cart:${clientIp(req)}`, 120, 60_000)
  if (!limit.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } })
  }

  const parsed = cartSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid cart' }, { status: 400 })

  try {
    const cart = await priceCart(parsed.data.lines)
    // Strip fulfilment-only fields before sending to the browser.
    const lines = cart.lines.map(({ gelatoProductUid: _g, pageCount: _p, ...line }) => line)
    return Response.json({ ...cart, lines }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[cart] pricing failed', err)
    return Response.json({ error: 'Could not load your basket. Please try again.' }, { status: 500 })
  }
}
