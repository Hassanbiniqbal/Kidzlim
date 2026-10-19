'use client'

import React, { useState } from 'react'

export function ResendDownloadForm() {
  const [email, setEmail] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'done' | 'error'; message?: string }>({ kind: 'idle' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/store/downloads/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orderNumber }),
      })
      const body = await res.json()
      setState(res.ok ? { kind: 'done', message: body.message } : { kind: 'error', message: body.error })
    } catch {
      setState({ kind: 'error', message: 'Connection problem. Please try again.' })
    }
  }

  if (state.kind === 'done') {
    return (
      <p className="k-resend__done" role="status">
        {state.message}
      </p>
    )
  }

  return (
    <form className="k-fields k-resend" onSubmit={submit}>
      <label htmlFor="r-email" className="k-field k-field--full">
        <span>Email used at checkout</span>
        <input
          id="r-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label htmlFor="r-order" className="k-field k-field--full">
        <span>Order number</span>
        <input
          id="r-order"
          required
          placeholder="KZ-261013-ABCDE"
          autoCapitalize="characters"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
        />
        <small className="k-field__hint">It’s in your order confirmation email.</small>
      </label>
      {state.kind === 'error' && (
        <p className="k-form-error k-field--full" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className="k-btn k-btn--lime k-field--full" disabled={state.kind === 'sending'}>
        <span>{state.kind === 'sending' ? 'Sending…' : 'Send me a new link'}</span>
      </button>
    </form>
  )
}
