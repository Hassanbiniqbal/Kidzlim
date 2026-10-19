import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { BookGrid } from '@/components/BookCard'
import { BuyBox } from '@/components/cart/BuyBox'
import { getBookBySlug, getBooks } from '@/lib/cms'
import { activeVariants, VARIANT_LABELS } from '@/lib/format'
import { asMedia, mediaUrl } from '@/lib/media'
import { buildMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const book = await getBookBySlug(slug)
  if (!book) return {}
  return buildMetadata({
    seo: book.seo,
    fallbackTitle: book.title,
    fallbackDescription: book.seo?.metaDescription,
    fallbackImage: book.coverImage,
    path: `/books/${slug}`,
  })
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params
  const book = await getBookBySlug(slug)
  if (!book) notFound()

  const cover = asMedia(book.coverImage)
  const series = typeof book.series === 'object' ? book.series : null
  const related = series ? (await getBooks({ source: 'all', seriesId: series.id })).filter((b) => b.id !== book.id).slice(0, 4) : []
  const coverSrc = mediaUrl(book.coverImage, 'hero')
  const gallery = (book.galleryImages ?? []).map(asMedia).filter((m) => m !== null)
  const variants = activeVariants(book)
  const base = process.env.NEXT_PUBLIC_SERVER_URL || ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    ...(coverSrc ? { image: `${base}${coverSrc}` } : {}),
    ...(book.language ? { inLanguage: book.language } : {}),
    ...(book.ageRange ? { typicalAgeRange: book.ageRange } : {}),
    ...(book.publishedYear ? { datePublished: String(book.publishedYear) } : {}),
    publisher: { '@type': 'Organization', name: 'Kidzlim' },
    offers: variants.map((v) => ({
      '@type': 'Offer',
      sku: v.sku,
      name: VARIANT_LABELS[v.type],
      price: v.priceAED.toFixed(2),
      priceCurrency: 'AED',
      availability: 'https://schema.org/InStock',
      url: `${base}/books/${book.slug}`,
    })),
  }

  return (
    <article className="k-wrap k-book">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="k-breadcrumb">
        <Link href="/books">Books</Link> <span aria-hidden="true">/</span>{' '}
        {series && (
          <>
            <Link href={`/books?series=${series.slug}`}>{series.title}</Link> <span aria-hidden="true">/</span>{' '}
          </>
        )}
        <span>{book.title}</span>
      </nav>

      <div className="k-book__layout">
        <div className="k-book__media">
          <div className="k-book__cover">
            {coverSrc ? (
              <Image
                src={coverSrc}
                alt={cover?.alt || book.title}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 520px"
              />
            ) : (
              <span className="k-book-card__placeholder">{book.title}</span>
            )}
          </div>
          {gallery.length > 0 && (
            <ul className="k-book__gallery">
              {gallery.map((img) => (
                <li key={img.id}>
                  <Image
                    src={mediaUrl(img, 'thumbnail') ?? ''}
                    alt={img.alt}
                    width={img.width ?? 400}
                    height={img.height ?? 400}
                    sizes="120px"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="k-book__info">
          <h1 className="k-book__title">{book.title}</h1>
          <dl className="k-book__facts">
            {series && (
              <div>
                <dt>Series</dt>
                <dd>
                  <Link href={`/books?series=${series.slug}`}>{series.title}</Link>
                </dd>
              </div>
            )}
            {book.ageRange && (
              <div>
                <dt>Ages</dt>
                <dd>{book.ageRange}</dd>
              </div>
            )}
            {book.language && (
              <div>
                <dt>Language</dt>
                <dd>{book.language}</dd>
              </div>
            )}
            {book.publishedYear && (
              <div>
                <dt>Published</dt>
                <dd>{book.publishedYear}</dd>
              </div>
            )}
          </dl>

          <BuyBox
            bookId={book.id}
            variants={variants.map(({ sku, type, priceAED, compareAtPriceAED }) => ({
              sku,
              type,
              priceAED,
              compareAtPriceAED,
            }))}
          />

          {book.description && (
            <div className="k-prose k-book__description">
              <RichText data={book.description} />
            </div>
          )}
        </div>
      </div>

      {series && related.length > 0 && (
        <section className="k-section" aria-labelledby="more-in-series">
          <div className="k-section__head k-section__head--row">
            <h2 id="more-in-series" className="k-section__title">
              More {series.title}
            </h2>
            <Link href={`/books?series=${series.slug}`} className="k-link-arrow">
              See all
            </Link>
          </div>
          <BookGrid books={related} />
        </section>
      )}
    </article>
  )
}
