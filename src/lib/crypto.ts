import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * AES-256-GCM encryption for integration secrets stored in the database (brief §6).
 * The key lives only in the server environment (CREDENTIALS_ENCRYPTION_KEY, 32 bytes base64),
 * never in the DB. Stored format:  enc:v1:<iv>:<authTag>:<ciphertext>  (base64url parts).
 *
 * Key rotation: set the new key as CREDENTIALS_ENCRYPTION_KEY and the old one as
 * CREDENTIALS_ENCRYPTION_KEY_PREVIOUS, then re-save Store Settings once.
 */
const PREFIX = 'enc:v1:'

export class CredentialCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CredentialCryptoError'
  }
}

function parseKey(raw: string | undefined, name: string): Buffer | null {
  if (!raw?.trim()) return null
  const key = Buffer.from(raw.trim(), 'base64')
  if (key.length !== 32) {
    throw new CredentialCryptoError(`${name} must be 32 bytes, base64-encoded (got ${key.length} bytes).`)
  }
  return key
}

export const encryptionKey = () => parseKey(process.env.CREDENTIALS_ENCRYPTION_KEY, 'CREDENTIALS_ENCRYPTION_KEY')
const previousKey = () => parseKey(process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS, 'CREDENTIALS_ENCRYPTION_KEY_PREVIOUS')

export const isEncrypted = (value: unknown): value is string => typeof value === 'string' && value.startsWith(PREFIX)

export function encryptSecret(plain: string, key = encryptionKey()): string {
  if (!key) throw new CredentialCryptoError('CREDENTIALS_ENCRYPTION_KEY is not set on the server, so secrets cannot be saved.')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`
}

function decryptWith(value: string, key: Buffer): string {
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':')
  if (!ivB64 || !tagB64 || dataB64 === undefined) throw new CredentialCryptoError('Malformed encrypted value.')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8')
}

/** Decrypts with the current key, falling back to the previous key during rotation. */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value // legacy plaintext from before Phase 7; encrypted on next save
  const keys = [encryptionKey(), previousKey()].filter((k): k is Buffer => k !== null)
  if (keys.length === 0) throw new CredentialCryptoError('CREDENTIALS_ENCRYPTION_KEY is not set, so stored secrets cannot be read.')
  for (const key of keys) {
    try {
      return decryptWith(value, key)
    } catch {
      /* try the next key */
    }
  }
  throw new CredentialCryptoError('Stored secret could not be decrypted — the encryption key has changed. Re-enter the secret.')
}

export const MASK = '••••'

/**
 * What the admin sees instead of the secret: the recognisable prefix plus the last 4
 * characters, e.g. `sk_live_••••4821`, `whsec_••••9f2a`, `xkeysib-••••c0de`.
 */
export function maskSecret(plain: string): string {
  const prefix = plain.match(/^((?:sk|pk|rk)_(?:live|test)_|whsec_|xkeysib-)/)?.[1] ?? ''
  const tail = plain.length >= 12 ? plain.slice(-4) : ''
  return `${prefix}${MASK}${tail}`
}

export const isMasked = (value: unknown): boolean => typeof value === 'string' && value.includes(MASK)
