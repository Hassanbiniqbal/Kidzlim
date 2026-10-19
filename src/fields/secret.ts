import { APIError, type Field, type FieldHook, type PayloadRequest, ValidationError } from 'payload'

import { CHANGED_SECRETS } from '../lib/audit'
import { CredentialCryptoError, decryptSecret, encryptionKey, encryptSecret, isEncrypted, isMasked, MASK, maskSecret } from '../lib/crypto'

/**
 * Write-only secret field (brief §6).
 * - Saved values are AES-256-GCM encrypted; plaintext never reaches the database.
 * - Reads return a mask (`sk_live_••••4821`) to every client, including the admin panel and API.
 *   Server code reads the ciphertext with `context: { revealSecrets: true }` (Local API only).
 * - Sending the mask back (an unchanged form) keeps the stored secret; an empty value clears it.
 */
type Options = { group: string; name: string; label: string; description?: string; pattern?: RegExp; patternHint?: string }

export const REVEAL_SECRETS = 'revealSecrets'

export function secretField({ group, name, label, description, pattern, patternHint }: Options): Field {
  const keepOrUpgrade = (previous: unknown) => {
    if (typeof previous !== 'string' || !previous) return null
    if (isMasked(previous)) return null // never store a mask (defensive; raw value is read below)
    // Plaintext left over from before encryption was enabled: encrypt it now if we can.
    if (!isEncrypted(previous) && encryptionKey()) return encryptSecret(previous)
    return previous
  }

  /**
   * `originalDoc` in field hooks has already been through afterRead, i.e. it holds the MASK,
   * not the stored value. Re-read the raw value (same transaction) so "unchanged" keeps the
   * real secret instead of overwriting it with the mask.
   */
  const storedValue = async (originalDoc: unknown, req: PayloadRequest): Promise<unknown> => {
    const seen = (originalDoc as Record<string, Record<string, unknown> | undefined> | undefined)?.[group]?.[name]
    if (!isMasked(seen)) return seen
    const raw = await req.payload.findGlobal({
      slug: 'settings',
      depth: 0,
      overrideAccess: true,
      context: { [REVEAL_SECRETS]: true },
      req,
    })
    return (raw as unknown as Record<string, Record<string, unknown> | undefined>)[group]?.[name]
  }

  const noteChange = (context: Record<string, unknown>, cleared: boolean) => {
    const list = (context[CHANGED_SECRETS] as { path: string; cleared: boolean }[] | undefined) ?? []
    context[CHANGED_SECRETS] = [...list, { path: `${group}.${name}`, cleared }]
  }

  const beforeChange: FieldHook = async ({ value, originalDoc, context, req }) => {
    const previous = await storedValue(originalDoc, req)
    if (value === undefined || value === null || isMasked(value)) return keepOrUpgrade(previous)

    const trimmed = String(value).trim()
    if (trimmed === '') {
      if (previous) noteChange(context, true)
      return null
    }
    // Format check on the plaintext. (Payload's `validate` runs after this hook, so it only ever
    // sees ciphertext — it can't do this.)
    if (pattern && !pattern.test(trimmed)) {
      throw new ValidationError({
        global: 'settings',
        errors: [{ path: `${group}.${name}`, message: patternHint ?? 'This doesn’t look like the right kind of key.' }],
      })
    }
    noteChange(context, false)
    try {
      return encryptSecret(trimmed)
    } catch (err) {
      if (err instanceof CredentialCryptoError) throw new APIError(err.message, 400, undefined, true)
      throw err
    }
  }

  const afterRead: FieldHook = ({ value, context }) => {
    if (context?.[REVEAL_SECRETS]) return value
    if (typeof value !== 'string' || !value) return null
    try {
      return maskSecret(decryptSecret(value))
    } catch {
      return `${MASK} (cannot be read — please re-enter)`
    }
  }

  return {
    name,
    label,
    type: 'text',
    admin: {
      description: `${description ? `${description} ` : ''}Stored encrypted and never shown again — paste a new value to replace it, or clear the field to remove it.`,
      autoComplete: 'off',
      placeholder: 'Not set — paste to add',
    },
    hooks: { beforeChange: [beforeChange], afterRead: [afterRead] },
  }
}
