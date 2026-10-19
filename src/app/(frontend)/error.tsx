'use client'

import Link from 'next/link'
import React from 'react'

/**
 * Shown instead of a crash when a page fails (e.g. the database is unreachable).
 * In development it also explains the most common setup problem.
 */
export default function FrontendError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isDev = process.env.NODE_ENV !== 'production'
  const dbAuth = /password authentication failed|cannot connect to Postgres|ECONNREFUSED/i.test(error.message)

  return (
    <section className="k-hero k-wrap">
      <p className="k-hero__eyebrow">Something went wrong</p>
      <h1 className="k-hero__title">We’ll be right back</h1>
      <p className="k-hero__lead">
        The store is having a moment. Please try again shortly — your basket is saved on this device.
      </p>
      <div className="k-hero__actions" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="k-btn k-btn--lime" onClick={reset}>
          <span>Try again</span>
        </button>
        <Link href="/" className="k-btn k-btn--ghost">
          Home
        </Link>
      </div>

      {isDev && (
        <div className="k-card k-dev-error">
          <strong>Developer info</strong>
          <code>{error.message}</code>
          {dbAuth && (
            <p>
              The app can’t reach PostgreSQL. Check <code>DATABASE_URL</code> in <code>.env</code> (password, database
              name, server running), then restart the dev server.
            </p>
          )}
          {error.digest && <small>Digest: {error.digest}</small>}
        </div>
      )}
    </section>
  )
}
