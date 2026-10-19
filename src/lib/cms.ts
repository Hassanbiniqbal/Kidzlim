import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { Book, Page, Series } from '@/payload-types'

import { startJobScheduler } from './job-runner'

/**
 * Storefront data access. All reads go through Payload's access control
 * (overrideAccess: false) so the public only ever sees published documents.
 */
// Also starts the fulfilment job scheduler in this long-running server process (idempotent).
export const getPayloadClient = cache(async () => {
  const payload = await getPayload({ config })
  startJobScheduler(payload)
  return payload
})

export const getPageBySlug = cache(async (slug: string): Promise<Page | null> => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    overrideAccess: false,
  })
  return docs[0] ?? null
})

export const getBookBySlug = cache(async (slug: string): Promise<Book | null> => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'books',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    overrideAccess: false,
  })
  return docs[0] ?? null
})

type BookQuery =
  | { source: 'featured' | 'latest'; limit: number }
  | { source: 'all'; seriesId?: number }
  | { source: 'ids'; ids: number[] }

export async function getBooks(query: BookQuery): Promise<Book[]> {
  const payload = await getPayloadClient()

  if (query.source === 'ids') {
    if (query.ids.length === 0) return []
    const { docs } = await payload.find({
      collection: 'books',
      where: { id: { in: query.ids } },
      limit: query.ids.length,
      depth: 1,
      overrideAccess: false,
    })
    // Preserve the editor's chosen order.
    return query.ids.map((id) => docs.find((d) => d.id === id)).filter((d): d is Book => Boolean(d))
  }

  const { docs } = await payload.find({
    collection: 'books',
    where:
      query.source === 'featured'
        ? { featured: { equals: true } }
        : query.source === 'all' && query.seriesId
          ? { series: { equals: query.seriesId } }
          : undefined,
    sort: query.source === 'all' ? 'title' : '-createdAt',
    limit: query.source === 'all' ? 500 : query.limit,
    depth: 1,
    overrideAccess: false,
  })
  return docs
}

export async function getPublishedSlugs(collection: 'pages' | 'books') {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection,
    limit: 1000,
    depth: 0,
    overrideAccess: false,
    select: { slug: true, updatedAt: true },
  })
  return docs.map((d) => ({ slug: d.slug, updatedAt: d.updatedAt }))
}

/** Public store details. Settings is admin-only, so expose just the safe fields. */
export const getStoreInfo = cache(async () => {
  const payload = await getPayloadClient()
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  return {
    name: settings.store?.name || 'Kidzlim',
    supportEmail: settings.store?.supportEmail || null,
    downloadExpiryHours: settings.store?.downloadExpiryHours ?? 48,
    maxDownloadsPerOrder: settings.store?.maxDownloadsPerOrder ?? 5,
  }
})

/** Series that have at least one published book, in display order. */
export const getSeriesList = cache(async (): Promise<(Series & { bookCount: number })[]> => {
  const payload = await getPayloadClient()
  const [{ docs: series }, { docs: books }] = await Promise.all([
    payload.find({ collection: 'series', sort: 'sortOrder', limit: 50, depth: 0, overrideAccess: false }),
    payload.find({ collection: 'books', limit: 1000, depth: 0, overrideAccess: false, select: { series: true } }),
  ])
  const counts = new Map<number, number>()
  for (const b of books) {
    const id = typeof b.series === 'object' ? b.series?.id : b.series
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return series.filter((s) => counts.has(s.id)).map((s) => ({ ...s, bookCount: counts.get(s.id) ?? 0 }))
})
