import Link from 'next/link'
import React from 'react'

export default function NotFound() {
  return (
    <section className="k-hero k-wrap">
      <p className="k-hero__eyebrow">404</p>
      <h1 className="k-hero__title">Page not found</h1>
      <p className="k-hero__lead">This page seems to have wandered off. Let’s get you back to the stories.</p>
      <div className="k-hero__actions">
        <Link href="/books" className="k-btn k-btn--lime">
          <span>Browse books</span>
        </Link>
      </div>
    </section>
  )
}
