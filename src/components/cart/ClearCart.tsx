'use client'

import { useEffect, useRef } from 'react'

import { useCart } from './CartProvider'

const DRAFT_KEY = 'kidzlim.checkout.v1'

/** Empties the basket and the saved checkout draft once an order is confirmed. */
export function ClearCart() {
  const { clear, ready } = useCart()
  const done = useRef(false)
  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    clear()
    try {
      window.sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }, [ready, clear])
  return null
}
