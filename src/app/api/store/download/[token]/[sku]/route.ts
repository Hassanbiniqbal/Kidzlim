import { getPayloadClient } from '@/lib/cms'
import { consumeDownload, resolveDownload } from '@/lib/downloads'
import { stampPdf } from '@/lib/pdf'
import { pdfHeaders, readProtectedFile } from '@/lib/protected-file'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const redirectTo = (req: Request, token: string, error: string) =>
  Response.redirect(new URL(`/download/${token}?error=${error}`, req.url), 303)

/** Streams a digital book, stamped with the buyer's email (brief §5). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; sku: string }> }) {
  const { token, sku } = await params
  const limit = rateLimit(`download:${clientIp(req)}`, 30, 60_000)
  if (!limit.ok) return new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } })

  const access = await resolveDownload(token)
  if (!access.ok) return redirectTo(req, token, access.reason)

  const item = access.items.find((i) => i.sku === sku)
  if (!item) return new Response('Not found', { status: 404 })

  const payload = await getPayloadClient()
  const orderItem = access.order.items?.find((i) => i.sku === sku)
  const bookId = orderItem && (typeof orderItem.book === 'object' ? orderItem.book.id : orderItem.book)
  const book = bookId
    ? await payload.findByID({ collection: 'books', id: bookId, depth: 1, overrideAccess: true }).catch(() => null)
    : null
  const variant = book?.variants?.find((v) => v.sku === sku)
  const file = variant && typeof variant.digitalFile === 'object' ? variant.digitalFile : null
  if (!file) {
    console.error(`[download] ${sku} on order ${access.order.orderNumber} has no digital file`)
    return redirectTo(req, token, 'missing')
  }

  if (!(await consumeDownload(access.order.id, sku, access.maxDownloads))) return redirectTo(req, token, 'limit')

  const original = await readProtectedFile(file)
  const stamped = await stampPdf(original, { email: access.order.customerEmail, orderNumber: access.order.orderNumber })
  return new Response(new Uint8Array(stamped), { headers: pdfHeaders(`${item.slug}.pdf`, stamped.length) })
}
