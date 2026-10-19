import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { appendToOrder, withOrderWriteLock } from '@/lib/order-write'

const tick = () => new Promise((r) => setTimeout(r, 5))

/** A fake order store whose update writes the whole row, like Payload's. */
function fakePayload() {
  let row: { fulfilmentLog: { event: string }[]; status: string } = { fulfilmentLog: [], status: 'paid' }
  const payload = {
    findByID: async () => {
      await tick()
      return structuredClone(row)
    },
    update: async ({ data }: { data: Partial<typeof row> }) => {
      const base = structuredClone(row) // read…
      await tick() // …slow write
      row = { ...base, ...data }
      return row
    },
  }
  return { payload: payload as unknown as Payload, get: () => row }
}

describe('order write lock', () => {
  it('runs critical sections one at a time, in order', async () => {
    const seen: string[] = []
    const section = (name: string) =>
      withOrderWriteLock(async () => {
        seen.push(`${name}:start`)
        await tick()
        seen.push(`${name}:end`)
      })
    await Promise.all([section('a'), section('b'), section('c')])
    expect(seen).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
  })

  it('is re-entrant (a webhook transaction can call appendToOrder inside the lock)', async () => {
    const result = await withOrderWriteLock(() => withOrderWriteLock(async () => 'inner'))
    expect(result).toBe('inner')
  })

  it('keeps going after a failed section', async () => {
    await expect(withOrderWriteLock(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(withOrderWriteLock(async () => 'ok')).resolves.toBe('ok')
  })

  it('concurrent writers never drop each other’s log entries or fields', async () => {
    const { payload, get } = fakePayload()
    const at = new Date().toISOString()
    await Promise.all([
      appendToOrder(payload, 1, { status: 'refunded' }, [{ at, event: 'payment.refunded' }]),
      appendToOrder(payload, 1, {}, [{ at, event: 'email.confirmation.sent' }]),
      appendToOrder(payload, 1, {}, [{ at, event: 'gelato.sync' }]),
    ])
    expect(get().status).toBe('refunded')
    expect(get().fulfilmentLog.map((e) => e.event)).toEqual(['payment.refunded', 'email.confirmation.sent', 'gelato.sync'])
  })
})
