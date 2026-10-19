import { describe, expect, it, vi } from 'vitest'

import { addressSchema } from '@/lib/cart/schema'
import { createGelatoClient, GelatoError } from '@/lib/integrations/gelato'
import { buildShippingOptions, ShippingError } from '@/lib/shipping-options'

const method = (uid: string, price: number, min: number, max: number, currency = 'AED') => ({
  shipmentMethodUid: uid,
  name: uid,
  price,
  currency,
  minDeliveryDays: min,
  maxDeliveryDays: max,
})

describe('buildShippingOptions', () => {
  it('lists every method of a single quote, cheapest first', () => {
    const options = buildShippingOptions({
      quotes: [{ shipmentMethods: [method('express', 40, 2, 3), method('normal', 15.5, 5, 8)] }],
    })
    expect(options.map((o) => [o.id, o.priceAED])).toEqual([
      ['normal', 15.5],
      ['express', 40],
    ])
    expect(options[0].methodUids).toEqual(['normal'])
  })

  it('combines split quotes into Standard and Fastest', () => {
    const options = buildShippingOptions({
      quotes: [
        { shipmentMethods: [method('a-normal', 10, 4, 7), method('a-express', 30, 1, 2)] },
        { shipmentMethods: [method('b-normal', 12, 5, 9), method('b-express', 25, 2, 3)] },
      ],
    })
    expect(options).toEqual([
      expect.objectContaining({ name: 'Standard', priceAED: 22, maxDays: 9, methodUids: ['a-normal', 'b-normal'] }),
      expect.objectContaining({ name: 'Fastest', priceAED: 55, maxDays: 3, methodUids: ['a-express', 'b-express'] }),
    ])
  })

  it('returns nothing if any part of the order cannot ship', () => {
    expect(buildShippingOptions({ quotes: [{ shipmentMethods: [method('x', 5, 1, 2)] }, { shipmentMethods: [] }] })).toEqual([])
    expect(buildShippingOptions({ quotes: [] })).toEqual([])
  })

  it('refuses to guess when Gelato prices in another currency', () => {
    expect(() => buildShippingOptions({ quotes: [{ shipmentMethods: [method('x', 5, 1, 2, 'USD')] }] })).toThrow(ShippingError)
  })
})

describe('addressSchema', () => {
  const valid = {
    firstName: ' Amina ',
    lastName: 'R',
    email: 'Amina@Example.com',
    phone: '+971 50 123 4567',
    addressLine1: 'Villa 12, Street 4',
    city: 'Dubai',
    country: 'ae',
    postCode: '',
  }

  it('normalises input', () => {
    const a = addressSchema.parse(valid)
    expect(a).toMatchObject({ firstName: 'Amina', email: 'amina@example.com', country: 'AE' })
    expect(a.postCode).toBeUndefined()
  })

  it('rejects bad email, phone and country', () => {
    const r = addressSchema.safeParse({ ...valid, email: 'nope', phone: 'call me', country: 'UAE' })
    expect(r.success).toBe(false)
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0])
    expect(fields).toEqual(expect.arrayContaining(['email', 'phone', 'country']))
  })
})

describe('createGelatoClient', () => {
  const request = {
    orderReferenceId: 'q-1',
    customerReferenceId: 'guest',
    currency: 'AED',
    recipient: {
      firstName: 'A',
      lastName: 'B',
      addressLine1: 'x',
      city: 'Dubai',
      country: 'AE',
      email: 'a@b.co',
      phone: '+971500000000',
    },
    products: [{ itemReferenceId: 'B1-PB', productUid: 'uid', quantity: 1 }],
  }

  it('posts to /v4/orders:quote with the API key and parses the response', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ quotes: [{ shipmentMethods: [{ ...method('normal', '18.50' as unknown as number, 3, 5) }] }] }),
    )
    const client = createGelatoClient({ apiKey: 'test-key', fetchImpl: fetchImpl as unknown as typeof fetch })
    const res = await client.quote(request)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://order.gelatoapis.com/v4/orders:quote')
    expect((init.headers as Record<string, string>)['X-API-KEY']).toBe('test-key')
    expect(JSON.parse(init.body as string)).toMatchObject({ currency: 'AED', recipient: { country: 'AE' } })
    expect(res.quotes[0].shipmentMethods[0].price).toBe(18.5)
  })

  it('surfaces API errors with status', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ message: 'Invalid address' }, { status: 400 }))
    const client = createGelatoClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch })
    await expect(client.quote(request)).rejects.toMatchObject({ name: 'GelatoError', status: 400 })
  })

  it('fails loudly on an unexpected response shape', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ something: 'else' }))
    const client = createGelatoClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch })
    await expect(client.quote(request)).rejects.toBeInstanceOf(GelatoError)
  })
})
