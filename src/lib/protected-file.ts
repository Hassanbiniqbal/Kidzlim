import 'server-only'

import { promises as fs } from 'fs'
import path from 'path'

import { env } from '@/env'
import type { ProtectedFile } from '@/payload-types'

/** Reads a protected PDF from PROTECTED_MEDIA_DIR. Never trusts the stored filename as a path. */
export async function readProtectedFile(file: Pick<ProtectedFile, 'filename'>): Promise<Buffer> {
  if (!file.filename) throw new Error('File record has no filename')
  const dir = path.resolve(env.PROTECTED_MEDIA_DIR)
  const full = path.join(dir, path.basename(file.filename))
  if (!full.startsWith(dir + path.sep)) throw new Error('Invalid file path')
  return fs.readFile(full)
}

export const pdfHeaders = (filename: string, size: number) => ({
  'Content-Type': 'application/pdf',
  'Content-Length': String(size),
  'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]+/g, '-')}"`,
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
})
