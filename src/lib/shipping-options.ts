import type { Address } from './cart/schema'
import type { GelatoAddress, GelatoQuoteResponse } from './integrations/gelato'

export const STORE_CURRENCY = 'AED'

export type ShippingOption = {
  id: string
  name: string
  priceAED: number
  minDays: number | null
  maxDays: number | null
  /** One Gelato shipmentMethodUid per quote (orders can be split across print facilities). */
  methodUids: string[]
}

export class ShippingError extends Error {
  constructor(
    public readonly code: 'unsupported_country' | 'not_configured' | 'missing_product' | 'no_options' | 'provider_error',
    message: string,
  ) {
    super(message)
    this.name = 'ShippingError'
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Pure: turns Gelato quotes into the options shown to the customer.
 * - One quote  → each of its shipment methods is an option.
 * - Split quotes (several facilities) → "Standard" (cheapest per quote) and,
 *   if different, "Fastest" (quickest per quote), with prices summed.
 * Only shipping is charged here — Gelato's production cost is our cost, not the customer's.
 */
export function buildShippingOptions(res: GelatoQuoteResponse, currency = STORE_CURRENCY): ShippingOption[] {
  const quotes = res.quotes.filter((q) => q.shipmentMethods.length > 0)
  if (quotes.length === 0 || quotes.length !== res.quotes.length) return []

  for (const q of quotes)
    for (const m of q.shipmentMethods)
      if (m.currency.toUpperCase() !== currency)
        throw new ShippingError('provider_error', `Shipping price returned in ${m.currency}, expected ${currency}.`)

  if (quotes.length === 1) {
    return quotes[0].shipmentMethods
      .map((m) => ({
        id: m.shipmentMethodUid,
        name: m.name,
        priceAED: round2(m.price),
        minDays: m.minDeliveryDays ?? null,
        maxDays: m.maxDeliveryDays ?? null,
        methodUids: [m.shipmentMethodUid],
      }))
      .sort((a, b) => a.priceAED - b.priceAED)
  }

  const pick = (by: 'price' | 'speed') =>
    quotes.map(
      (q) =>
        [...q.shipmentMethods].sort((a, b) =>
          by === 'price' ? a.price - b.price : (a.maxDeliveryDays ?? 99) - (b.maxDeliveryDays ?? 99) || a.price - b.price,
        )[0],
    )
  const combine = (id: string, name: string, picks: ReturnType<typeof pick>): ShippingOption => {
    const mins = picks.map((m) => m.minDeliveryDays).filter((d): d is number => typeof d === 'number')
    const maxs = picks.map((m) => m.maxDeliveryDays).filter((d): d is number => typeof d === 'number')
    return {
      id,
      name,
      priceAED: round2(picks.reduce((s, m) => s + m.price, 0)),
      minDays: mins.length === picks.length ? Math.max(...mins) : null,
      maxDays: maxs.length === picks.length ? Math.max(...maxs) : null,
      methodUids: picks.map((m) => m.shipmentMethodUid),
    }
  }

  const standard = combine('combined-standard', 'Standard', pick('price'))
  const fastest = combine('combined-fastest', 'Fastest', pick('speed'))
  return standard.methodUids.join() === fastest.methodUids.join() ? [standard] : [standard, fastest]
}

export const toGelatoAddress = (a: Address): GelatoAddress => ({
  firstName: a.firstName,
  lastName: a.lastName,
  addressLine1: a.addressLine1,
  ...(a.addressLine2 ? { addressLine2: a.addressLine2 } : {}),
  city: a.city,
  ...(a.state ? { state: a.state } : {}),
  ...(a.postCode ? { postCode: a.postCode } : {}),
  country: a.country,
  email: a.email,
  phone: a.phone,
})
