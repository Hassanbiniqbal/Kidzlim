import type { Metadata } from 'next'
import React from 'react'

import { ResendDownloadForm } from '@/components/ResendDownloadForm'

export const metadata: Metadata = {
  title: 'Resend my download',
  description: 'Lost your Kidzlim download email? Get a fresh link sent to you.',
}

export default function ResendDownloadPage() {
  return (
    <>
      <header className="k-page-head k-page-head--compact k-wrap">
        <h1 className="k-page-head__title">Resend my download</h1>
        <p className="k-page-head__lead">
          Can’t find your download email? Enter the email you used at checkout and your order number, and we’ll send a
          fresh link.
        </p>
      </header>
      <section className="k-wrap">
        <div className="k-card k-thanks__card">
          <ResendDownloadForm />
        </div>
      </section>
    </>
  )
}
