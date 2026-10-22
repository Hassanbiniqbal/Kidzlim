import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/Icon'
import { activeVariants, formatAED, fromPrice, VARIANT_LABELS } from '@/lib/format'
import { asMedia, mediaUrl } from '@/lib/media'
import type { Book } from '@/payload-types'

import { RowScroller } from './RowScroller'

export function ShelfCard({ book, index }: { book: Book; index: number }) {
  const cover = asMedia(book.coverImage)
  const src = mediaUrl(book.coverImage, 'card')
  const price = fromPrice(book)
  const formats = [...new Set(activeVariants(book).map((v) => VARIANT_LABELS[v.type].replace('Digital PDF', 'PDF')))]
  return (
    <li className="kh-card" style={{ '--i': index } as React.CSSProperties}>
      <Link href={`/books/${book.slug}`} className="kh-card__link">
        <span className="kh-card__cover">
          {src ? (
            <Image src={src} alt={cover?.alt || book.title} fill sizes="(max-width: 640px) 42vw, 190px" />
          ) : (
            <span className="kh-card__placeholder">{book.title}</span>
          )}
          <span className="kh-card__shine" aria-hidden="true" />
          {price !== null && <span className="kh-card__price">{formatAED(price)}</span>}
        </span>
        <span className="kh-card__title">{book.title}</span>
        <span className="kh-card__meta">{[book.ageRange && `Ages ${book.ageRange}`, formats.join(' · ')].filter(Boolean).join(' — ')}</span>
      </Link>
    </li>
  )
}

/** A titled shelf of book covers that scrolls sideways, with a "View all" link. */
export function BookRow({ title, books, href, id }: { title: string; books: Book[]; href: string; id?: string }) {
  if (books.length === 0) return null
  return (
    <section className="kh-row k-wrap" id={id} data-reveal>
      <div className="kh-row__head">
        <h2 className="kh-row__title">{title}</h2>
        <Link href={href} className="kh-viewall">
          View all <Icon name="arrow" size={16} />
        </Link>
      </div>
      <RowScroller label={title}>
        {books.map((b, i) => (
          <ShelfCard key={b.id} book={b} index={i} />
        ))}
      </RowScroller>
    </section>
  )
}
