import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { CartLink } from './cart/CartLink'
import { Icon } from './Icon'

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/books', label: 'Books' },
  { href: '/#series', label: 'Series' },
  { href: '/about', label: 'About' },
]

/** Plain GET form to /books?q=… — works without JavaScript. */
function SearchForm({ id }: { id: string }) {
  return (
    <form action="/books" method="get" role="search" className="k-search">
      <label htmlFor={id} className="k-visually-hidden">
        Search books
      </label>
      <Icon name="search" size={16} className="k-search__icon" />
      <input id={id} name="q" type="search" placeholder="Search books" autoComplete="off" maxLength={80} />
    </form>
  )
}

export function SiteHeader() {
  return (
    <header className="k-nav">
      <div className="k-nav__inner">
        <Link href="/" className="k-nav__brand" aria-label="Kidzlim home">
          <Image src="/brand/kidzlim-mascot.png" alt="" width={36} height={36} priority />
          <span className="k-wordmark">Kidzlim</span>
        </Link>

        <nav aria-label="Main" className="k-nav__links">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="k-nav__actions">
          <div className="k-nav__search">
            <SearchForm id="site-search" />
          </div>
          <CartLink />
        </div>

        {/* No-JS mobile menu */}
        <details className="k-nav__mobile">
          <summary aria-label="Open menu">
            <Icon name="menu" size={22} />
          </summary>
          <nav aria-label="Mobile" className="k-nav__sheet">
            <SearchForm id="site-search-mobile" />
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
            <Link href="/books" className="k-btn k-btn--lime">
              <span>Shop Books</span>
            </Link>
          </nav>
        </details>
      </div>
    </header>
  )
}
