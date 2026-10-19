import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/Icon'
import { resolveDownload } from '@/lib/downloads'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your downloads',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

const ERRORS: Record<string, string> = {
  limit: 'You’ve reached the download limit for that book. Contact us if you need more.',
  missing: 'That file isn’t available right now. Please contact us and we’ll sort it out.',
  expired: 'This download link has expired.',
  invalid: 'This download link isn’t valid.',
  unavailable: 'This order is no longer available for download.',
}

export default async function DownloadPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const { error } = await searchParams
  const access = await resolveDownload(token)

  if (!access.ok) {
    return (
      <section className="k-hero k-wrap">
        <p className="k-hero__eyebrow">Downloads</p>
        <h1 className="k-hero__title">{access.reason === 'expired' ? 'Link expired' : 'Link not valid'}</h1>
        <p className="k-hero__lead">
          {ERRORS[access.reason]} You can get a fresh link sent to the email you used at checkout.
        </p>
        <div className="k-hero__actions">
          <Link href="/downloads/resend" className="k-btn k-btn--lime">
            <span>Send me a new link</span>
          </Link>
        </div>
      </section>
    )
  }

  const expires = new Date(access.expiresAt).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dubai',
  })

  return (
    <>
      <header className="k-page-head k-page-head--compact k-wrap">
        <p className="k-hero__eyebrow">Order {access.order.orderNumber}</p>
        <h1 className="k-page-head__title">Your books</h1>
        <p className="k-page-head__lead">
          Each book can be downloaded up to {access.maxDownloads} times. This link works until {expires} (UAE time).
        </p>
      </header>
      <section className="k-wrap">
        <div className="k-card k-thanks__card">
          {error && ERRORS[error] && (
            <p className="k-form-error" role="alert">
              {ERRORS[error]}
            </p>
          )}
          <ul className="k-downloads">
            {access.items.map((item) => (
              <li key={item.sku}>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.remaining > 0
                      ? `${item.remaining} of ${access.maxDownloads} downloads left`
                      : 'Download limit reached'}
                  </span>
                </div>
                {item.remaining > 0 ? (
                  <a
                    className="k-btn k-btn--lime"
                    href={`/api/store/download/${token}/${encodeURIComponent(item.sku)}`}
                    rel="nofollow noreferrer"
                  >
                    <span>
                      <Icon name="download" size={16} /> Download PDF
                    </span>
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="k-summary__note">
            Each PDF is marked with your email address. Please keep it within your family — JazākAllāhu khayran.
          </p>
        </div>
      </section>
    </>
  )
}
