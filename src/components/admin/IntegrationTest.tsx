'use client'

import { Button, useDocumentInfo } from '@payloadcms/ui'
import React, { useState } from 'react'

type Check = { label: string; ok: boolean; detail?: string; warn?: boolean }
type Result = { ok: boolean; checks: Check[] }

const NAMES = { stripe: 'Stripe', gelato: 'Gelato', brevo: 'Brevo' } as const

/** "Test connection" button for a Store Settings tab (brief §6). */
export function IntegrationTest({ integration }: { integration: keyof typeof NAMES }) {
  const { isDirty } = useDocumentInfo() as { isDirty?: boolean }
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/store/admin/integrations/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Test failed')
      setResult(body as Result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ margin: '8px 0 24px', padding: 16, border: '1px solid var(--theme-elevation-150)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button buttonStyle="secondary" size="small" margin={false} onClick={run} disabled={busy}>
          {busy ? 'Testing…' : `Test ${NAMES[integration]} connection`}
        </Button>
        <small style={{ color: 'var(--theme-elevation-500)' }}>
          {isDirty ? 'Save first — the test uses the saved settings.' : 'Makes one harmless, read-only call with the saved keys.'}
        </small>
      </div>

      {error && <p style={{ margin: '12px 0 0', color: 'var(--theme-error-700)' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: result.ok ? 'var(--theme-success-700)' : 'var(--theme-error-700)' }}>
            {result.ok ? `✓ ${NAMES[integration]} is set up correctly` : `✗ ${NAMES[integration]} needs attention`}
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4, fontSize: 13 }}>
            {result.checks.map((c) => (
              <li key={c.label}>
                <span style={{ color: !c.ok ? 'var(--theme-error-700)' : c.warn ? 'var(--theme-warning-700)' : 'var(--theme-success-700)' }}>
                  {!c.ok ? '✗' : c.warn ? '!' : '✓'}
                </span>{' '}
                <strong>{c.label}</strong>
                {c.detail ? <span style={{ color: 'var(--theme-elevation-600)' }}> — {c.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
