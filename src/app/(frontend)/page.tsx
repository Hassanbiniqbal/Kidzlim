import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { RenderBlocks } from '@/components/blocks/RenderBlocks'
import { BookRow } from '@/components/home/BookRow'
import { type HeroSlide, HomeHero } from '@/components/home/HomeHero'
import { RevealObserver } from '@/components/home/Reveal'
import { Spotlight } from '@/components/home/Spotlight'
import { Icon } from '@/components/Icon'
import { getBooks, getPageBySlug, getSeriesList } from '@/lib/cms'
import { activeVariants, formatAED, fromPrice, VARIANT_LABELS } from '@/lib/format'
import { asMedia, mediaUrl } from '@/lib/media'
import { buildMetadata } from '@/lib/metadata'
import { plainExcerpt } from '@/lib/richtext-plain'
import type { Book } from '@/payload-types'

import './home.css'

// Content comes from the CMS at request time (no DB needed at build).
export const dynamic = 'force-dynamic'

const HOME_SLUG = 'home'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug(HOME_SLUG)
  if (!page) return { title: { absolute: 'Kidzlim | Islamic Books for Kids' } }
  const meta = buildMetadata({ seo: page.seo, fallbackTitle: 'Islamic Books for Kids', path: '/' })
  return { ...meta, title: { absolute: page.seo?.metaTitle || 'Kidzlim | Islamic Books for Kids' } }
}

const seriesId = (b: Book) => (typeof b.series === 'object' ? b.series?.id : b.series) ?? null

function toSlide(book: Book): HeroSlide | null {
  const cover = asMedia(book.coverImage)
  const src = mediaUrl(book.coverImage, 'card')
  if (!cover || !src) return null
  const variants = activeVariants(book)
  const first = variants[0]
  const price = fromPrice(book)
  const series = typeof book.series === 'object' && book.series ? { title: book.series.title, slug: book.series.slug } : null
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    series,
    excerpt: plainExcerpt(book.description, 190),
    ageRange: book.ageRange ?? null,
    formats: [...new Set(variants.map((v) => VARIANT_LABELS[v.type]))],
    fromPrice: price !== null ? formatAED(price) : null,
    cover: {
      src,
      thumb: mediaUrl(book.coverImage, 'thumbnail') ?? src,
      alt: cover.alt || book.title,
      width: cover.sizes?.card?.width || cover.width || 700,
      height: cover.sizes?.card?.height || cover.height || 1060,
    },
    quickAdd: first ? { bookId: book.id, sku: first.sku, label: `Add ${VARIANT_LABELS[first.type]} to basket` } : null,
  }
}

/**
 * Home page: streaming-style storefront — featured-book hero carousel, series pills, sideways
 * shelves and two series spotlights, all built from the catalogue (Books + Series in the admin).
 * The editable Home page blocks (features, testimonials, FAQ…) follow underneath.
 */
export default async function HomePage() {
  const [page, books, seriesList] = await Promise.all([getPageBySlug(HOME_SLUG), getBooks({ source: 'all' }), getSeriesList()])

  const bySeries = new Map<number, Book[]>()
  for (const b of books) {
    const id = seriesId(b)
    if (id) bySeries.set(id, [...(bySeries.get(id) ?? []), b])
  }
  const featured = books.filter((b) => b.featured)
  const heroBooks = (featured.length ? featured : books).slice(0, 6)
  const slides = heroBooks.map(toSlide).filter((s): s is HeroSlide => s !== null)

  const withBooks = seriesList.filter((s) => (bySeries.get(s.id)?.length ?? 0) > 0)
  const [spotA, spotB, ...rest] = withBooks
  const rowsAfterA = rest.slice(0, 2)
  const rowsAfterB = rest.slice(2)
  const extraBlocks = (page?.layout ?? []).filter((b) => b.blockType !== 'hero' && b.blockType !== 'bookGrid')

  return (
    <>
      <h1 className="k-visually-hidden">Kidzlim — Islamic books for kids</h1>
      <HomeHero slides={slides} />

      {withBooks.length > 0 && (
        <nav className="k-wrap kh-pills-wrap" aria-label="Browse by series" id="series">
          <ul className="kh-pills" data-reveal-stagger data-reveal>
            <li>
              <Link href="/books" className="kh-pill is-active" style={{ '--i': 0 } as React.CSSProperties}>
                All
              </Link>
            </li>
            {withBooks.map((s, i) => (
              <li key={s.id}>
                <Link href={`/books?series=${s.slug}`} className="kh-pill" style={{ '--i': i + 1 } as React.CSSProperties}>
                  {s.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/books" className="kh-pill kh-pill--round" aria-label="All books" style={{ '--i': withBooks.length + 1 } as React.CSSProperties}>
                <Icon name="arrow" size={16} />
              </Link>
            </li>
          </ul>
        </nav>
      )}

      <BookRow title="Featured picks" books={featured.length ? featured : books.slice(0, 12)} href="/books" />

      {spotA && <Spotlight series={spotA} books={bySeries.get(spotA.id) ?? []} variant="stack" />}

      {rowsAfterA.map((s) => (
        <BookRow key={s.id} title={s.title} books={bySeries.get(s.id) ?? []} href={`/books?series=${s.slug}`} />
      ))}

      {spotB && (
        <>
          <h2 className="kh-bigtitle k-wrap" data-reveal>
            Stories of <span className="k-gradient-text">faith &amp; courage</span>
          </h2>
          <Spotlight series={spotB} books={bySeries.get(spotB.id) ?? []} variant="fan" />
          <BookRow title={spotB.title} books={bySeries.get(spotB.id) ?? []} href={`/books?series=${spotB.slug}`} />
        </>
      )}

      {rowsAfterB.map((s) => (
        <BookRow key={s.id} title={s.title} books={bySeries.get(s.id) ?? []} href={`/books?series=${s.slug}`} />
      ))}

      <RenderBlocks blocks={extraBlocks} />
      <RevealObserver />
    </>
  )
}
