import type { Metadata } from 'next'
import React from 'react'

import { CheckoutView } from '@/components/cart/CheckoutView'
import { getShippingCountries } from '@/lib/shipping'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false },
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams
  const codes = await getShippingCountries()
  const names = new Intl.DisplayNames(['en'], { type: 'region' })
  const countries = codes
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <header className="k-page-head k-page-head--compact k-wrap">
        <h1 className="k-page-head__title">Checkout</h1>
      </header>
      <div className="k-wrap">
        <CheckoutView countries={countries} cancelled={cancelled === '1'} />
      </div>
    </>
  )
}
