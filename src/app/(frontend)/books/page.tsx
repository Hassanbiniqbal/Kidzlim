import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { BookGrid } from '@/components/BookCard'
import { RevealObserver } from '@/components/home/Reveal'
import { ScrollActiveIntoView } from '@/components/ScrollActiveIntoView'
import { getBooks, getSeriesList } from '@/lib/cms'

import '../home.css'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ series?: string | string[]; q?: string | string[] }> }

const DEFAULT_DESCRIPTION =
  'Browse Kidzlim’s Islamic children’s books — stories of the Prophets, Quran, Arabic, duas and good character. Printed or instant PDF download.'

async function selectedSeries(searchParams: Props['searchParams']) {
  const { series: raw, q: rawQ } = await searchParams
  const slug = typeof raw === 'string' ? raw : undefined
  const q = typeof rawQ === 'string' ? rawQ.trim().slice(0, 80) : ''
  const list = await getSeriesList()
  return { list, active: slug ? (list.find((s) => s.slug === slug) ?? null) : null, requested: slug, q }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { active, q } = await selectedSeries(searchParams)
  if (q) return { title: `Search: ${q}`, robots: { index: false } }
  if (!active) return { title: 'Islamic Books for Kids', description: DEFAULT_DESCRIPTION, alternates: { canonical: '/books' } }
  return {
    title: `${active.title} — Islamic Books for Kids`,
    description: active.blurb || DEFAULT_DESCRIPTION,
    alternates: { canonical: `/books?series=${active.slug}` },
  }
}

export default async function BooksPage({ searchParams }: Props) {
  const { list, active, requested, q } = await selectedSeries(searchParams)
  const books = await getBooks({ source: 'all', seriesId: active?.id, search: q || undefined })
  const total = list.reduce((n, s) => n + s.bookCount, 0)

  return (
    <>
      <header className="k-page-head k-wrap kb-head" key={`${active?.id ?? 'all'}-${q}`}>
        <span className="kh-spark kh-spark--1" aria-hidden="true">✦</span>
        <span className="kh-spark kh-spark--2" aria-hidden="true">✧</span>
        <span className="kh-spark kh-spark--3" aria-hidden="true">☾</span>
        <span className="kh-spark kh-spark--4" aria-hidden="true">✦</span>
        <p className="k-hero__eyebrow kh-rise" style={{ '--d': 0 } as React.CSSProperties}>
          Little Muslims, Big Faith
        </p>
        <h1 className="k-page-head__title kb-title">
          {(q ? 'Search' : active ? active.title : 'Our Books').split(' ').map((word, i) => (
            <React.Fragment key={`${word}-${i}`}>
              {i > 0 && ' '}
              <span className="kh-word" style={{ '--d': i } as React.CSSProperties}>
                {word}
              </span>
            </React.Fragment>
          ))}
        </h1>
        <p className="k-page-head__lead kh-rise" style={{ '--d': 3 } as React.CSSProperties}>
          {q
            ? `${books.length} ${books.length === 1 ? 'book matches' : 'books match'} “${q}”.`
            : 'Beautifully illustrated Islamic stories for young readers — choose a printed edition delivered to your door, or an instant PDF download.'}
        </p>
      </header>
      <section className="k-section k-wrap">
        {list.length > 1 && (
          <nav aria-label="Book series">
            <ul className="k-filter" data-reveal data-reveal-stagger>
              <li style={{ '--i': 0 } as React.CSSProperties}>
                <Link href="/books" aria-current={active ? undefined : 'page'} scroll={false}>
                  All books {total > 0 && <span className="k-filter__count">{total}</span>}
                </Link>
              </li>
              {list.map((s, i) => (
                <li key={s.id} style={{ '--i': i + 1 } as React.CSSProperties}>
                  <Link href={`/books?series=${s.slug}`} aria-current={active?.id === s.id ? 'page' : undefined} scroll={false}>
                    {s.title} <span className="k-filter__count">{s.bookCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {active && <ScrollActiveIntoView selector=".k-filter [aria-current='page']" />}
          </nav>
        )}
        {active?.blurb && (
          <p className="k-filter-blurb kh-rise" key={active.id} style={{ '--d': 1 } as React.CSSProperties}>
            {active.blurb}
          </p>
        )}
        {requested && !active ? (
          <p className="k-empty">
            We couldn’t find that series. <Link href="/books">See all books</Link>
          </p>
        ) : (
          <BookGrid
            reveal
            books={books}
            emptyText={q ? 'No books match that search yet — try another word, or browse a series above.' : undefined}
          />
        )}
      </section>
      <RevealObserver />
    </>
  )
}
