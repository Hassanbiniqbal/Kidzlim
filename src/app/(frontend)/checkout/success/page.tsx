import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ClearCart } from '@/components/cart/ClearCart'
import { Icon } from '@/components/Icon'
import { getPayloadClient } from '@/lib/cms'
import { formatAED, VARIANT_LABELS } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thank you',
  robots: { index: false },
}

const maskEmail = (email: string) => email.replace(/^(.)(.*)(.@.*)$/, (_, a: string, mid: string, b: string) => a + '•'.repeat(Math.min(mid.length, 6)) + b)

/**
 * Cosmetic confirmation page (brief §4.5): it only *reads* the order. Payment is
 * confirmed by the Stripe webhook, so this may briefly show "confirming".
 */
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams
  const valid = typeof sessionId === 'string' && /^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)

  const order = valid
    ? (
        await (
          await getPayloadClient()
        ).find({
          collection: 'orders',
          where: { stripeSessionId: { equals: sessionId } },
          limit: 1,
          depth: 1,
          overrideAccess: true,
        })
      ).docs[0]
    : undefined

  if (!order) {
    return (
      <section className="k-hero k-wrap">
        <h1 className="k-hero__title">Order not found</h1>
        <p className="k-hero__lead">
          If you’ve just paid, your confirmation email is on its way. Otherwise, please contact us with your payment
          receipt.
        </p>
        <div className="k-hero__actions">
          <Link href="/books" className="k-btn k-btn--lime">
            <span>Browse books</span>
          </Link>
        </div>
      </section>
    )
  }

  const confirmed = order.status !== 'pending' && order.status !== 'cancelled'
  const hasDigital = order.items?.some((i) => i.variant === 'digital')
  const hasPhysical = order.items?.some((i) => i.variant !== 'digital')

  return (
    <>
      {order.status !== 'cancelled' && <ClearCart />}
      <section className="k-hero k-wrap k-thanks">
        <p className="k-hero__eyebrow">Order {order.orderNumber}</p>
        <h1 className="k-hero__title">{confirmed ? 'JazākAllāhu khayran!' : 'Almost there…'}</h1>
        <p className="k-hero__lead">
          {confirmed
            ? `Thank you for your order. A confirmation has been sent to ${maskEmail(order.customerEmail)}.`
            : 'We’re confirming your payment with the bank. This usually takes a few seconds — refresh this page shortly.'}
        </p>
      </section>

      <section className="k-wrap">
        <div className="k-card k-thanks__card">
          <ul className="k-thanks__steps">
            {hasDigital && (
              <li>
                <Icon name="download" />
                <div>
                  <strong>Digital books</strong>
                  <span>Your secure download link arrives by email right after payment is confirmed.</span>
                </div>
              </li>
            )}
            {hasPhysical && (
              <li>
                <Icon name="truck" />
                <div>
                  <strong>Printed books</strong>
                  <span>
                    Your books are printed to order{order.shippingMethod?.name ? ` and sent by ${order.shippingMethod.name}` : ''}
                    . We’ll email tracking details as soon as they ship.
                  </span>
                </div>
              </li>
            )}
          </ul>

          <ul className="k-lines k-lines--compact">
            {order.items?.map((item) => {
              const book = typeof item.book === 'object' ? item.book : null
              return (
                <li key={item.id ?? item.sku} className="k-thanks__item">
                  <span>
                    {book?.title ?? 'Book'} <small>· {VARIANT_LABELS[item.variant]}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</small>
                  </span>
                  <span>{formatAED(item.unitPrice * item.quantity)}</span>
                </li>
              )
            })}
          </ul>
          <dl className="k-thanks__totals">
            {order.shippingAmount ? (
              <div>
                <dt>Shipping</dt>
                <dd>{formatAED(order.shippingAmount)}</dd>
              </div>
            ) : null}
            <div className="k-summary__total">
              <dt>Total paid</dt>
              <dd>{formatAED(order.amountAED ?? 0)}</dd>
            </div>
            {order.taxAmount ? (
              <div>
                <dt>Includes VAT</dt>
                <dd>{formatAED(order.taxAmount)}</dd>
              </div>
            ) : null}
          </dl>

          <Link href="/books" className="k-btn k-btn--ghost">
            Continue browsing
          </Link>
        </div>
      </section>
    </>
  )
}
