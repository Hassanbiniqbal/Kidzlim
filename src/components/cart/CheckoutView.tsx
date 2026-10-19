'use client'

import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'

import { Icon } from '@/components/Icon'
import { addressSchema, type Address } from '@/lib/cart/schema'
import { formatAED } from '@/lib/format'
import type { ShippingOption } from '@/lib/shipping-options'

import { useCart, usePricedCart } from './CartProvider'
import { LineItem } from './LineItem'

type Country = { code: string; name: string }
type Form = Record<keyof Address, string>

const EMPTY: Form = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postCode: '',
  country: '',
}

const contactSchema = addressSchema.pick({ firstName: true, lastName: true, email: true })
const DRAFT_KEY = 'kidzlim.checkout.v1'

const deliveryWindow = (o: ShippingOption) =>
  o.minDays && o.maxDays
    ? o.minDays === o.maxDays
      ? `${o.maxDays} business days`
      : `${o.minDays}–${o.maxDays} business days`
    : o.maxDays
      ? `Up to ${o.maxDays} business days`
      : null

export function CheckoutView({ countries, cancelled = false }: { countries: Country[]; cancelled?: boolean }) {
  const { lines } = useCart()
  const { cart, error: cartError, empty, refresh } = usePricedCart()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(
    cancelled ? 'Payment was cancelled — nothing was charged. Your basket is still here when you’re ready.' : null,
  )

  // The form only renders after the cart has loaded in the browser, so reading the
  // saved draft here can't cause a hydration mismatch.
  const [form, setForm] = useState<Form>(() => {
    const base = { ...EMPTY, country: countries.length === 1 ? countries[0].code : '' }
    if (typeof window === 'undefined') return base
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY)
      return raw ? { ...base, ...(JSON.parse(raw) as Partial<Form>) } : base
    } catch {
      return base
    }
  })
  const [errors, setErrors] = useState<Partial<Record<keyof Address, string>>>({})
  const [quoting, setQuoting] = useState(false)
  // A quote is only valid for the exact cart + address it was calculated for.
  const [quote, setQuote] = useState<{ key: string; options: ShippingOption[]; selected: string | null } | null>(null)
  const [quoteFailure, setQuoteFailure] = useState<{ key: string; message: string } | null>(null)

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    } catch {
      /* storage unavailable — draft just isn't saved */
    }
  }, [form])

  const quoteKey = useMemo(
    () => JSON.stringify([lines, form.addressLine1, form.addressLine2, form.city, form.state, form.postCode, form.country]),
    [lines, form],
  )
  const options = quote?.key === quoteKey ? quote.options : null
  const selected = quote?.key === quoteKey ? quote.selected : null
  const quoteError = quoteFailure?.key === quoteKey ? quoteFailure.message : null
  const setSelected = (id: string) => setQuote((q) => (q ? { ...q, selected: id } : q))

  const set = (key: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  if (empty) {
    return (
      <div className="k-empty">
        <p>Your basket is empty.</p>
        <Link href="/books" className="k-btn k-btn--lime">
          <span>Browse the books</span>
        </Link>
      </div>
    )
  }
  if (!cart) return <p className="k-empty">{cartError ?? 'Loading your order…'}</p>

  const needsShipping = cart.hasPhysical
  const chosen = options?.find((o) => o.id === selected) ?? null
  const shippingAED = needsShipping ? (chosen?.priceAED ?? null) : 0
  const totalAED = shippingAED === null ? null : Math.round((cart.subtotalAED + shippingAED) * 100) / 100

  async function getQuote() {
    const parsed = addressSchema.safeParse(form)
    if (!parsed.success) {
      const next: Partial<Record<keyof Address, string>> = {}
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof Address
        next[k] ??= issue.message
      }
      setErrors(next)
      return
    }
    const key = quoteKey
    setQuoting(true)
    setQuoteFailure(null)
    try {
      const res = await fetch('/api/store/shipping-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, address: parsed.data }),
      })
      const body = await res.json()
      if (!res.ok) {
        if (body.fieldErrors) setErrors(body.fieldErrors)
        throw new Error(body.error || 'Could not calculate shipping.')
      }
      const opts = body.options as ShippingOption[]
      setQuote({ key, options: opts, selected: opts[0]?.id ?? null })
    } catch (err) {
      setQuoteFailure({ key, message: err instanceof Error ? err.message : 'Could not calculate shipping.' })
    } finally {
      setQuoting(false)
    }
  }

  const contactValid = contactSchema.safeParse(form).success
  const readyToPay = contactValid && (!needsShipping || chosen !== null) && totalAED !== null

  async function pay() {
    const contact = contactSchema.safeParse(form)
    if (!contact.success || totalAED === null) return
    const address = needsShipping ? addressSchema.safeParse(form) : null
    if (address && !address.success) return

    setPaying(true)
    setPayError(null)
    try {
      const res = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines,
          contact: contact.data,
          ...(address?.success ? { address: address.data, shippingOptionId: chosen?.id } : {}),
          expectedTotalAED: totalAED,
        }),
      })
      const body = await res.json()
      if (res.ok && typeof body.url === 'string') {
        window.location.assign(body.url) // Stripe-hosted payment page
        return
      }
      if (body.code === 'shipping_changed' && Array.isArray(body.options)) {
        const opts = body.options as ShippingOption[]
        setQuote({ key: quoteKey, options: opts, selected: null })
      }
      if (body.code === 'price_changed' || body.code === 'cart_changed') {
        // Re-price from the server so the summary shows the new total; shipping must be re-chosen.
        refresh()
        setQuote(null)
      }
      setPayError(body.error || 'We couldn’t start the payment. Please try again.')
      setPaying(false)
    } catch {
      setPayError('Connection problem. Please check your internet and try again.')
      setPaying(false)
    }
  }

  const field = (key: keyof Address, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label htmlFor={`f-${key}`} className={`k-field${errors[key] ? ' k-field--error' : ''}`}>
      <span>
        {label}
        {props.required ? '' : <em> (optional)</em>}
      </span>
      <input
        id={`f-${key}`}
        name={key}
        value={form[key]}
        onChange={set(key)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${key}-error` : undefined}
        {...props}
      />
      {errors[key] && (
        <small id={`${key}-error`} className="k-field__error">
          {errors[key]}
        </small>
      )}
    </label>
  )

  return (
    <div className="k-checkout">
      <form className="k-checkout__main" onSubmit={(e) => e.preventDefault()} noValidate>
        <section className="k-card k-step">
          <h2>
            <span className="k-step__num">1</span> Contact
          </h2>
          <div className="k-fields">
            {field('firstName', 'First name', { required: true, autoComplete: 'given-name' })}
            {field('lastName', 'Last name', { required: true, autoComplete: 'family-name' })}
            {field('email', 'Email', { required: true, type: 'email', autoComplete: 'email', inputMode: 'email' })}
          </div>
          <p className="k-step__hint">
            {cart.hasDigital
              ? 'Your order confirmation and download link will be sent to this email.'
              : 'Your order confirmation and tracking updates will be sent here.'}
          </p>
        </section>

        {needsShipping ? (
          <section className="k-card k-step">
            <h2>
              <span className="k-step__num">2</span> Delivery address
            </h2>
            <div className="k-fields">
              <label htmlFor="f-country" className={`k-field k-field--full${errors.country ? ' k-field--error' : ''}`}>
                <span>Country</span>
                <select id="f-country" name="country" value={form.country} onChange={set('country')} required autoComplete="country">
                  <option value="" disabled>
                    Select a country
                  </option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.country && <small className="k-field__error">{errors.country}</small>}
                <small className="k-field__hint">
                  Don’t see your country? We don’t ship printed books there yet — digital PDFs are available worldwide.
                </small>
              </label>
              {field('addressLine1', 'Address', { required: true, autoComplete: 'address-line1', className: 'k-field--full' })}
              {field('addressLine2', 'Apartment, villa, building', { autoComplete: 'address-line2' })}
              {field('city', 'City', { required: true, autoComplete: 'address-level2' })}
              {field('state', 'Emirate / State / Region', { autoComplete: 'address-level1' })}
              {field('postCode', 'Postcode', { autoComplete: 'postal-code' })}
              {field('phone', 'Phone (for the courier)', { required: true, type: 'tel', autoComplete: 'tel', inputMode: 'tel' })}
            </div>

            <div className="k-shipping">
              {!options && (
                <button type="button" className="k-btn k-btn--ghost" onClick={getQuote} disabled={quoting}>
                  <Icon name="truck" size={18} /> {quoting ? 'Calculating shipping…' : 'Show delivery options'}
                </button>
              )}
              {quoteError && (
                <p className="k-form-error" role="alert">
                  {quoteError}
                </p>
              )}
              {options && (
                <fieldset className="k-formats">
                  <legend>Delivery method</legend>
                  {options.map((o) => (
                    <label key={o.id} className="k-format k-format--ship">
                      <input
                        type="radio"
                        name="shipping"
                        value={o.id}
                        checked={selected === o.id}
                        onChange={() => setSelected(o.id)}
                      />
                      <span className="k-format__icon">
                        <Icon name="truck" size={20} />
                      </span>
                      <span className="k-format__name">
                        {o.name}
                        {deliveryWindow(o) && <small>{deliveryWindow(o)}</small>}
                      </span>
                      <span className="k-format__price">{formatAED(o.priceAED)}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
          </section>
        ) : (
          <section className="k-card k-step">
            <h2>
              <span className="k-step__num">2</span> Delivery
            </h2>
            <p className="k-step__hint">
              <Icon name="download" size={16} /> Digital order — no shipping needed. Your download link arrives by email
              right after payment.
            </p>
          </section>
        )}
      </form>

      <aside className="k-card k-summary" aria-label="Order summary">
        <h2>Your order</h2>
        <ul className="k-lines k-lines--compact">
          {cart.lines.map((line) => (
            <LineItem key={line.sku} line={line} compact />
          ))}
        </ul>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatAED(cart.subtotalAED)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd>{!needsShipping ? 'Free' : shippingAED === null ? 'Enter address' : formatAED(shippingAED)}</dd>
          </div>
          <div className="k-summary__total">
            <dt>Total</dt>
            <dd>{totalAED === null ? '—' : formatAED(totalAED)}</dd>
          </div>
        </dl>
        <p className="k-summary__note">Prices include VAT where applicable.</p>
        {payError && (
          <p className="k-form-error" role="alert">
            {payError}
          </p>
        )}
        <button
          type="button"
          className="k-btn k-btn--lime k-summary__cta"
          disabled={!readyToPay || paying}
          onClick={pay}
        >
          <span>{paying ? 'Opening secure payment…' : readyToPay ? 'Pay securely' : 'Complete the steps above'}</span>
        </button>
        <p className="k-summary__note">You’ll pay on Stripe’s secure page. We never see your card details.</p>
        <Link href="/cart" className="k-summary__edit">
          Edit basket
        </Link>
      </aside>
    </div>
  )
}
