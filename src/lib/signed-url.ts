import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Short-lived signed URLs for private files (Gelato fetching print PDFs) and
 * download tokens for customers. Keys are derived from PAYLOAD_SECRET so no extra
 * secret has to be managed; each purpose gets its own key.
 */
const derivedKey = (purpose: string) => createHmac('sha256', process.env.PAYLOAD_SECRET ?? '').update(`kidzlim:${purpose}`).digest()

function sign(purpose: string, value: string): string {
  return createHmac('sha256', derivedKey(purpose)).update(value).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/* ── Print files for Gelato ── */

export function signPrintFileUrl(baseUrl: string, fileId: number, ttlSeconds = 14 * 24 * 3600, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds
  const sig = sign('print-file', `${fileId}.${exp}`)
  return `${baseUrl}/api/store/print-files/${fileId}?exp=${exp}&sig=${sig}`
}

export function verifyPrintFileSignature(fileId: number, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp)) return false
  if (Number(exp) * 1000 < now) return false
  return safeEqual(sign('print-file', `${fileId}.${exp}`), sig)
}

/* ── Customer download tokens ── */

/** 256-bit random token for the email link. Only its hash is stored on the order. */
export function createDownloadToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashDownloadToken(token) }
}

export function hashDownloadToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const isWellFormedToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token)
