import 'server-only'

import { randomUUID } from 'crypto'

import { getPayloadClient } from './cms'
import { getCredential, MissingCredentialError } from './credentials'
import {
  createGelatoClient,
  createMockGelatoClient,
  GelatoError,
  type GelatoClient,
  type GelatoQuoteResponse,
} from './integrations/gelato'
import type { PricedLine } from './cart/pricing'
import type { Address } from './cart/schema'
import { buildShippingOptions, ShippingError, STORE_CURRENCY, toGelatoAddress, type ShippingOption } from './shipping-options'

export { ShippingError, toGelatoAddress, type ShippingOption } from './shipping-options'

/** Countries we ship printed books to: Settings → env STORE_SHIPPING_COUNTRIES → UAE only. */
export async function getShippingCountries(): Promise<string[]> {
  const payload = await getPayloadClient()
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  const fromSettings = (settings.store?.shippingCountries ?? []).filter(Boolean)
  if (fromSettings.length) return fromSettings.map((c) => c.toUpperCase())
  const fromEnv = (process.env.STORE_SHIPPING_COUNTRIES ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c))
  return fromEnv.length ? fromEnv : ['AE']
}

async function getGelatoClient(): Promise<GelatoClient> {
  if (process.env.NODE_ENV !== 'production' && process.env.GELATO_MOCK === '1') return createMockGelatoClient()
  try {
    return createGelatoClient({ apiKey: await getCredential('gelato.apiKey') })
  } catch (err) {
    if (err instanceof MissingCredentialError) {
      console.error(`[shipping] ${err.message}`)
      throw new ShippingError('not_configured', 'Shipping quotes are temporarily unavailable. Please try again later.')
    }
    throw err
  }
}

/** Live shipping quote for the physical lines of a priced cart. */
export async function quoteShipping(physicalLines: PricedLine[], address: Address): Promise<ShippingOption[]> {
  if (physicalLines.length === 0) return []

  const countries = await getShippingCountries()
  if (!countries.includes(address.country)) {
    throw new ShippingError(
      'unsupported_country',
      'We don’t ship printed books to this country yet. Digital PDFs are available worldwide.',
    )
  }

  const missing = physicalLines.find((l) => !l.gelatoProductUid)
  if (missing) {
    console.error(`[shipping] variant ${missing.sku} has no Gelato product UID`)
    throw new ShippingError('missing_product', `“${missing.title}” can’t be shipped right now. Please contact us.`)
  }

  const client = await getGelatoClient()
  let res: GelatoQuoteResponse
  try {
    res = await client.quote({
      orderReferenceId: `quote-${randomUUID()}`,
      customerReferenceId: 'guest',
      currency: STORE_CURRENCY,
      allowMultipleQuotes: true,
      recipient: toGelatoAddress(address),
      products: physicalLines.map((l) => ({
        itemReferenceId: l.sku,
        productUid: l.gelatoProductUid as string,
        quantity: l.quantity,
        ...(l.pageCount ? { pageCount: l.pageCount } : {}),
      })),
    })
  } catch (err) {
    if (err instanceof GelatoError) {
      console.error(`[shipping] ${err.message}`)
      throw new ShippingError(
        'provider_error',
        err.status && err.status < 500
          ? 'We couldn’t calculate shipping to this address. Please check it and try again.'
          : 'Shipping quotes are temporarily unavailable. Please try again in a moment.',
      )
    }
    throw err
  }

  const options = buildShippingOptions(res)
  if (options.length === 0) {
    throw new ShippingError('no_options', 'No delivery options are available for this address. Please contact us.')
  }
  return options
}
