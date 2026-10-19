import path from 'path'
import { fileURLToPath } from 'url'

import type { Payload } from 'payload'

import type { Book } from '../payload-types'
import { CATALOGUE, SERIES, SERIES_DEFAULTS, type SeriesKey, slugify } from './catalogue'
import { md } from './lexical'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** Printed variants need a real Gelato product UID before launch; the dashboard flags this value. */
export const PLACEHOLDER_GELATO_UID = 'REPLACE_ME'

async function upsertSeries(payload: Payload): Promise<Record<SeriesKey, number>> {
  const ids = {} as Record<SeriesKey, number>
  for (const [slug, s] of Object.entries(SERIES) as [SeriesKey, (typeof SERIES)[SeriesKey]][]) {
    const existing = await payload.find({ collection: 'series', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
    ids[slug] =
      existing.docs[0]?.id ??
      (await payload.create({ collection: 'series', data: { title: s.title, slug, blurb: s.blurb, sortOrder: s.sortOrder } })).id
  }
  return ids
}

async function coverFor(payload: Payload, slug: string, title: string): Promise<number> {
  const alt = `Cover of “${title}”, a Kidzlim Islamic book for kids`
  const existing = await payload.find({ collection: 'media', where: { alt: { equals: alt } }, limit: 1, depth: 0 })
  if (existing.docs[0]) return existing.docs[0].id
  const doc = await payload.create({ collection: 'media', data: { alt }, filePath: path.join(dirname, 'assets', 'books', `${slug}.webp`) })
  return doc.id
}

function variantsFor(slug: string, series: SeriesKey): NonNullable<Book['variants']> {
  const d = SERIES_DEFAULTS[series]
  const variants: NonNullable<Book['variants']> = []
  if (d.paperback) {
    variants.push({ type: 'paperback', sku: `${slug}-pb`, priceAED: d.paperback, active: true, gelatoProductUid: PLACEHOLDER_GELATO_UID, pageCount: d.pageCount })
  }
  if (d.hardcover) {
    variants.push({ type: 'hardcover', sku: `${slug}-hc`, priceAED: d.hardcover, active: true, gelatoProductUid: PLACEHOLDER_GELATO_UID, pageCount: d.pageCount })
  }
  variants.push({ type: 'digital', sku: `${slug}-pdf`, priceAED: d.digital, compareAtPriceAED: d.digitalCompareAt, active: true })
  return variants
}

/**
 * Creates the full catalogue (97 books in 7 series) with covers and placeholder prices.
 * Existing books (matched by slug) are left untouched, so edits made in the admin survive re-runs.
 */
export async function seedCatalogue(payload: Payload) {
  const seriesIds = await upsertSeries(payload)

  // The three Phase 2 layout samples are superseded by the real catalogue.
  await payload.delete({ collection: 'books', where: { slug: { like: 'sample-' } }, overrideAccess: true })

  let created = 0
  for (const b of CATALOGUE) {
    const slug = slugify(b.title)
    const exists = await payload.find({ collection: 'books', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
    if (exists.docs[0]) continue
    const d = SERIES_DEFAULTS[b.series]
    const printed = Boolean(d.paperback || d.hardcover)
    await payload.create({
      collection: 'books',
      data: {
        title: b.title,
        slug,
        status: 'published',
        featured: Boolean(b.featured),
        series: seriesIds[b.series],
        ageRange: d.ageRange,
        language: d.language,
        coverImage: await coverFor(payload, slug, b.title),
        description: md(
          [
            b.blurb,
            SERIES[b.series].blurb,
            printed
              ? `Available as a printed book delivered to your door, or as an instant PDF download. ${d.pageCount} full-colour pages.`
              : 'An instant PDF download — print the pages at home and get creative.',
          ].join('\n\n'),
        ),
        variants: variantsFor(slug, b.series),
        seo: { metaDescription: `${b.blurb} A Kidzlim Islamic book for kids aged ${d.ageRange}.`.slice(0, 160) },
      },
    })
    created++
  }
  payload.logger.info(`＋ catalogue: ${created} new books (${CATALOGUE.length - created} already existed)`)
}
