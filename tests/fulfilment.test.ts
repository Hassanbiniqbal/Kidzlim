import { PDFDocument } from 'pdf-lib'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { createBrevoClient } from '@/lib/integrations/brevo'
import { buildGelatoOrder, confirmationParams, FulfilmentError } from '@/lib/fulfilment'
import { inspectPdf, PdfError, stampPdf } from '@/lib/pdf'
import {
  createDownloadToken,
  hashDownloadToken,
  isWellFormedToken,
  signPrintFileUrl,
  verifyPrintFileSignature,
} from '@/lib/signed-url'
import type { Book, Order } from '@/payload-types'

beforeAll(() => {
  process.env.PAYLOAD_SECRET = 'test-secret-test-secret-test-secret-123'
})

const MM = 72 / 25.4

async function makePdf(pages: { w: number; h: number; trim?: number }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const p of pages) {
    const page = doc.addPage([p.w * MM, p.h * MM])
    if (p.trim) page.setTrimBox(p.trim * MM, p.trim * MM, (p.w - 2 * p.trim) * MM, (p.h - 2 * p.trim) * MM)
  }
  return doc.save()
}

describe('inspectPdf', () => {
  it('reports pages, size and bleed', async () => {
    const info = await inspectPdf(await makePdf(Array(24).fill({ w: 222, h: 222, trim: 3 })))
    expect(info).toMatchObject({ pageCount: 24, pageSize: '222 × 222 mm', sameSizeAllPages: true, hasBleed: true, warnings: [] })
  })

  it('warns about missing bleed and mixed sizes', async () => {
    const info = await inspectPdf(await makePdf([{ w: 210, h: 297 }, { w: 148, h: 210 }]))
    expect(info.hasBleed).toBe(false)
    expect(info.sameSizeAllPages).toBe(false)
    expect(info.warnings).toHaveLength(2)
  })

  it('rejects non-PDF bytes', async () => {
    await expect(inspectPdf(new TextEncoder().encode('not a pdf'))).rejects.toBeInstanceOf(PdfError)
  })
})

describe('stampPdf', () => {
  it('stamps every page and keeps the page count', async () => {
    const original = await makePdf([{ w: 210, h: 297 }, { w: 210, h: 297 }])
    const stamped = await stampPdf(original, { email: 'amina@example.com', orderNumber: 'KZ-261013-ABCDE' })
    const doc = await PDFDocument.load(stamped)
    expect(doc.getPageCount()).toBe(2)
    expect(stamped.length).toBeGreaterThan(original.length)
  })

  it('survives non-Latin characters in the email', async () => {
    const stamped = await stampPdf(await makePdf([{ w: 210, h: 297 }]), { email: 'أمينة@example.com', orderNumber: 'KZ-1' })
    expect((await PDFDocument.load(stamped)).getPageCount()).toBe(1)
  })
})

describe('signed print-file URLs', () => {
  it('verifies its own signature and rejects tampering or expiry', () => {
    const now = Date.UTC(2026, 9, 13)
    const url = new URL(signPrintFileUrl('https://kidzlim.com', 7, 3600, now))
    const exp = url.searchParams.get('exp')
    const sig = url.searchParams.get('sig')
    expect(url.pathname).toBe('/api/store/print-files/7')
    expect(verifyPrintFileSignature(7, exp, sig, now)).toBe(true)
    expect(verifyPrintFileSignature(8, exp, sig, now)).toBe(false) // other file
    expect(verifyPrintFileSignature(7, String(Number(exp) + 1), sig, now)).toBe(false) // extended expiry
    expect(verifyPrintFileSignature(7, exp, sig, now + 2 * 3600_000)).toBe(false) // expired
    expect(verifyPrintFileSignature(7, null, sig, now)).toBe(false)
  })
})

describe('download tokens', () => {
  it('are random, URL-safe, and stored only as a hash', () => {
    const a = createDownloadToken()
    const b = createDownloadToken()
    expect(a.token).not.toBe(b.token)
    expect(isWellFormedToken(a.token)).toBe(true)
    expect(a.hash).toBe(hashDownloadToken(a.token))
    expect(a.hash).not.toContain(a.token)
    expect(isWellFormedToken('../../etc/passwd')).toBe(false)
  })
})

const book = {
  id: 5,
  title: 'Stories of the Prophets',
  slug: 'stories-of-the-prophets',
  variants: [
    { sku: 'SP-PB', type: 'paperback', priceAED: 49, gelatoProductUid: 'photobooks-softcover_pf_200x200', pageCount: 32, printFile: 11 },
    { sku: 'SP-PDF', type: 'digital', priceAED: 25, digitalFile: 12 },
  ],
} as unknown as Book

const order = {
  id: 99,
  orderNumber: 'KZ-261013-ABCDE',
  status: 'paid',
  customerEmail: 'amina@example.com',
  customerName: 'Amina R',
  subtotalAED: 123,
  shippingAmount: 22,
  taxAmount: 6.9,
  amountAED: 145,
  createdAt: '2026-10-13T10:00:00.000Z',
  items: [
    { book, variant: 'paperback', sku: 'SP-PB', quantity: 2, unitPrice: 49 },
    { book, variant: 'digital', sku: 'SP-PDF', quantity: 1, unitPrice: 25 },
  ],
  shippingMethod: { name: 'Standard', gelatoMethodUids: ['normal'] },
  shippingAddress: {
    firstName: 'Amina',
    lastName: 'R',
    email: 'amina@example.com',
    phone: '+971500000000',
    addressLine1: 'Villa 12',
    city: 'Dubai',
    country: 'AE',
  },
} as unknown as Order

describe('buildGelatoOrder', () => {
  it('sends only printed items with a signed print-file URL', async () => {
    const req = await buildGelatoOrder(order, [book], 'https://kidzlim.com')
    expect(req).toMatchObject({
      orderType: 'order',
      orderReferenceId: 'KZ-261013-ABCDE',
      currency: 'AED',
      shipmentMethodUid: 'normal',
      shippingAddress: { country: 'AE', phone: '+971500000000' },
    })
    expect(req.items).toHaveLength(1)
    expect(req.items[0]).toMatchObject({ productUid: 'photobooks-softcover_pf_200x200', quantity: 2, pageCount: 32 })
    expect(req.items[0].files[0].url).toMatch(/^https:\/\/kidzlim\.com\/api\/store\/print-files\/11\?exp=\d+&sig=/)
  })

  it('refuses to submit without a print file', async () => {
    const noFile = { ...book, variants: [{ ...book.variants![0], printFile: null }] } as unknown as Book
    await expect(buildGelatoOrder(order, [noFile])).rejects.toBeInstanceOf(FulfilmentError)
  })
})

describe('confirmationParams', () => {
  it('formats money and flags mixed carts', () => {
    const p = confirmationParams(order)
    expect(p).toMatchObject({ firstName: 'Amina', total: expect.stringContaining('145.00'), hasPhysical: true, hasDigital: true })
    expect(p.items[0]).toMatchObject({ title: 'Stories of the Prophets', format: 'Paperback', quantity: 2 })
    expect(p.shippingAddress).toContain('Villa 12')
  })
})

describe('createBrevoClient', () => {
  it('posts a template email with the api-key header', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ messageId: '<abc@smtp-relay>' }, { status: 201 }))
    const client = createBrevoClient({ apiKey: 'xkeysib-test', fetchImpl: fetchImpl as unknown as typeof fetch })
    const res = await client.sendTemplate({ templateId: 3, to: { email: 'a@b.co', name: 'A' }, params: { x: 1 } })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test')
    expect(JSON.parse(init.body as string)).toMatchObject({ templateId: 3, to: [{ email: 'a@b.co' }], params: { x: 1 } })
    expect(res.messageId).toBe('<abc@smtp-relay>')
  })

  it('surfaces errors with status', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ message: 'Template not found' }, { status: 404 }))
    const client = createBrevoClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch })
    await expect(client.sendTemplate({ templateId: 9, to: { email: 'a@b.co' }, params: {} })).rejects.toMatchObject({ status: 404 })
  })
})
