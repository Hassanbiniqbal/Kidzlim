import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import React from 'react'

import { RenderBlocks } from '@/components/blocks/RenderBlocks'
import { getPageBySlug } from '@/lib/cms'
import { buildMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  if (!page) return {}
  return buildMetadata({ seo: page.seo, fallbackTitle: page.title, path: `/${slug}` })
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params
  if (slug === 'home') permanentRedirect('/')

  const page = await getPageBySlug(slug)
  if (!page) notFound()

  const startsWithHero = page.layout?.[0]?.blockType === 'hero'
  return (
    <>
      {!startsWithHero && (
        <header className="k-page-head k-wrap">
          <h1 className="k-page-head__title">{page.title}</h1>
        </header>
      )}
      <RenderBlocks blocks={page.layout} />
    </>
  )
}
