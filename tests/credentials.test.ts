import { randomBytes } from 'crypto'
import type { FieldHook } from 'payload'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { REVEAL_SECRETS, secretField } from '@/fields/secret'
import { CHANGED_SECRETS, diffDocs } from '@/lib/audit'
import { decryptSecret, encryptSecret, isEncrypted, isMasked, maskSecret } from '@/lib/crypto'

const key = () => randomBytes(32).toString('base64')
const SECRET = 'sk_test_51NxYZabcdefghijklmnopqrstuvwxyz4821'

let saved: Record<string, string | undefined>
beforeEach(() => {
  saved = { k: process.env.CREDENTIALS_ENCRYPTION_KEY, p: process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS }
  process.env.CREDENTIALS_ENCRYPTION_KEY = key()
  delete process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS
})
afterEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = saved.k
  process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = saved.p
})

describe('AES-256-GCM secrets', () => {
  it('round-trips and never stores the plaintext', () => {
    const enc = encryptSecret(SECRET)
    expect(isEncrypted(enc)).toBe(true)
    expect(enc).not.toContain('sk_test')
    expect(decryptSecret(enc)).toBe(SECRET)
  })

  it('uses a fresh IV every time', () => {
    expect(encryptSecret(SECRET)).not.toBe(encryptSecret(SECRET))
  })

  it('detects tampering', () => {
    const enc = encryptSecret(SECRET)
    const parts = enc.split(':')
    parts[4] = Buffer.from('tampered').toString('base64url')
    expect(() => decryptSecret(parts.join(':'))).toThrow(/decrypted/)
  })

  it('fails clearly with the wrong key, and supports rotation via the previous key', () => {
    const enc = encryptSecret(SECRET)
    const old = process.env.CREDENTIALS_ENCRYPTION_KEY
    process.env.CREDENTIALS_ENCRYPTION_KEY = key()
    expect(() => decryptSecret(enc)).toThrow(/key has changed/)
    process.env.CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = old
    expect(decryptSecret(enc)).toBe(SECRET)
  })

  it('refuses to encrypt without a key, and rejects a malformed key', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
    expect(() => encryptSecret(SECRET)).toThrow(/not set/)
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'too-short'
    expect(() => encryptSecret(SECRET)).toThrow(/32 bytes/)
  })

  it('passes legacy plaintext through (encrypted on next save)', () => {
    expect(decryptSecret('legacy-plain-value')).toBe('legacy-plain-value')
  })
})

describe('maskSecret', () => {
  it('keeps the recognisable prefix and last 4 characters', () => {
    expect(maskSecret('sk_live_51abcdefghijklmnop4821')).toBe('sk_live_••••4821')
    expect(maskSecret('whsec_abcdefghijkl9f2a')).toBe('whsec_••••9f2a')
    expect(maskSecret('xkeysib-0123456789abcdefc0de')).toBe('xkeysib-••••c0de')
    expect(maskSecret('short')).toBe('••••')
    expect(isMasked('sk_live_••••4821')).toBe(true)
  })
})

describe('secretField hooks', () => {
  const field = secretField({ group: 'stripe', name: 'secretKey', label: 'Secret key' }) as {
    hooks: { beforeChange: FieldHook[]; afterRead: FieldHook[] }
  }
  const before = (args: Record<string, unknown>) => field.hooks.beforeChange[0](args as Parameters<FieldHook>[0])
  const after = (args: Record<string, unknown>) => field.hooks.afterRead[0](args as Parameters<FieldHook>[0])

  it('encrypts a new value and records that it changed (without the value)', async () => {
    const context: Record<string, unknown> = {}
    const stored = await before({ value: SECRET, originalDoc: {}, context })
    expect(isEncrypted(stored)).toBe(true)
    expect(context[CHANGED_SECRETS]).toEqual([{ path: 'stripe.secretKey', cleared: false }])
    expect(JSON.stringify(context)).not.toContain('sk_test_51')
  })

  it('keeps the stored secret when the form sends the mask back', async () => {
    const existing = encryptSecret(SECRET)
    const context: Record<string, unknown> = {}
    expect(await before({ value: 'sk_test_••••4821', originalDoc: { stripe: { secretKey: existing } }, context })).toBe(existing)
    expect(context[CHANGED_SECRETS]).toBeUndefined()
  })

  it('upgrades legacy plaintext to ciphertext on save', async () => {
    const stored = await before({ value: undefined, originalDoc: { stripe: { secretKey: SECRET } }, context: {} })
    expect(isEncrypted(stored)).toBe(true)
    expect(decryptSecret(stored as string)).toBe(SECRET)
  })

  it('clears the secret on an empty value', async () => {
    const context: Record<string, unknown> = {}
    expect(await before({ value: '  ', originalDoc: { stripe: { secretKey: encryptSecret(SECRET) } }, context })).toBeNull()
    expect(context[CHANGED_SECRETS]).toEqual([{ path: 'stripe.secretKey', cleared: true }])
  })

  it('shows clients only the mask; server code can reveal the ciphertext', async () => {
    const enc = encryptSecret(SECRET)
    expect(await after({ value: enc, context: {} })).toBe('sk_test_••••4821')
    expect(await after({ value: enc, context: { [REVEAL_SECRETS]: true } })).toBe(enc)
    expect(await after({ value: null, context: {} })).toBeNull()
  })

  it('never leaks anything when the value cannot be decrypted', async () => {
    const enc = encryptSecret(SECRET)
    process.env.CREDENTIALS_ENCRYPTION_KEY = key()
    const shown = await after({ value: enc, context: {} })
    expect(shown).toMatch(/re-enter/)
    expect(shown).not.toContain('enc:v1')
  })
})

describe('diffDocs (audit)', () => {
  it('reports changed fields with before/after, including nested groups', () => {
    const changes = diffDocs(
      { id: 1, status: 'paid', trackingCode: null, shippingMethod: { name: 'Standard' }, updatedAt: 'a' },
      { id: 1, status: 'shipped', trackingCode: 'AE1', shippingMethod: { name: 'Express' }, updatedAt: 'b' },
    )
    expect(changes).toEqual([
      { field: 'shippingMethod.name', from: 'Standard', to: 'Express' },
      { field: 'status', from: 'paid', to: 'shipped' },
      { field: 'trackingCode', from: null, to: 'AE1' },
    ])
  })

  it('ignores noise and redacts secrets', () => {
    const changes = diffDocs(
      { fulfilmentLog: [1], stripe: { secretKey: 'enc:v1:a', mode: 'test' } },
      { fulfilmentLog: [1, 2], stripe: { secretKey: 'enc:v1:b', mode: 'live' } },
      { ignore: ['fulfilmentLog'], redact: ['stripe.secretKey'] },
    )
    expect(changes).toEqual([{ field: 'stripe.mode', from: 'test', to: 'live' }])
  })

  it('summarises arrays instead of dumping them', () => {
    const [c] = diffDocs({ items: [{ a: 1 }] }, { items: [{ a: 1 }, { a: 2 }] })
    expect(c).toEqual({ field: 'items', from: '[1 item]', to: '[2 items]' })
  })
})

describe('diffDocs normalisation', () => {
  it('treats a populated relationship and its id as the same', () => {
    const book = { id: 7, title: 'X', createdAt: 'c', updatedAt: 'u' }
    expect(diffDocs({ items: [{ id: 'r1', book: 7, quantity: 2 }] }, { items: [{ id: 'r1', book, quantity: 2 }] })).toEqual([])
  })
  it('treats empty values as equal', () => {
    expect(diffDocs({ store: { shippingCountries: null } }, { store: { shippingCountries: [] } })).toEqual([])
  })
  it('still sees a real change inside an array', () => {
    expect(diffDocs({ items: [{ book: 7, quantity: 2 }] }, { items: [{ book: 7, quantity: 3 }] })).toHaveLength(1)
  })
})

describe('secretField regression: originalDoc holds the mask', () => {
  it('keeps the real stored secret (read raw) instead of saving the mask', async () => {
    const { secretField: make } = await import('@/fields/secret')
    const field = make({ group: 'stripe', name: 'secretKey', label: 'k' }) as { hooks: { beforeChange: FieldHook[] } }
    const stored = encryptSecret(SECRET)
    const findGlobal = async (args: { context?: Record<string, unknown> }) =>
      args.context?.[REVEAL_SECRETS] ? { stripe: { secretKey: stored } } : { stripe: { secretKey: 'sk_test_••••4821' } }
    const result = await field.hooks.beforeChange[0]({
      value: 'sk_test_••••4821', // unchanged form
      originalDoc: { stripe: { secretKey: 'sk_test_••••4821' } }, // what Payload actually passes
      context: {},
      req: { payload: { findGlobal } },
    } as unknown as Parameters<FieldHook>[0])
    expect(result).toBe(stored)
    expect(decryptSecret(result as string)).toBe(SECRET)
  })
})
