import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { getSeriesList } from '@/lib/cms'

import { Icon, type IconName } from './Icon'

const SOCIALS: { name: IconName; label: string; href: string }[] = [
  { name: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/kidzlim1/' },
  { name: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/kidzlim' },
  { name: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@kidzlim' },
  { name: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@kidzlim' },
]

async function seriesLinks() {
  try {
    return (await getSeriesList()).slice(0, 6)
  } catch {
    return [] // never let the footer take a page down
  }
}

export async function SiteFooter() {
  const series = await seriesLinks()
  return (
    <footer className="k-footer">
      <div className="k-wrap k-footer__top">
        <Link href="/" className="k-nav__brand" aria-label="Kidzlim home">
          <Image src="/brand/kidzlim-mascot.png" alt="" width={40} height={40} className="k-footer__mascot" />
          <span className="k-wordmark">Kidzlim</span>
        </Link>
        <div className="k-footer__follow">
          <span>Follow us on:</span>
          <ul className="k-footer__socials">
            {SOCIALS.map((s) => (
              <li key={s.name}>
                <a href={s.href} aria-label={s.label} rel="noopener noreferrer" target="_blank">
                  <Icon name={s.name} size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="k-wrap k-footer__grid">
        <nav aria-label="Shop" className="k-footer__col">
          <h2>Shop</h2>
          <Link href="/books">All books</Link>
          <Link href="/#series">Browse by series</Link>
          <Link href="/cart">Your basket</Link>
          <Link href="/downloads/resend">Resend my download</Link>
        </nav>

        <nav aria-label="Series" className="k-footer__col">
          <h2>Series</h2>
          {series.map((s) => (
            <Link key={s.id} href={`/books?series=${s.slug}`}>
              {s.title}
            </Link>
          ))}
        </nav>

        <nav aria-label="Help" className="k-footer__col">
          <h2>Help</h2>
          <Link href="/#faq">FAQ</Link>
          <Link href="/about">About Kidzlim</Link>
          <Link href="/terms-of-use">Shipping &amp; returns</Link>
        </nav>

        <nav aria-label="Legal" className="k-footer__col">
          <h2>Legal</h2>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-of-use">Terms of Use</Link>
        </nav>
      </div>

      <div className="k-wrap k-footer__base">
        <p>© {new Date().getFullYear()} Kidzlim. Little Muslims, Big Faith.</p>
        <p>
          © 2018–Present | Proudly under{' '}
          <a href="https://www.nzmgroup.co" rel="noopener noreferrer" target="_blank">
            NZMGROUP.CO (House of Brands)
          </a>
        </p>
      </div>
    </footer>
  )
}
