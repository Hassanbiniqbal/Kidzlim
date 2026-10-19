import type { Payload } from 'payload'

import type { Book, Order } from '../payload-types'
import { addressSchema } from './cart/schema'
import { resolveCredential } from './credentials-core'
import { getMailer } from './email'
import { formatAED, VARIANT_LABELS } from './format'
import { decideStatus, extractTracking, isStaleGelatoStatus } from './gelato-status'
import {
  createGelatoClient,
  createMockGelatoClient,
  type GelatoClient,
  type GelatoCreateOrderRequest,
  type GelatoOrder,
} from './integrations/gelato'
import { appendToOrder } from './order-write'
import { toGelatoAddress } from './shipping-options'
import { createDownloadToken, signPrintFileUrl } from './signed-url'

/**
 * Brief §4.6 fulfilment steps. Each runs as a background job with retries and is
 * idempotent: it checks the order before acting, so a retry never double-sends.
 * CLI-safe (no `server-only`): loaded by payload.config via the job tasks.
 */

export class FulfilmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FulfilmentError'
  }
}

export type StepResult = 'done' | `skipped: ${string}`

type LogEntry = NonNullable<Order['fulfilmentLog']>[number]
const entry = (event: string, detail: Record<string, unknown> = {}): LogEntry => ({ at: new Date().toISOString(), event, detail })

/** Statuses in which the customer has paid and nothing was refunded/cancelled. */
export const PAID_STATUSES: Order['status'][] = ['paid', 'submitted_to_gelato', 'in_production', 'shipped', 'delivered']
const isPaid = (o: Order) => PAID_STATUSES.includes(o.status)

const baseUrl = () => process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const firstName = (o: Order) => (o.customerName ?? '').split(' ')[0] || 'there'
const bookOf = (item: NonNullable<Order['items']>[number]) => (typeof item.book === 'object' ? item.book : null)

async function loadOrder(payload: Payload, orderId: number): Promise<Order> {
  return payload.findByID({ collection: 'orders', id: orderId, depth: 1, overrideAccess: true })
}

async function updateOrder(payload: Payload, order: Order, data: Partial<Order>, logs: LogEntry[]): Promise<Order> {
  // Serialised with every other order write; the log is re-read under the lock (see order-write.ts).
  return appendToOrder(payload, order.id, data, logs)
}

/* ───────────── 1. Order confirmation email ───────────── */

export function confirmationParams(order: Order) {
  const address = addressSchema.safeParse(order.shippingAddress)
  const items = (order.items ?? []).map((i) => ({
    title: bookOf(i)?.title ?? 'Book',
    format: VARIANT_LABELS[i.variant],
    quantity: i.quantity,
    lineTotal: formatAED(i.unitPrice * i.quantity),
  }))
  return {
    firstName: firstName(order),
    orderNumber: order.orderNumber,
    orderDate: new Date(order.paidAt ?? order.createdAt).toLocaleDateString('en-GB', { dateStyle: 'long' }),
    items,
    subtotal: formatAED(order.subtotalAED ?? 0),
    shipping: formatAED(order.shippingAmount ?? 0),
    vat: formatAED(order.taxAmount ?? 0),
    total: formatAED(order.amountAED ?? 0),
    hasPhysical: (order.items ?? []).some((i) => i.variant !== 'digital'),
    hasDigital: (order.items ?? []).some((i) => i.variant === 'digital'),
    shippingMethod: order.shippingMethod?.name ?? '',
    shippingAddress: address.success
      ? [
          `${address.data.firstName} ${address.data.lastName}`,
          address.data.addressLine1,
          address.data.addressLine2,
          [address.data.city, address.data.state, address.data.postCode].filter(Boolean).join(', '),
          address.data.country,
        ]
          .filter(Boolean)
          .join('\n')
      : '',
    shopUrl: `${baseUrl()}/books`,
  }
}

export async function sendOrderConfirmation(payload: Payload, orderId: number, opts: { force?: boolean } = {}): Promise<StepResult> {
  const order = await loadOrder(payload, orderId)
  if (order.confirmationSentAt && !opts.force) return 'skipped: already sent'
  if (!isPaid(order)) return `skipped: order is ${order.status}`

  const mailer = await getMailer(payload)
  const { messageId } = await mailer.send(
    'orderConfirmation',
    { email: order.customerEmail, name: order.customerName ?? undefined },
    confirmationParams(order),
  )
  await updateOrder(payload, order, { confirmationSentAt: new Date().toISOString() }, [
    entry(opts.force ? 'email.confirmation.resent' : 'email.confirmation.sent', { messageId }),
  ])
  return 'done'
}

/* ───────────── 2. Digital delivery ───────────── */

export async function deliverDigital(payload: Payload, orderId: number, opts: { resend?: boolean } = {}): Promise<StepResult> {
  const order = await loadOrder(payload, orderId)
  const digital = (order.items ?? []).filter((i) => i.variant === 'digital')
  if (digital.length === 0) return 'skipped: no digital items'
  if (!opts.resend && order.digitalDeliveredAt) return 'skipped: already delivered'
  if (!isPaid(order)) return `skipped: order is ${order.status}`

  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  const expiryHours = settings.store?.downloadExpiryHours ?? 48
  const maxDownloads = settings.store?.maxDownloadsPerOrder ?? 5

  // A fresh token each send; the previous link stops working. Only the hash is stored.
  const { token, hash } = createDownloadToken()
  const expiresAt = new Date(Date.now() + expiryHours * 3600_000)
  await updateOrder(payload, order, { downloadToken: hash, downloadExpiresAt: expiresAt.toISOString() }, [
    entry(opts.resend ? 'download.link.reissued' : 'download.link.created', { expiresAt: expiresAt.toISOString() }),
  ])

  const mailer = await getMailer(payload)
  const { messageId } = await mailer.send(
    opts.resend ? 'downloadResend' : 'digitalDelivery',
    { email: order.customerEmail, name: order.customerName ?? undefined },
    {
      firstName: firstName(order),
      orderNumber: order.orderNumber,
      downloadUrl: `${baseUrl()}/download/${token}`,
      expiresAt: expiresAt.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Dubai' }) + ' (UAE time)',
      expiryHours,
      maxDownloads,
      items: digital.map((i) => ({ title: bookOf(i)?.title ?? 'Book' })),
    },
  )

  const digitalOnly = (order.items ?? []).every((i) => i.variant === 'digital')
  await updateOrder(
    payload,
    order,
    {
      ...(order.digitalDeliveredAt ? {} : { digitalDeliveredAt: new Date().toISOString() }),
      // Digital-only orders are complete once the link is sent; mixed orders follow the print status.
      ...(digitalOnly && order.status === 'paid' ? { status: 'delivered' as const } : {}),
    },
    [entry(opts.resend ? 'email.download.resent' : 'email.download.sent', { messageId })],
  )
  return 'done'
}

/* ───────────── 3. Gelato print order ───────────── */

export async function gelatoClient(payload: Payload): Promise<GelatoClient> {
  if (process.env.NODE_ENV !== 'production' && process.env.GELATO_MOCK === '1') return createMockGelatoClient()
  return createGelatoClient({ apiKey: await resolveCredential(payload, 'gelato.apiKey') })
}

export async function buildGelatoOrder(order: Order, books: Book[], url = baseUrl()): Promise<GelatoCreateOrderRequest> {
  const address = addressSchema.safeParse(order.shippingAddress)
  if (!address.success) throw new FulfilmentError('Order has no valid shipping address.')

  const items = (order.items ?? [])
    .filter((i) => i.variant !== 'digital')
    .map((i) => {
      const bookId = typeof i.book === 'object' ? i.book.id : i.book
      const variant = books.find((b) => b.id === bookId)?.variants?.find((v) => v.sku === i.sku)
      if (!variant?.gelatoProductUid) throw new FulfilmentError(`SKU ${i.sku} has no Gelato product UID.`)
      const fileId = typeof variant.printFile === 'object' ? variant.printFile?.id : variant.printFile
      if (!fileId) throw new FulfilmentError(`SKU ${i.sku} has no print file. Upload one under Shop → Book PDFs.`)
      return {
        itemReferenceId: i.sku ?? `${bookId}`,
        productUid: variant.gelatoProductUid,
        quantity: i.quantity,
        ...(variant.pageCount ? { pageCount: variant.pageCount } : {}),
        files: [{ type: 'default', url: signPrintFileUrl(url, fileId) }],
      }
    })

  const methodUids = Array.isArray(order.shippingMethod?.gelatoMethodUids)
    ? (order.shippingMethod.gelatoMethodUids as unknown[]).filter((u): u is string => typeof u === 'string')
    : []

  return {
    orderType: 'order',
    orderReferenceId: order.orderNumber,
    customerReferenceId: `order-${order.id}`,
    currency: 'AED',
    items,
    // Single-facility quotes carry exactly one method; for split quotes Gelato routes per facility.
    ...(methodUids.length === 1 ? { shipmentMethodUid: methodUids[0] } : {}),
    shippingAddress: toGelatoAddress(address.data),
  }
}

export async function submitGelatoOrder(payload: Payload, orderId: number): Promise<StepResult> {
  const order = await loadOrder(payload, orderId)
  if (order.gelatoOrderId) return 'skipped: already submitted'
  if (!(order.items ?? []).some((i) => i.variant !== 'digital')) return 'skipped: no printed items'
  if (!isPaid(order)) return `skipped: order is ${order.status}`

  const bookIds = [...new Set((order.items ?? []).map((i) => (typeof i.book === 'object' ? i.book.id : i.book)))]
  const { docs: books } = await payload.find({
    collection: 'books',
    where: { id: { in: bookIds } },
    limit: bookIds.length,
    depth: 0,
    overrideAccess: true,
  })

  const request = await buildGelatoOrder(order, books)
  const client = await gelatoClient(payload)
  const res = await client.createOrder(request, { idempotencyKey: `gelato-order-${order.orderNumber}` })

  await updateOrder(
    payload,
    order,
    {
      gelatoOrderId: res.id,
      gelatoStatus: res.fulfillmentStatus ?? 'created',
      gelatoSubmittedAt: new Date().toISOString(),
      ...(order.status === 'paid' ? { status: 'submitted_to_gelato' as const } : {}),
    },
    [entry('gelato.order.created', { gelatoOrderId: res.id, items: request.items.length })],
  )
  return 'done'
}

/* ───────────── 4. Gelato status sync (Phase 6) ───────────── */

/**
 * Re-reads the order from Gelato (authoritative) and applies status + tracking. If the API
 * isn't reachable, falls back to the authenticated webhook body passed as `hint`.
 * Queues the shipping email the first time the order is shipped.
 */
export async function syncGelatoOrder(payload: Payload, orderId: number, hint?: GelatoOrder | null): Promise<StepResult> {
  const order = await loadOrder(payload, orderId)
  if (!order.gelatoOrderId) return 'skipped: not submitted to Gelato'

  let source: 'api' | 'webhook' = 'api'
  let remote: GelatoOrder | null = null
  try {
    remote = await (await gelatoClient(payload)).getOrder(order.gelatoOrderId)
  } catch (err) {
    if (!hint) throw err // nothing to fall back on — let the job retry
    remote = hint
    source = 'webhook'
  }

  const decision = decideStatus(remote.fulfillmentStatus, order.status)
  const tracking = extractTracking(remote)
  // Out-of-order webhooks must not overwrite a newer status (ours or the displayed Gelato one).
  const stale = isStaleGelatoStatus(remote.fulfillmentStatus, order.status)
  const data: Partial<Order> = { gelatoStatus: stale ? order.gelatoStatus : (remote.fulfillmentStatus ?? order.gelatoStatus) }
  if (decision.status) data.status = decision.status
  if (tracking.trackingCode && tracking.trackingCode !== order.trackingCode) data.trackingCode = tracking.trackingCode
  if (tracking.trackingUrl && tracking.trackingUrl !== order.trackingUrl) data.trackingUrl = tracking.trackingUrl
  if (decision.attention) {
    data.needsAttention = true
    data.attentionReason = decision.attention
  }

  const changed =
    data.status !== undefined ||
    data.trackingCode !== undefined ||
    data.trackingUrl !== undefined ||
    data.needsAttention !== undefined ||
    data.gelatoStatus !== order.gelatoStatus
  if (!changed) return 'skipped: no change'

  await updateOrder(payload, order, data, [
    entry('gelato.status', {
      source,
      gelatoStatus: remote.fulfillmentStatus ?? null,
      ...(stale ? { stale: true } : {}),
      from: order.status,
      to: data.status ?? order.status,
      ...(data.trackingCode ? { trackingCode: data.trackingCode } : {}),
      ...(decision.attention ? { attention: decision.attention } : {}),
    }),
  ])

  const nowShipped = (data.status ?? order.status) === 'shipped' || (data.status ?? order.status) === 'delivered'
  if (nowShipped && !order.shippingNotifiedAt) {
    await payload.jobs.queue({ task: 'sendShippingNotification', input: { orderId }, queue: 'fulfilment' })
  }
  return 'done'
}

/* ───────────── 5. Shipping notification email (Phase 6) ───────────── */

export async function sendShippingNotification(payload: Payload, orderId: number): Promise<StepResult> {
  const order = await loadOrder(payload, orderId)
  if (order.shippingNotifiedAt) return 'skipped: already sent'
  if (order.status !== 'shipped' && order.status !== 'delivered') return `skipped: order is ${order.status}`

  const mailer = await getMailer(payload)
  const { messageId } = await mailer.send(
    'shippingNotification',
    { email: order.customerEmail, name: order.customerName ?? undefined },
    {
      firstName: firstName(order),
      orderNumber: order.orderNumber,
      trackingUrl: order.trackingUrl ?? '',
      trackingCode: order.trackingCode ?? '',
      shippingMethod: order.shippingMethod?.name ?? '',
      items: (order.items ?? [])
        .filter((i) => i.variant !== 'digital')
        .map((i) => ({ title: bookOf(i)?.title ?? 'Book', format: VARIANT_LABELS[i.variant], quantity: i.quantity })),
    },
  )
  await updateOrder(payload, order, { shippingNotifiedAt: new Date().toISOString() }, [
    entry('email.shipping.sent', { messageId, trackingCode: order.trackingCode ?? null }),
  ])
  return 'done'
}

/* ───────────── Admin actions (Phase 6) ───────────── */

/** Cancels the Gelato print order. Gelato only allows this before production starts (brief §7). */
export async function cancelGelatoOrder(payload: Payload, orderId: number, by: string): Promise<Order> {
  const order = await loadOrder(payload, orderId)
  if (!order.gelatoOrderId) throw new FulfilmentError('This order has no Gelato print order.')
  if (!canCancelPrint(order)) throw new FulfilmentError(`Too late to cancel: the order is ${order.status.replace(/_/g, ' ')}.`)
  await (await gelatoClient(payload)).cancelOrder(order.gelatoOrderId)
  return updateOrder(payload, order, { status: 'cancelled', gelatoStatus: 'canceled' }, [
    entry('gelato.order.cancelled', { by, note: 'Payment NOT refunded automatically — use “Refund payment”.' }),
  ])
}

/** Print orders can be cancelled until Gelato starts producing them. */
export const canCancelPrint = (o: Pick<Order, 'gelatoOrderId' | 'status' | 'gelatoStatus'>) =>
  Boolean(o.gelatoOrderId) &&
  o.status === 'submitted_to_gelato' &&
  !['in_production', 'printed', 'shipped', 'delivered', 'canceled'].includes((o.gelatoStatus ?? '').toLowerCase())

/** Records a failed attempt on the order so staff can see it without reading server logs. */
export async function logFulfilmentFailure(payload: Payload, orderId: number, step: string, err: unknown) {
  try {
    const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })
    await updateOrder(payload, order, {}, [entry(`${step}.failed`, { message: err instanceof Error ? err.message : String(err) })])
  } catch {
    /* never let logging mask the original error */
  }
}
