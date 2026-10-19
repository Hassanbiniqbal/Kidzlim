import { getPayloadClient } from '@/lib/cms'
import { pdfHeaders, readProtectedFile } from '@/lib/protected-file'
import { verifyPrintFileSignature } from '@/lib/signed-url'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Print-ready PDFs for Gelato. Only reachable with a signed, expiring URL created when
 * the print order is submitted (brief §4.6: "a URL Gelato can fetch the print file from").
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fileId = Number(id)
  const url = new URL(req.url)
  if (!Number.isInteger(fileId) || !verifyPrintFileSignature(fileId, url.searchParams.get('exp'), url.searchParams.get('sig'))) {
    return new Response('Link invalid or expired', { status: 403 })
  }

  const payload = await getPayloadClient()
  const file = await payload
    .findByID({ collection: 'protected-files', id: fileId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!file || file.kind !== 'print') return new Response('Not found', { status: 404 })

  const bytes = await readProtectedFile(file)
  return new Response(new Uint8Array(bytes), { headers: pdfHeaders(file.filename ?? `print-${fileId}.pdf`, bytes.length) })
}
