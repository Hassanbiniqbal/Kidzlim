'use client'

import Link from 'next/link'
import React from 'react'

import { formatAED } from '@/lib/format'

import { useCart, usePricedCart } from './CartProvider'
import { LineItem } from './LineItem'

export function CartView() {
  const { setQuantity, remove } = useCart()
  const { cart, error, loading, empty } = usePricedCart()

  if (empty) {
    return (
      <div className="k-empty">
        <p>Your basket is empty.</p>
        <Link href="/books" className="k-btn k-btn--lime">
          <span>Browse the books</span>
        </Link>
      </div>
    )
  }

  if (!cart) {
    return <p className="k-empty" aria-busy={loading}>{error ?? 'Loading your basket…'}</p>
  }

  return (
    <div className="k-checkout">
      <section aria-label="Items" className="k-checkout__main">
        {cart.issues.length > 0 && (
          <ul className="k-alert" role="status">
            {cart.issues.map((i) => (
              <li key={`${i.sku}-${i.reason}`}>{i.message}</li>
            ))}
          </ul>
        )}
        <ul className="k-lines">
          {cart.lines.map((line) => (
            <LineItem
              key={line.sku}
              line={line}
              onQuantity={(q) => setQuantity(line.sku, q)}
              onRemove={() => remove(line.sku)}
            />
          ))}
        </ul>
        <Link href="/books" className="k-link-arrow">
          ← Continue shopping
        </Link>
      </section>

      <aside className="k-card k-summary" aria-label="Order summary">
        <h2>Summary</h2>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatAED(cart.subtotalAED)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>{cart.hasPhysical ? 'Calculated at checkout' : 'Free — digital delivery'}</dd>
          </div>
        </dl>
        {error && <p className="k-form-error">{error}</p>}
        <Link href="/checkout" className="k-btn k-btn--lime k-summary__cta" aria-disabled={loading}>
          <span>Checkout</span>
        </Link>
        <p className="k-summary__note">Secure checkout · Prices in AED</p>
      </aside>
    </div>
  )
}
