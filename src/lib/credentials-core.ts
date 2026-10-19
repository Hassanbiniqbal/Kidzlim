import type { Payload } from 'payload'

import { REVEAL_SECRETS } from '../fields/secret'
import { CredentialCryptoError, decryptSecret } from './crypto'

/**
 * Credential resolution shared by web routes and background jobs (brief §6).
 * Order: Settings global (admin panel) → environment variable → loud failure.
 * Stored values are AES-256-GCM encrypted (lib/crypto.ts); they are decrypted here, in one place.
 *
 * No `server-only` import: this module is reachable from payload.config (job tasks),
 * which the Payload CLI also loads.
 */
export const CREDENTIAL_SOURCES = {
  'stripe.publishableKey': { group: 'stripe', field: 'publishableKey', env: 'STRIPE_PUBLISHABLE_KEY', label: 'Stripe publishable key' },
  'stripe.secretKey': { group: 'stripe', field: 'secretKey', env: 'STRIPE_SECRET_KEY', label: 'Stripe secret key' },
  'stripe.webhookSigningSecret': { group: 'stripe', field: 'webhookSigningSecret', env: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook signing secret' },
  'gelato.apiKey': { group: 'gelato', field: 'apiKey', env: 'GELATO_API_KEY', label: 'Gelato API key' },
  'gelato.webhookSecret': { group: 'gelato', field: 'webhookSecret', env: 'GELATO_WEBHOOK_SECRET', label: 'Gelato webhook secret' },
  'brevo.apiKey': { group: 'brevo', field: 'apiKey', env: 'BREVO_API_KEY', label: 'Brevo API key' },
} as const

export type CredentialKey = keyof typeof CREDENTIAL_SOURCES

export class MissingCredentialError extends Error {
  constructor(
    public readonly key: CredentialKey,
    detail?: string,
  ) {
    const s = CREDENTIAL_SOURCES[key]
    super(
      detail
        ? `${s.label}: ${detail}`
        : `${s.label} is not configured. Set it in Admin → Store Settings → ${s.group}, or the ${s.env} environment variable.`,
    )
    this.name = 'MissingCredentialError'
  }
}

/** Raw (still encrypted) Settings values — the secret fields' afterRead mask is skipped. */
async function readRawSettings(payload: Payload) {
  return payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, context: { [REVEAL_SECRETS]: true } })
}

type Resolution =
  | { source: 'settings' | 'env'; value: string; warning?: string }
  | { source: 'missing'; value: null; warning?: string }

function resolveFrom(settings: Awaited<ReturnType<typeof readRawSettings>>, key: CredentialKey): Resolution {
  const { group, field, env } = CREDENTIAL_SOURCES[key]
  const stored = (settings[group] as Record<string, unknown> | undefined)?.[field]
  let warning: string | undefined

  if (typeof stored === 'string' && stored.trim()) {
    try {
      const plain = decryptSecret(stored).trim()
      if (plain) return { source: 'settings', value: plain }
    } catch (err) {
      // Stored but unreadable (key missing/changed): fall back to env, and say so loudly.
      warning = err instanceof CredentialCryptoError ? err.message : 'Stored value could not be read.'
    }
  }

  const fromEnv = process.env[env]?.trim()
  if (fromEnv) return { source: 'env', value: fromEnv, warning }
  return { source: 'missing', value: null, warning }
}

export async function resolveCredential(payload: Payload, key: CredentialKey): Promise<string> {
  const resolved = resolveFrom(await readRawSettings(payload), key)
  if (resolved.source !== 'missing') return resolved.value
  throw new MissingCredentialError(key, resolved.warning)
}

export type CredentialStatus = {
  key: CredentialKey
  label: string
  group: string
  source: 'settings' | 'env' | 'missing'
  warning?: string
}

/** Where each credential currently comes from — for the admin warning banner and Settings screen. */
export async function credentialStatuses(payload: Payload): Promise<CredentialStatus[]> {
  const settings = await readRawSettings(payload)
  return (Object.keys(CREDENTIAL_SOURCES) as CredentialKey[]).map((key) => {
    const r = resolveFrom(settings, key)
    const { label, group } = CREDENTIAL_SOURCES[key]
    return { key, label, group, source: r.source, ...(r.warning ? { warning: r.warning } : {}) }
  })
}
