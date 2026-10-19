import type { Book } from '@/payload-types'

const aed = new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' })

export const formatAED = (amount: number) => aed.format(amount)

export type Variant = NonNullable<Book['variants']>[number]

export const VARIANT_LABELS: Record<Variant['type'], string> = {
  paperback: 'Paperback',
  hardcover: 'Hardcover',
  digital: 'Digital PDF',
}

export const activeVariants = (book: Book): Variant[] => (book.variants ?? []).filter((v) => v.active !== false)

/** Lowest active price, used for "From AED …" on cards. */
export function fromPrice(book: Book): number | null {
  const prices = activeVariants(book).map((v) => v.priceAED)
  return prices.length ? Math.min(...prices) : null
}
