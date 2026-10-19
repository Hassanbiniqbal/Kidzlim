import 'server-only'

import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'

import type { Book, Order } from '@/payload-types'

import { getPayloadClient } from './cms'
import { PAID_STATUSES } from './fulfilment'
import { withOrderWriteLock } from './order-write'
import { hashDownloadToken, isWellFormedToken } from './signed-url'

export type DownloadItem = { sku: string; title: string; slug: string; used: number; remaining: number }

export type DownloadAccess =
  | { ok: true; order: Order; items: DownloadItem[]; maxDownloads: number; expiresAt: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'unavailable' }

/**
 * Brief §5: the only way to a digital file. Validates the token (by hash), order status,
 * expiry and per-file download count.
 */
export async function resolveDownload(token: string): Promise<DownloadAccess> {
  if (!isWellFormedToken(token)) return { ok: false, reason: 'invalid' }
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'orders',
    where: { downloadToken: { equals: hashDownloadToken(token) } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const order = docs[0]
  if (!order) return { ok: false, reason: 'invalid' }
  if (!PAID_STATUSES.includes(order.status)) return { ok: false, reason: 'unavailable' }
  if (!order.downloadExpiresAt || new Date(order.downloadExpiresAt).getTime() < Date.now()) return { ok: false, reason: 'expired' }

  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  const maxDownloads = settings.store?.maxDownloadsPerOrder ?? 5
  const counts = (order.downloadCounts ?? {}) as Record<string, number>

  const items = (order.items ?? [])
    .filter((i) => i.variant === 'digital' && i.sku)
    .map((i) => {
      const book = typeof i.book === 'object' ? (i.book as Book) : null
      const used = Number(counts[i.sku as string] ?? 0)
      return {
        sku: i.sku as string,
        title: book?.title ?? 'Book',
        slug: book?.slug ?? 'book',
        used,
        remaining: Math.max(0, maxDownloads - used),
      }
    })

  return { ok: true, order, items, maxDownloads, expiresAt: order.downloadExpiresAt }
}

/**
 * Atomically consumes one download of `sku`. Returns false if the limit is reached.
 * Counted before streaming: a failed transfer still counts, which keeps the limit honest.
 */
export async function consumeDownload(orderId: number, sku: string, maxDownloads: number): Promise<boolean> {
  return withOrderWriteLock(() => consumeDownloadUnlocked(orderId, sku, maxDownloads))
}

async function consumeDownloadUnlocked(orderId: number, sku: string, maxDownloads: number): Promise<boolean> {
  const payload = await getPayloadClient()
  const req = await createLocalReq({}, payload)
  const owns = await initTransaction(req)
  try {
    const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true, req })
    const counts = { ...((order.downloadCounts ?? {}) as Record<string, number>) }
    const used = Number(counts[sku] ?? 0)
    if (used >= maxDownloads) {
      if (owns) await killTransaction(req)
      return false
    }
    counts[sku] = used + 1
    await payload.update({
      collection: 'orders',
      id: orderId,
      overrideAccess: true,
      req,
      data: {
        downloadCounts: counts,
        downloadCount: (order.downloadCount ?? 0) + 1,
        fulfilmentLog: [
          ...(order.fulfilmentLog ?? []),
          { at: new Date().toISOString(), event: 'download', detail: { sku, count: used + 1 } },
        ],
      },
    })
    if (owns) await commitTransaction(req)
    return true
  } catch (err) {
    if (owns) await killTransaction(req)
    throw err
  }
}
