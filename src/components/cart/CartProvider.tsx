'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import type { PricedCart, PricedLine } from '@/lib/cart/pricing'
import type { CartLineInput } from '@/lib/cart/schema'

const STORAGE_KEY = 'kidzlim.cart.v1'

/** Priced line as sent to the browser (fulfilment fields stripped by the API). */
export type ClientPricedLine = Omit<PricedLine, 'gelatoProductUid' | 'pageCount'>
export type ClientPricedCart = Omit<PricedCart, 'lines'> & { lines: ClientPricedLine[] }

/* ── Cart store: localStorage with an in-memory fallback (private mode / blocked storage) ── */

const EMPTY: CartLineInput[] = []
const listeners = new Set<() => void>()
let memoryRaw: string | null = null
let cache: { raw: string | null; lines: CartLineInput[] } = { raw: null, lines: EMPTY }

function readRaw(): string | null {
  if (memoryRaw !== null) return memoryRaw // a write already failed — memory is the source of truth
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return memoryRaw
  }
}

function parse(raw: string | null): CartLineInput[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return EMPTY
    return parsed.filter(
      (l): l is CartLineInput =>
        l && typeof l.bookId === 'number' && typeof l.sku === 'string' && Number.isInteger(l.quantity) && l.quantity > 0,
    )
  } catch {
    return EMPTY
  }
}

function getSnapshot(): CartLineInput[] {
  const raw = readRaw()
  if (raw !== cache.raw) cache = { raw, lines: parse(raw) }
  return cache.lines
}

function writeLines(lines: CartLineInput[]) {
  const raw = JSON.stringify(lines)
  try {
    window.localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    memoryRaw = raw
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener() // other tabs
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const noopSubscribe = () => () => {}

/* ── Context ── */

type CartContextValue = {
  lines: CartLineInput[]
  ready: boolean
  count: number
  add: (line: CartLineInput) => void
  setQuantity: (sku: string, quantity: number) => void
  remove: (sku: string) => void
  clear: () => void
  replace: (lines: CartLineInput[]) => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
  // false during SSR/hydration, true once running in the browser.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false)

  const update = useCallback((fn: (prev: CartLineInput[]) => CartLineInput[]) => writeLines(fn(getSnapshot())), [])

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      add: (line) =>
        update((prev) => {
          const existing = prev.find((l) => l.sku === line.sku)
          if (!existing) return [...prev, line]
          return prev.map((l) => (l.sku === line.sku ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l))
        }),
      setQuantity: (sku, quantity) =>
        update((prev) =>
          quantity <= 0
            ? prev.filter((l) => l.sku !== sku)
            : prev.map((l) => (l.sku === sku ? { ...l, quantity: Math.min(20, quantity) } : l)),
        ),
      remove: (sku) => update((prev) => prev.filter((l) => l.sku !== sku)),
      clear: () => update(() => []),
      replace: (next) => update(() => next),
    }),
    [lines, ready, update],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}

type PriceResult = { key: string; cart: ClientPricedCart | null; error: string | null }

/**
 * Fetches server-side prices for the current cart. Prices shown to the customer always
 * come from here, never from local storage. Also prunes lines the server rejected.
 */
export function usePricedCart() {
  const { lines, ready, replace } = useCart()
  const [result, setResult] = useState<PriceResult | null>(null)
  const [version, setVersion] = useState(0)
  const key = `${version}:${JSON.stringify(lines)}`

  useEffect(() => {
    if (!ready || lines.length === 0) return
    const controller = new AbortController()
    fetch('/api/store/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Could not load your basket.')
        const priced = body as ClientPricedCart
        setResult({ key, cart: priced, error: null })
        // Keep stored cart in sync with what the server accepted (removed items, capped quantities).
        const accepted = priced.lines.map((l) => ({ bookId: l.bookId, sku: l.sku, quantity: l.quantity }))
        if (JSON.stringify(accepted) !== JSON.stringify(lines)) replace(accepted)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResult((prev) => ({
          key,
          cart: prev?.cart ?? null,
          error: err instanceof Error ? err.message : 'Could not load your basket.',
        }))
      })
    return () => controller.abort()
    // `key` captures `lines`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  const empty = ready && lines.length === 0
  const current = result?.key === key ? result : null
  return {
    // While re-pricing after a change, keep showing the last priced cart to avoid flicker.
    cart: empty ? null : (current?.cart ?? result?.cart ?? null),
    error: current?.error ?? null,
    loading: !ready || (!empty && !current),
    empty,
    /** Re-price now (e.g. after the server reported a price change). */
    refresh: () => setVersion((v) => v + 1),
  }
}
