import { describe, expect, it, vi } from 'vitest'

import { decideStatus, extractTracking } from '@/lib/gelato-status'
import { createGelatoClient } from '@/lib/integrations/gelato'
import { actionState, type ActionOrder } from '@/lib/order-actions'

describe('decideStatus', () => {
  it('moves forward through production and shipping', () => {
    expect(decideStatus('passed', 'paid').status).toBe('submitted_to_gelato')
    expect(decideStatus('printed', 'submitted_to_gelato').status).toBe('in_production')
    expect(decideStatus('shipped', 'in_production').status).toBe('shipped')
    expect(decideStatus('delivered', 'shipped').status).toBe('delivered')
  })

  it('never moves backwards when webhooks arrive out of order', () => {
    expect(decideStatus('in_production', 'shipped').status).toBeNull()
    expect(decideStatus('created', 'delivered').status).toBeNull()
  })

  it('never resurrects cancelled or refunded orders', () => {
    expect(decideStatus('shipped', 'cancelled')).toEqual({ status: null, attention: null })
    expect(decideStatus('shipped', 'refunded').status).toBeNull()
  })

  it('flags problems for a human instead of guessing', () => {
    const failed = decideStatus('failed', 'submitted_to_gelato')
    expect(failed.status).toBeNull()
    expect(failed.attention).toMatch(/FAILED/)
    expect(decideStatus('canceled', 'submitted_to_gelato')).toMatchObject({ status: 'cancelled', attention: expect.any(String) })
    expect(decideStatus('returned', 'shipped').attention).toMatch(/returned/)
  })

  it('ignores unknown statuses', () => {
    expect(decideStatus('something_new', 'paid')).toEqual({ status: null, attention: null })
    expect(decideStatus(undefined, 'paid').status).toBeNull()
  })
})

describe('extractTracking', () => {
  it('finds the first tracking info on any item', () => {
    expect(
      extractTracking({
        items: [
          { fulfillments: [] },
          { fulfillments: [{ trackingCode: 'AE123', trackingUrl: 'https://track.example/AE123' }] },
        ],
      }),
    ).toEqual({ trackingCode: 'AE123', trackingUrl: 'https://track.example/AE123' })
  })
  it('returns nulls when nothing has shipped', () => {
    expect(extractTracking({ items: [{ fulfillments: null }] })).toEqual({ trackingCode: null, trackingUrl: null })
    expect(extractTracking(null)).toEqual({ trackingCode: null, trackingUrl: null })
  })
})

const base: ActionOrder = {
  status: 'submitted_to_gelato',
  gelatoOrderId: 'g-1',
  gelatoStatus: 'passed',
  stripePaymentIntentId: 'pi_1',
  amountAED: 145,
  refundedAmountAED: 0,
  needsAttention: false,
  items: [{ variant: 'paperback' } as NonNullable<ActionOrder['items']>[number]],
}

describe('actionState', () => {
  it('allows cancelling a print order only before production', () => {
    expect(actionState('cancel-gelato', base, 'staff').allowed).toBe(true)
    expect(actionState('cancel-gelato', { ...base, gelatoStatus: 'printed' }, 'admin').allowed).toBe(false)
    expect(actionState('cancel-gelato', { ...base, status: 'shipped' }, 'admin').allowed).toBe(false)
  })

  it('keeps refunds admin-only and stops at the paid amount', () => {
    expect(actionState('refund', base, 'staff')).toEqual({ allowed: false, reason: 'Admins only' })
    expect(actionState('refund', base, 'admin').allowed).toBe(true)
    expect(actionState('refund', { ...base, refundedAmountAED: 145 }, 'admin').allowed).toBe(false)
    expect(actionState('refund', { ...base, stripePaymentIntentId: null }, 'admin').allowed).toBe(false)
  })

  it('only offers digital resend for orders with PDFs', () => {
    expect(actionState('resend-download', base, 'admin').allowed).toBe(false)
    const digital = { ...base, items: [{ variant: 'digital' } as NonNullable<ActionOrder['items']>[number]] }
    expect(actionState('resend-download', digital, 'staff').allowed).toBe(true)
    expect(actionState('resend-download', { ...digital, status: 'refunded' }, 'admin').allowed).toBe(false)
  })

  it('only retries Gelato for paid orders that were never submitted', () => {
    expect(actionState('retry-gelato', base, 'admin').allowed).toBe(false)
    expect(actionState('retry-gelato', { ...base, gelatoOrderId: null, status: 'paid' }, 'admin').allowed).toBe(true)
  })

  it('denies everything when signed out', () => {
    expect(actionState('sync-gelato', base, null).allowed).toBe(false)
  })
})

describe('Gelato getOrder / cancelOrder', () => {
  it('reads an order by id and cancels with an idempotency key', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith(':cancel')
        ? Response.json({})
        : Response.json({ id: 'g-1', orderReferenceId: 'KZ-1', fulfillmentStatus: 'shipped', items: [{ fulfillments: [{ trackingCode: 'X' }] }] }),
    )
    const client = createGelatoClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch })
    const order = await client.getOrder('g-1')
    expect(order.fulfillmentStatus).toBe('shipped')
    await client.cancelOrder('g-1')

    const [getUrl, getInit] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const [cancelUrl, cancelInit] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit]
    expect(getUrl).toBe('https://order.gelatoapis.com/v4/orders/g-1')
    expect(getInit.method).toBe('GET')
    expect(cancelUrl).toBe('https://order.gelatoapis.com/v4/orders/g-1:cancel')
    expect((cancelInit.headers as Record<string, string>)['Idempotency-Key']).toBe('gelato-cancel-g-1')
  })

  it('surfaces "too late to cancel" errors', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ message: 'Order is in production' }, { status: 409 }))
    const client = createGelatoClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch })
    await expect(client.cancelOrder('g-1')).rejects.toMatchObject({ status: 409 })
  })
})

describe('isStaleGelatoStatus', () => {
  it('detects events older than the recorded status', async () => {
    const { isStaleGelatoStatus } = await import('@/lib/gelato-status')
    expect(isStaleGelatoStatus('printed', 'shipped')).toBe(true)
    expect(isStaleGelatoStatus('created', 'in_production')).toBe(true)
    expect(isStaleGelatoStatus('shipped', 'in_production')).toBe(false)
    expect(isStaleGelatoStatus('shipped', 'shipped')).toBe(false)
    expect(isStaleGelatoStatus('canceled', 'shipped')).toBe(false)
    expect(isStaleGelatoStatus('failed', 'shipped')).toBe(false)
  })
})
