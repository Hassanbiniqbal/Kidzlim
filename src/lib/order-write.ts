import { AsyncLocalStorage } from 'async_hooks'
import type { Payload, PayloadRequest } from 'payload'

import type { Order } from '../payload-types'

/**
 * Serialises every programmatic write to an order (webhooks, fulfilment jobs, admin actions,
 * downloads). Payload's update re-writes the whole row, so two writers that overlap can lose
 * each other's changes — most visibly fulfilment-log entries, but also status or refund fields.
 *
 * The store runs as a single app process (jobs run in-process via lib/job-runner), so an in-process
 * lock is enough; run one app container. Writes are tiny, so one lock for all orders is fine.
 * Re-entrant: code already holding the lock (e.g. inside a webhook transaction) runs directly.
 * CLI-safe (loaded by fulfilment jobs via payload.config).
 */
type LockState = { held: AsyncLocalStorage<true>; tail: Promise<void> }
// On globalThis so dev hot-reloads (and separately bundled route chunks) share one lock.
const lock: LockState = ((globalThis as { __kidzlimOrderLock?: LockState }).__kidzlimOrderLock ??= {
  held: new AsyncLocalStorage<true>(),
  tail: Promise.resolve(),
})

export async function withOrderWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  if (lock.held.getStore()) return fn()
  const previous = lock.tail
  let release: () => void = () => undefined
  lock.tail = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await lock.held.run(true, fn)
  } finally {
    release()
  }
}

type LogEntry = NonNullable<Order['fulfilmentLog']>[number]

/**
 * Applies `data` to an order and appends `logs` to its fulfilment log, reading the log fresh
 * under the lock so concurrent writers never drop each other's entries.
 */
export async function appendToOrder(
  payload: Payload,
  orderId: number,
  data: Partial<Order>,
  logs: LogEntry[],
  req?: PayloadRequest,
): Promise<Order> {
  return withOrderWriteLock(async () => {
    const fresh = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true, ...(req ? { req } : {}) })
    return payload.update({
      collection: 'orders',
      id: orderId,
      overrideAccess: true,
      ...(req ? { req } : {}),
      data: { ...data, fulfilmentLog: [...(fresh.fulfilmentLog ?? []), ...logs] },
    })
  })
}
