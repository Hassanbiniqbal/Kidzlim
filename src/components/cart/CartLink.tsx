'use client'

import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/Icon'

import { useCart } from './CartProvider'

export function CartLink() {
  const { count, ready } = useCart()
  const label = ready && count > 0 ? `Basket, ${count} item${count === 1 ? '' : 's'}` : 'Basket'
  return (
    <Link href="/cart" className="k-cart-link" aria-label={label}>
      <Icon name="bag" size={20} />
      {ready && count > 0 && <span className="k-cart-link__count">{count > 99 ? '99+' : count}</span>}
    </Link>
  )
}
