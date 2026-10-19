import { describe, expect, it } from 'vitest'

import { priceLines } from '@/lib/cart/pricing'
import type { Book } from '@/payload-types'

const book = (id: number, variants: Partial<NonNullable<Book['variants']>[number]>[]): Book =>
  ({
    id,
    title: `Book ${id}`,
    slug: `book-${id}`,
    status: 'published',
    coverImage: 1,
    variants: variants.map((v, i) => ({ id: `${id}-${i}`, active: true, ...v })),
    updatedAt: '',
    createdAt: '',
  }) as Book

const books = [
  book(1, [
    { type: 'paperback', sku: 'B1-PB', priceAED: 49, gelatoProductUid: 'uid-pb', pageCount: 32 },
    { type: 'digital', sku: 'B1-PDF', priceAED: 25 },
    { type: 'hardcover', sku: 'B1-HC', priceAED: 69, active: false, gelatoProductUid: 'uid-hc' },
  ]),
]

describe('priceLines', () => {
  it('uses database prices, not anything from the client', () => {
    const cart = priceLines([{ bookId: 1, sku: 'B1-PB', quantity: 2 }], books)
    expect(cart.lines[0]).toMatchObject({ unitPriceAED: 49, lineTotalAED: 98, physical: true, gelatoProductUid: 'uid-pb' })
    expect(cart.subtotalAED).toBe(98)
    expect(cart.hasPhysical).toBe(true)
    expect(cart.hasDigital).toBe(false)
  })

  it('drops unknown books, unknown SKUs and inactive variants', () => {
    const cart = priceLines(
      [
        { bookId: 99, sku: 'X', quantity: 1 },
        { bookId: 1, sku: 'NOPE', quantity: 1 },
        { bookId: 1, sku: 'B1-HC', quantity: 1 },
      ],
      books,
    )
    expect(cart.lines).toHaveLength(0)
    expect(cart.issues.map((i) => i.reason)).toEqual(['unavailable', 'unavailable', 'unavailable'])
    expect(cart.subtotalAED).toBe(0)
  })

  it('rejects a SKU that belongs to a different book', () => {
    const cart = priceLines([{ bookId: 2, sku: 'B1-PB', quantity: 1 }], [...books, book(2, [])])
    expect(cart.lines).toHaveLength(0)
  })

  it('caps digital items at one copy and merges duplicate lines', () => {
    const cart = priceLines(
      [
        { bookId: 1, sku: 'B1-PDF', quantity: 3 },
        { bookId: 1, sku: 'B1-PB', quantity: 1 },
        { bookId: 1, sku: 'B1-PB', quantity: 2 },
      ],
      books,
    )
    const pdf = cart.lines.find((l) => l.sku === 'B1-PDF')
    const pb = cart.lines.find((l) => l.sku === 'B1-PB')
    expect(pdf?.quantity).toBe(1)
    expect(pdf?.gelatoProductUid).toBeNull()
    expect(pb?.quantity).toBe(3)
    expect(cart.subtotalAED).toBe(25 + 147)
    expect(cart.hasDigital && cart.hasPhysical).toBe(true)
    expect(cart.issues).toContainEqual(expect.objectContaining({ sku: 'B1-PDF', reason: 'quantity_adjusted' }))
  })

  it('rounds to fils', () => {
    const cart = priceLines([{ bookId: 3, sku: 'C', quantity: 3 }], [book(3, [{ type: 'paperback', sku: 'C', priceAED: 19.99 }])])
    expect(cart.subtotalAED).toBe(59.97)
  })
})
