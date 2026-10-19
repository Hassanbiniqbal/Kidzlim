import path from 'path'
import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { isAdmin, isAdminOrStaff } from '../access/roles'
import { env } from '../env'
import { inspectPdf, PdfError } from '../lib/pdf'

/** Reads the uploaded PDF and records page count / size / bleed; rejects invalid files. */
const inspectUpload: CollectionBeforeChangeHook = async ({ data, req }) => {
  const file = req.file
  if (!file?.data) return data
  try {
    const info = await inspectPdf(file.data)
    const isPrint = data.kind === 'print'
    if (isPrint && !info.sameSizeAllPages) {
      throw new APIError('Print files must have the same page size on every page.', 400, undefined, true)
    }
    // Bleed only matters for printing.
    const warnings = isPrint ? info.warnings : info.warnings.filter((w) => !w.startsWith('No bleed'))
    return {
      ...data,
      pageCount: info.pageCount,
      pageSize: info.pageSize,
      hasBleed: info.hasBleed,
      checks: warnings.length ? warnings.join('\n') : 'OK',
    }
  } catch (err) {
    if (err instanceof PdfError) throw new APIError(err.message, 400, undefined, true)
    throw err
  }
}

/**
 * Paid PDFs (print-ready interiors and digital editions). Stored OUTSIDE the web root
 * (PROTECTED_MEDIA_DIR) and only readable by admin/staff. Customers get files through the
 * token-checked download route; Gelato through short-lived signed URLs (brief §5).
 */
export const ProtectedFiles: CollectionConfig = {
  slug: 'protected-files',
  labels: { singular: 'Book PDF', plural: 'Book PDFs' },
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'kind', 'pageCount', 'pageSize', 'checks', 'updatedAt'],
    group: 'Shop',
    description: 'Private files. Never linked publicly — customers receive them through secure download links.',
  },
  access: {
    read: isAdminOrStaff,
    create: isAdminOrStaff,
    update: isAdminOrStaff,
    delete: isAdmin,
  },
  hooks: { beforeChange: [inspectUpload] },
  upload: {
    staticDir: path.resolve(env.PROTECTED_MEDIA_DIR),
    mimeTypes: ['application/pdf'],
    // Never cache private files in shared caches.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'private, no-store')
      return headers
    },
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'digital',
      options: [
        { label: 'Digital edition (sent to buyers)', value: 'digital' },
        { label: 'Print-ready file (sent to Gelato)', value: 'print' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'pageCount', type: 'number', admin: { readOnly: true, width: '33%' } },
        { name: 'pageSize', type: 'text', admin: { readOnly: true, width: '33%' } },
        { name: 'hasBleed', type: 'checkbox', admin: { readOnly: true, width: '33%' } },
      ],
    },
    {
      name: 'checks',
      label: 'File checks',
      type: 'textarea',
      admin: { readOnly: true, description: 'Filled automatically when a PDF is uploaded.' },
    },
  ],
}
