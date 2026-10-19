import Link from 'next/link'
import type { ServerProps } from 'payload'
import React from 'react'

import { credentialStatuses, type CredentialKey } from '@/lib/credentials-core'
import { encryptionKey } from '@/lib/crypto'

const REQUIRED: CredentialKey[] = [
  'stripe.secretKey',
  'stripe.webhookSigningSecret',
  'gelato.apiKey',
  'gelato.webhookSecret',
  'brevo.apiKey',
]

/** Dev-only test doubles make these credentials unnecessary locally. */
export function mockedInDev(key: CredentialKey): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (key === 'gelato.apiKey') return process.env.GELATO_MOCK === '1'
  if (key === 'brevo.apiKey') return process.env.BREVO_MOCK === '1'
  return false
}

/**
 * Admin-wide warning banner (brief §6: "fail loudly with a clear admin-panel warning banner").
 * Shown to admins on every admin page while a required credential is missing or unreadable.
 */
export async function CredentialBanner({ payload, user }: ServerProps) {
  if (!user || !('role' in user) || user.role !== 'admin') return null

  const problems: string[] = []
  try {
    if (!encryptionKey()) problems.push('CREDENTIALS_ENCRYPTION_KEY is not set on the server — API keys can’t be saved in Store Settings.')
  } catch (err) {
    problems.push(err instanceof Error ? err.message : 'CREDENTIALS_ENCRYPTION_KEY is invalid.')
  }

  for (const s of await credentialStatuses(payload)) {
    if (!REQUIRED.includes(s.key) || mockedInDev(s.key)) continue
    if (s.source === 'missing') problems.push(`${s.label} is missing${s.warning ? ` — ${s.warning}` : ''}.`)
    else if (s.warning) problems.push(`${s.label}: ${s.warning} (using the server environment value for now).`)
  }

  if (problems.length === 0) return null

  return (
    <div
      role="alert"
      style={{
        margin: '0 0 0 0',
        padding: '10px 16px',
        background: 'var(--theme-error-100)',
        borderBottom: '1px solid var(--theme-error-300)',
        color: 'var(--theme-error-900)',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <strong>Store setup needs attention — checkout or fulfilment may fail.</strong>
      <ul style={{ margin: '4px 0 4px 18px', padding: 0 }}>
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <Link href="/admin/globals/settings" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
        Open Store Settings →
      </Link>
    </div>
  )
}
