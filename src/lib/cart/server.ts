import 'server-only'

import { getPayloadClient } from '../cms'
import { priceLines, type PricedCart } from './pricing'
import type { CartLineInput } from './schema'

/** Loads the referenced books (published only) and prices the cart from the database. */
export async function priceCart(lines: CartLineInput[]): Promise<PricedCart> {
  const ids = [...new Set(lines.map((l) => l.bookId))]
  if (ids.length === 0) return priceLines([], [])

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'books',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 1,
    overrideAccess: false,
  })
  return priceLines(lines, docs)
}
