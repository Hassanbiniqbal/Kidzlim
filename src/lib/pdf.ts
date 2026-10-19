import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const PT_TO_MM = 25.4 / 72

export type PdfInspection = {
  pageCount: number
  /** e.g. "216 × 216 mm" — first page media box. */
  pageSize: string
  sameSizeAllPages: boolean
  /** True when pages declare a TrimBox/BleedBox smaller than the MediaBox (i.e. bleed is present). */
  hasBleed: boolean
  warnings: string[]
}

export class PdfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfError'
  }
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/encrypt/i.test(msg)) throw new PdfError('This PDF is password-protected. Upload an unencrypted file.')
    throw new PdfError('This file is not a valid PDF.')
  }
}

/** Reads page count, size and bleed so bad print files are caught at upload, not after payment (brief §7). */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  const doc = await load(bytes)
  const pages = doc.getPages()
  if (pages.length === 0) throw new PdfError('This PDF has no pages.')

  const sizes = pages.map((p) => p.getMediaBox())
  const first = sizes[0]
  const sameSizeAllPages = sizes.every((s) => Math.abs(s.width - first.width) < 1 && Math.abs(s.height - first.height) < 1)

  const hasBleed = pages.every((p) => {
    const media = p.getMediaBox()
    const trim = p.getTrimBox()
    return trim.width < media.width - 1 && trim.height < media.height - 1
  })

  const mm = (pt: number) => Math.round(pt * PT_TO_MM)
  const warnings: string[] = []
  if (!sameSizeAllPages) warnings.push('Pages have different sizes.')
  if (!hasBleed) warnings.push('No bleed detected (TrimBox equals page size). Gelato normally needs 3–4 mm bleed on every edge.')

  return {
    pageCount: pages.length,
    pageSize: `${mm(first.width)} × ${mm(first.height)} mm`,
    sameSizeAllPages,
    hasBleed,
    warnings,
  }
}

/** WinAnsi (the standard fonts' encoding) can't draw every character; keep the stamp printable. */
const printable = (s: string) => s.normalize('NFKD').replace(/[^\x20-\x7E]/g, '?')

/**
 * Stamps every page footer with the buyer's email and order number (brief §5) —
 * a light, cheap piracy deterrent.
 */
export async function stampPdf(bytes: Uint8Array, opts: { email: string; orderNumber: string }): Promise<Uint8Array> {
  const doc = await load(bytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const text = printable(`Licensed to ${opts.email} - Order ${opts.orderNumber} - Personal use only, please don't share.`)
  const size = 7

  for (const page of doc.getPages()) {
    const { x, y, width } = page.getTrimBox()
    const textWidth = font.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: x + Math.max(8, (width - textWidth) / 2),
      y: y + 8,
      size,
      font,
      color: rgb(0.45, 0.45, 0.45),
      opacity: 0.85,
    })
  }
  doc.setProducer('Kidzlim')
  return doc.save()
}
