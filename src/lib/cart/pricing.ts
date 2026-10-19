import { mediaUrl } from '../media'
import type { Book } from '../../payload-types'
import type { CartLineInput } from './schema'

export type PricedLine = {
  bookId: number
  sku: string
  slug: string
  title: string
  variantType: 'paperback' | 'hardcover' | 'digital'
  physical: boolean
  quantity: number
  unitPriceAED: number
  lineTotalAED: number
  coverUrl: string | null
  gelatoProductUid: string | null
  pageCount: number | null
}

export type CartIssue = {
  sku: string
  reason: 'unavailable' | 'quantity_adjusted'
  message: string
}

export type PricedCart = {
  lines: PricedLine[]
  issues: CartIssue[]
  subtotalAED: number
  hasPhysical: boolean
  hasDigital: boolean
  itemCount: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Pure pricing step: every price comes from the book records, never from the browser.
 * Unknown/unpublished books, inactive or missing variants are dropped and reported.
 * Duplicate SKUs are merged; digital items are capped at one copy.
 */
export function priceLines(input: CartLineInput[], books: Book[]): PricedCart {
  const byId = new Map(books.map((b) => [b.id, b]))
  const merged = new Map<string, CartLineInput>()
  for (const line of input) {
    const prev = merged.get(line.sku)
    merged.set(line.sku, prev ? { ...line, quantity: prev.quantity + line.quantity } : line)
  }

  const lines: PricedLine[] = []
  const issues: CartIssue[] = []

  for (const line of merged.values()) {
    const book = byId.get(line.bookId)
    const variant = book?.variants?.find((v) => v.sku === line.sku && v.active !== false)
    if (!book || !variant) {
      issues.push({ sku: line.sku, reason: 'unavailable', message: 'This item is no longer available and was removed.' })
      continue
    }

    const physical = variant.type !== 'digital'
    let quantity = Math.min(line.quantity, 20)
    if (!physical && quantity > 1) {
      quantity = 1
      issues.push({ sku: line.sku, reason: 'quantity_adjusted', message: 'Digital books are limited to one copy per order.' })
    } else if (quantity !== line.quantity) {
      issues.push({ sku: line.sku, reason: 'quantity_adjusted', message: 'Quantity was reduced to the maximum allowed.' })
    }

    lines.push({
      bookId: book.id,
      sku: variant.sku,
      slug: book.slug,
      title: book.title,
      variantType: variant.type,
      physical,
      quantity,
      unitPriceAED: round2(variant.priceAED),
      lineTotalAED: round2(variant.priceAED * quantity),
      coverUrl: mediaUrl(book.coverImage, 'thumbnail'),
      gelatoProductUid: physical ? (variant.gelatoProductUid ?? null) : null,
      pageCount: physical ? (variant.pageCount ?? null) : null,
    })
  }

  return {
    lines,
    issues,
    subtotalAED: round2(lines.reduce((sum, l) => sum + l.lineTotalAED, 0)),
    hasPhysical: lines.some((l) => l.physical),
    hasDigital: lines.some((l) => !l.physical),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
  }
}
