'use client'

import Link from 'next/link'
import React, { useState } from 'react'

import { Icon } from '@/components/Icon'
import { formatAED, VARIANT_LABELS, type Variant } from '@/lib/format'

import { useCart } from './CartProvider'

type Props = {
  bookId: number
  variants: Pick<Variant, 'sku' | 'type' | 'priceAED' | 'compareAtPriceAED'>[]
}

/** Format picker + quantity + add to basket. Prices shown here are display-only; checkout re-prices on the server. */
export function BuyBox({ bookId, variants }: Props) {
  const { add } = useCart()
  const [sku, setSku] = useState(variants[0]?.sku ?? '')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const selected = variants.find((v) => v.sku === sku)
  const isDigital = selected?.type === 'digital'

  if (variants.length === 0) {
    return <p className="k-book__note">This book isn’t available to order right now.</p>
  }

  return (
    <form
      className="k-buybox"
      onSubmit={(e) => {
        e.preventDefault()
        if (!selected) return
        add({ bookId, sku: selected.sku, quantity: isDigital ? 1 : quantity })
        setAdded(true)
      }}
    >
      <fieldset className="k-formats">
        <legend>Choose a format</legend>
        {variants.map((v) => (
          <label key={v.sku} className="k-format">
            <input
              type="radio"
              name="variant"
              value={v.sku}
              checked={sku === v.sku}
              onChange={() => {
                setSku(v.sku)
                setAdded(false)
              }}
            />
            <span className="k-format__icon">
              <Icon name={v.type === 'digital' ? 'download' : 'book'} size={20} />
            </span>
            <span className="k-format__name">
              {VARIANT_LABELS[v.type]}
              <small>{v.type === 'digital' ? 'Instant download after checkout' : 'Printed & delivered to you'}</small>
            </span>
            <span className="k-format__price">
              {v.compareAtPriceAED && v.compareAtPriceAED > v.priceAED ? <s>{formatAED(v.compareAtPriceAED)}</s> : null}
              {formatAED(v.priceAED)}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="k-buybox__row">
        {!isDigital && (
          <div className="k-qty" role="group" aria-label="Quantity">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" onClick={() => setQuantity((q) => Math.min(20, q + 1))} aria-label="Increase quantity">
              +
            </button>
          </div>
        )}
        <button type="submit" className="k-btn k-btn--lime k-buybox__add">
          <span>Add to basket</span>
        </button>
      </div>

      <p className="k-buybox__status" role="status" aria-live="polite">
        {added ? (
          <>
            Added to your basket. <Link href="/cart">View basket →</Link>
          </>
        ) : (
          'Prices in AED. Shipping is calculated at checkout.'
        )}
      </p>
    </form>
  )
}
