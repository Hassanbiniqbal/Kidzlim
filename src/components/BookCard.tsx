import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { activeVariants, formatAED, fromPrice, VARIANT_LABELS } from '@/lib/format'
import { asMedia, mediaUrl } from '@/lib/media'
import type { Book } from '@/payload-types'

export function BookCard({ book }: { book: Book }) {
  const cover = asMedia(book.coverImage)
  const src = mediaUrl(book.coverImage, 'card')
  const price = fromPrice(book)
  const series = typeof book.series === 'object' ? book.series : null
  const formats = [...new Set(activeVariants(book).map((v) => VARIANT_LABELS[v.type]))]

  return (
    <Link href={`/books/${book.slug}`} className="k-book-card">
      <div className="k-book-card__cover">
        {src ? (
          <Image
            src={src}
            alt={cover?.alt || book.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          />
        ) : (
          <span className="k-book-card__placeholder">{book.title}</span>
        )}
      </div>
      <div className="k-book-card__body">
        {(series || book.ageRange) && (
          <p className="k-book-card__meta">{[series?.title, book.ageRange && `Ages ${book.ageRange}`].filter(Boolean).join(' · ')}</p>
        )}
        <h3>{book.title}</h3>
        {formats.length > 0 && <p className="k-book-card__formats">{formats.join(' · ')}</p>}
        {price !== null && (
          <p className="k-book-card__price">
            <span>From</span> {formatAED(price)}
          </p>
        )}
      </div>
    </Link>
  )
}

export function BookGrid({ books, emptyText }: { books: Book[]; emptyText?: string }) {
  if (books.length === 0) {
    return <p className="k-empty">{emptyText ?? 'New titles are on their way, in shā’ Allāh. Check back soon.'}</p>
  }
  return (
    <div className="k-book-grid">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  )
}
