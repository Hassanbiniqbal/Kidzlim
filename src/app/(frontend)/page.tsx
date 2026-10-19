import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { RenderBlocks } from '@/components/blocks/RenderBlocks'
import { getPageBySlug } from '@/lib/cms'
import { buildMetadata } from '@/lib/metadata'

// Content comes from the CMS at request time (no DB needed at build).
export const dynamic = 'force-dynamic'

const HOME_SLUG = 'home'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug(HOME_SLUG)
  if (!page) return {}
  const meta = buildMetadata({ seo: page.seo, fallbackTitle: 'Islamic Books for Kids', path: '/' })
  return { ...meta, title: { absolute: page.seo?.metaTitle || 'Kidzlim | Islamic Books for Kids' } }
}

export default async function HomePage() {
  const page = await getPageBySlug(HOME_SLUG)
  if (!page) notFound()
  return <RenderBlocks blocks={page.layout} />
}
