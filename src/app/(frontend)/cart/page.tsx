import type { Metadata } from 'next'
import React from 'react'

import { CartView } from '@/components/cart/CartView'

export const metadata: Metadata = {
  title: 'Your Basket',
  robots: { index: false },
}

export default function CartPage() {
  return (
    <>
      <header className="k-page-head k-page-head--compact k-wrap">
        <h1 className="k-page-head__title">Your Basket</h1>
      </header>
      <div className="k-wrap">
        <CartView />
      </div>
    </>
  )
}
