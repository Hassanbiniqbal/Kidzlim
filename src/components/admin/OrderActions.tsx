'use client'

import { Button, useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useState } from 'react'

import { actionState, type ActionOrder, type OrderAction } from '@/lib/order-actions'
import type { User } from '@/payload-types'

type ButtonDef = {
  action: OrderAction
  label: string
  style: 'primary' | 'secondary' | 'error'
  confirm?: string
}

const BUTTONS: ButtonDef[] = [
  { action: 'sync-gelato', label: 'Sync from Gelato', style: 'secondary' },
  { action: 'retry-gelato', label: 'Send to Gelato again', style: 'secondary', confirm: 'Submit this order to Gelato for printing?' },
  { action: 'resend-confirmation', label: 'Resend confirmation email', style: 'secondary' },
  { action: 'resend-download', label: 'Resend download link', style: 'secondary', confirm: 'Send a new download link? The old link will stop working.' },
  {
    action: 'cancel-gelato',
    label: 'Cancel print order',
    style: 'error',
    confirm: 'Cancel this print order at Gelato? This cannot be undone. The payment is NOT refunded automatically.',
  },
  { action: 'refund', label: 'Refund payment…', style: 'error' },
  { action: 'clear-attention', label: 'Clear “needs attention”', style: 'secondary' },
]

/** Sidebar panel on the order edit screen (brief §7: cancel + refund as separate explicit actions). */
export function OrderActions() {
  const { id } = useDocumentInfo()
  const { user } = useAuth<User>()
  const order = useFormFields(([fields]) => ({
    status: fields.status?.value,
    gelatoOrderId: fields.gelatoOrderId?.value,
    gelatoStatus: fields.gelatoStatus?.value,
    stripePaymentIntentId: fields.stripePaymentIntentId?.value,
    amountAED: fields.amountAED?.value,
    refundedAmountAED: fields.refundedAmountAED?.value,
    needsAttention: fields.needsAttention?.value,
    items: fields.items?.rows
      ? fields.items.rows.map((_, i) => ({ variant: fields[`items.${i}.variant`]?.value }))
      : [],
  })) as unknown as ActionOrder

  const [busy, setBusy] = useState<OrderAction | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  if (!id) return null
  const role = user?.role ?? null
  const refundable = Math.max(0, (order.amountAED ?? 0) - (order.refundedAmountAED ?? 0))

  async function run(def: ButtonDef) {
    let amountAED: number | undefined
    if (def.action === 'refund') {
      const input = window.prompt(
        `Refund amount in AED (max ${refundable.toFixed(2)}). Leave as is for a full refund.\n\nThis sends money back to the customer’s card and cannot be undone.`,
        refundable.toFixed(2),
      )
      if (input === null) return
      amountAED = Number(input)
      if (!(amountAED > 0) || amountAED > refundable + 0.001) {
        setMessage({ kind: 'error', text: `Enter an amount between 0.01 and ${refundable.toFixed(2)}.` })
        return
      }
    } else if (def.confirm && !window.confirm(def.confirm)) return

    setBusy(def.action)
    setMessage(null)
    try {
      const res = await fetch(`/api/store/admin/orders/${id}/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: def.action, ...(amountAED ? { amountAED } : {}) }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Action failed')
      setMessage({ kind: 'ok', text: body.message })
      setTimeout(() => window.location.reload(), def.action.startsWith('resend') || def.action.endsWith('gelato') ? 2500 : 1200)
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Action failed' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--theme-elevation-150)' }}>
      <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Order actions</p>
      <div style={{ display: 'grid', gap: 8 }}>
        {BUTTONS.map((def) => {
          const state = actionState(def.action, order, role)
          if (!state.allowed && def.action === 'clear-attention') return null
          return (
            <div key={def.action}>
              <Button
                buttonStyle={def.style}
                size="small"
                margin={false}
                disabled={!state.allowed || busy !== null}
                onClick={() => run(def)}
                tooltip={state.allowed ? undefined : state.reason}
              >
                {busy === def.action ? 'Working…' : def.label}
              </Button>
              {!state.allowed && state.reason && (
                <small style={{ display: 'block', marginTop: 2, color: 'var(--theme-elevation-500)' }}>{state.reason}</small>
              )}
            </div>
          )
        })}
      </div>
      {message && (
        <p
          role="status"
          style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 6,
            fontSize: 13,
            background: message.kind === 'ok' ? 'var(--theme-success-100)' : 'var(--theme-error-100)',
            color: message.kind === 'ok' ? 'var(--theme-success-800)' : 'var(--theme-error-800)',
          }}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
