import type { MetadataRoute } from 'next'

import { getPublishedSlugs, getSeriesList } from '@/lib/cms'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const [pages, books, series] = await Promise.all([getPublishedSlugs('pages'), getPublishedSlugs('books'), getSeriesList()])

  return [
    ...pages.map((p) => ({
      url: p.slug === 'home' ? base : `${base}/${p.slug}`,
      lastModified: p.updatedAt,
    })),
    { url: `${base}/books` },
    ...series.map((s) => ({ url: `${base}/books?series=${s.slug}` })),
    ...books.map((b) => ({ url: `${base}/books/${b.slug}`, lastModified: b.updatedAt })),
  ]
}
