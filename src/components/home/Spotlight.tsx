import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { asMedia, mediaUrl } from '@/lib/media'
import type { Book, Series } from '@/payload-types'

/**
 * Full-width banner for one series: big title and blurb over a blurred backdrop, with books from
 * the series either as a column of cards ("stack") or a fan of covers that spreads on hover ("fan").
 */
export function Spotlight({ series, books, variant }: { series: Series; books: Book[]; variant: 'stack' | 'fan' }) {
  const lead = books[0]
  if (!lead) return null
  const backdrop = mediaUrl(lead.coverImage, 'thumbnail')
  const picks = books.slice(0, variant === 'stack' ? 3 : 5)
  const ages = [...new Set(books.map((b) => b.ageRange).filter(Boolean))]

  return (
    <section className={`kh-spot kh-spot--${variant}`} data-reveal>
      {backdrop && (
        <div className="kh-spot__bg" aria-hidden="true">
          <Image src={backdrop} alt="" fill sizes="60vw" />
        </div>
      )}
      <div className="k-wrap kh-spot__inner">
        <div className="kh-spot__copy">
          <p className="kh-spot__eyebrow">Series spotlight</p>
          <h2 className="kh-spot__title">{series.title}</h2>
          <ul className="kh-meta">
            <li>{books.length} books</li>
            {ages[0] && <li>Ages {ages[0]}</li>}
            <li>Printed &amp; PDF</li>
          </ul>
          {series.blurb && <p className="kh-spot__blurb">{series.blurb}</p>}
          <div className="kh-hero__actions">
            <Link href={`/books?series=${series.slug}`} className="k-btn k-btn--lime kh-cta">
              <span>Explore the series</span>
            </Link>
            <Link href={`/books/${lead.slug}`} className="kh-textlink">
              Start with “{lead.title}”
            </Link>
          </div>
        </div>

        <ul className="kh-spot__books" data-reveal-stagger>
          {picks.map((b, i) => {
            const src = mediaUrl(b.coverImage, 'card')
            return (
              <li key={b.id} style={{ '--i': i, '--n': picks.length } as React.CSSProperties}>
                <Link href={`/books/${b.slug}`} className="kh-spot__book" aria-label={b.title}>
                  {src && <Image src={src} alt={asMedia(b.coverImage)?.alt || b.title} fill sizes="200px" />}
                  {variant === 'stack' && <span className="kh-spot__booktitle">{b.title}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
