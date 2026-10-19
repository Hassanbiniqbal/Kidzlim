import type { Metadata } from 'next'

import { mediaUrl, type MediaRef } from './media'

type Seo = { metaTitle?: string | null; metaDescription?: string | null; ogImage?: MediaRef } | null | undefined

export function buildMetadata({
  seo,
  fallbackTitle,
  fallbackDescription,
  fallbackImage,
  path,
}: {
  seo: Seo
  fallbackTitle: string
  fallbackDescription?: string | null
  fallbackImage?: MediaRef
  path: string
}): Metadata {
  const title = seo?.metaTitle || fallbackTitle
  const description = seo?.metaDescription || fallbackDescription || undefined
  const image = mediaUrl(seo?.ogImage, 'hero') || mediaUrl(fallbackImage, 'hero')
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: 'Kidzlim',
      type: 'website',
      ...(image ? { images: [{ url: image }] } : {}),
    },
  }
}
