import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { BookGrid } from '@/components/BookCard'
import { ScrollActiveIntoView } from '@/components/ScrollActiveIntoView'
import { getBooks, getSeriesList } from '@/lib/cms'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ series?: string | string[] }> }

const DEFAULT_DESCRIPTION =
  'Browse Kidzlim’s Islamic children’s books — stories of the Prophets, Quran, Arabic, duas and good character. Printed or instant PDF download.'

async function selectedSeries(searchParams: Props['searchParams']) {
  const { series: raw } = await searchParams
  const slug = typeof raw === 'string' ? raw : undefined
  const list = await getSeriesList()
  return { list, active: slug ? (list.find((s) => s.slug === slug) ?? null) : null, requested: slug }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { active } = await selectedSeries(searchParams)
  if (!active) return { title: 'Islamic Books for Kids', description: DEFAULT_DESCRIPTION, alternates: { canonical: '/books' } }
  return {
    title: `${active.title} — Islamic Books for Kids`,
    description: active.blurb || DEFAULT_DESCRIPTION,
    alternates: { canonical: `/books?series=${active.slug}` },
  }
}

export default async function BooksPage({ searchParams }: Props) {
  const { list, active, requested } = await selectedSeries(searchParams)
  const books = await getBooks({ source: 'all', seriesId: active?.id })
  const total = list.reduce((n, s) => n + s.bookCount, 0)

  return (
    <>
      <header className="k-page-head k-wrap">
        <p className="k-hero__eyebrow">Little Muslims, Big Faith</p>
        <h1 className="k-page-head__title">{active ? active.title : 'Our Books'}</h1>
        <p className="k-page-head__lead">
          Beautifully illustrated Islamic stories for young readers — choose a printed edition delivered to your door,
          or an instant PDF download.
        </p>
      </header>
      <section className="k-section k-wrap">
        {list.length > 1 && (
          <nav aria-label="Book series">
            <ul className="k-filter">
              <li>
                <Link href="/books" aria-current={active ? undefined : 'page'} scroll={false}>
                  All books {total > 0 && <span className="k-filter__count">{total}</span>}
                </Link>
              </li>
              {list.map((s) => (
                <li key={s.id}>
                  <Link href={`/books?series=${s.slug}`} aria-current={active?.id === s.id ? 'page' : undefined} scroll={false}>
                    {s.title} <span className="k-filter__count">{s.bookCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {active && <ScrollActiveIntoView selector=".k-filter [aria-current='page']" />}
          </nav>
        )}
        {active?.blurb && <p className="k-filter-blurb">{active.blurb}</p>}
        {requested && !active ? (
          <p className="k-empty">
            We couldn’t find that series. <Link href="/books">See all books</Link>
          </p>
        ) : (
          <BookGrid books={books} />
        )}
      </section>
    </>
  )
}
