import Link from 'next/link'
import type { Payload, ServerProps, Where } from 'payload'
import React from 'react'

import { credentialStatuses } from '@/lib/credentials-core'
import { formatAED } from '@/lib/format'
import type { Order } from '@/payload-types'

import { mockedInDev } from './CredentialBanner'

/**
 * Admin dashboard (shown above Payload's collection cards): today's numbers, what needs a
 * human, recent orders and — for admins — a launch-readiness checklist.
 */

const ORDERS = '/admin/collections/orders'
const BOOKS = '/admin/collections/books'
const PLACEHOLDER_UID = 'REPLACE_ME'
const SOLD: Order['status'][] = ['paid', 'submitted_to_gelato', 'in_production', 'shipped', 'delivered', 'refunded']
const IN_PROGRESS: Order['status'][] = ['paid', 'submitted_to_gelato', 'in_production']

/** Payload list-view URL with a `where` filter, e.g. ?where[needsAttention][equals]=true */
function listUrl(base: string, where: Record<string, Record<string, string>>): string {
  const params = new URLSearchParams()
  for (const [field, ops] of Object.entries(where)) {
    for (const [op, value] of Object.entries(ops)) params.append(`where[${field}][${op}]`, value)
  }
  return `${base}?${params.toString()}`
}

const count = async (payload: Payload, where: Where) =>
  (await payload.count({ collection: 'orders', where, overrideAccess: true })).totalDocs

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

async function orderStats(payload: Payload) {
  const today = startOfToday().toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const [ordersToday, inProgress, attention, week, recent] = await Promise.all([
    count(payload, { status: { in: SOLD }, paidAt: { greater_than_equal: today } }),
    count(payload, { status: { in: IN_PROGRESS } }),
    count(payload, { needsAttention: { equals: true } }),
    payload.find({
      collection: 'orders',
      where: { status: { in: SOLD }, paidAt: { greater_than_equal: weekAgo } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      select: { amountAED: true, refundedAmountAED: true },
    }),
    payload.find({
      collection: 'orders',
      where: { status: { not_equals: 'pending' } },
      sort: '-createdAt',
      limit: 8,
      depth: 0,
      overrideAccess: true,
      select: { orderNumber: true, customerName: true, customerEmail: true, amountAED: true, status: true, needsAttention: true, createdAt: true },
    }),
  ])
  const weekRevenue = week.docs.reduce((sum, o) => sum + (o.amountAED ?? 0) - (o.refundedAmountAED ?? 0), 0)
  return { ordersToday, inProgress, attention, weekRevenue, weekOrders: week.totalDocs, recent: recent.docs }
}

type Check = { ok: boolean; label: string; detail?: string; href?: string }

async function launchChecks(payload: Payload): Promise<Check[]> {
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  const { docs: books } = await payload.find({
    collection: 'books',
    where: { status: { equals: 'published' } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    select: { title: true, variants: true },
  })
  const variants = books.flatMap((b) => (b.variants ?? []).filter((v) => v.active !== false))
  const printed = variants.filter((v) => v.type !== 'digital')
  const placeholderUid = printed.filter((v) => !v.gelatoProductUid || v.gelatoProductUid === PLACEHOLDER_UID).length
  const noPrintFile = printed.filter((v) => !v.printFile).length
  const noPdf = variants.filter((v) => v.type === 'digital' && !v.digitalFile).length

  const creds = await credentialStatuses(payload)
  const missing = creds.filter((c) => c.source === 'missing' && !mockedInDev(c.key)).map((c) => c.label)
  const live = settings.stripe?.mode === 'live'
  const SETTINGS = '/admin/globals/settings'

  return [
    {
      ok: missing.length === 0,
      label: 'API keys configured',
      detail: missing.length ? `Missing: ${missing.join(', ')}` : undefined,
      href: SETTINGS,
    },
    {
      ok: live,
      label: live ? 'Stripe is in live mode' : 'Stripe is in test mode',
      detail: live ? undefined : 'Switch to live keys on launch day (Store Settings → Stripe).',
      href: SETTINGS,
    },
    { ok: Boolean(settings.store?.supportEmail), label: 'Support email set', detail: 'Shown to customers in emails.', href: SETTINGS },
    { ok: Boolean(settings.brevo?.senderEmail), label: 'Email sender address set', href: SETTINGS },
    {
      ok: (settings.store?.shippingCountries ?? []).length > 0,
      label: 'Shipping countries chosen',
      href: SETTINGS,
    },
    {
      ok: placeholderUid === 0,
      label: 'Printed editions have Gelato product UIDs',
      detail: placeholderUid ? `${placeholderUid} printed variant(s) still use a placeholder — they can’t be printed.` : undefined,
      href: BOOKS,
    },
    {
      ok: noPrintFile === 0,
      label: 'Printed editions have a print-ready PDF',
      detail: noPrintFile ? `${noPrintFile} printed variant(s) have no print file.` : undefined,
      href: BOOKS,
    },
    {
      ok: noPdf === 0,
      label: 'Digital editions have a PDF to deliver',
      detail: noPdf ? `${noPdf} digital variant(s) have no PDF — buyers would get nothing.` : undefined,
      href: BOOKS,
    },
  ]
}

const card: React.CSSProperties = {
  padding: '16px 18px',
  borderRadius: 'var(--style-radius-m, 8px)',
  border: '1px solid var(--theme-elevation-100)',
  background: 'var(--theme-elevation-50)',
  color: 'inherit',
  textDecoration: 'none',
  display: 'block',
}

function Stat({ label, value, href, tone }: { label: string; value: string; href?: string; tone?: 'warn' }) {
  const body = (
    <>
      <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, color: tone === 'warn' ? 'var(--theme-error-500)' : undefined }}>{value}</div>
    </>
  )
  const style = tone === 'warn' ? { ...card, borderColor: 'var(--theme-error-300)', background: 'var(--theme-error-50)' } : card
  return href ? (
    <Link href={href} style={style}>
      {body}
    </Link>
  ) : (
    <div style={style}>{body}</div>
  )
}

const statusText = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export async function StoreOverview({ payload, user }: ServerProps) {
  if (!user || !('role' in user)) return null
  const isAdmin = user.role === 'admin'
  const [stats, checks] = await Promise.all([orderStats(payload), isAdmin ? launchChecks(payload) : Promise.resolve(null)])
  const failing = checks?.filter((c) => !c.ok) ?? []

  return (
    <section aria-label="Store overview" style={{ marginBottom: 32 }}>
      <h2 style={{ margin: '0 0 12px' }}>Store overview</h2>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat label="Orders today" value={String(stats.ordersToday)} href={ORDERS} />
        <Stat label="Last 7 days (net)" value={formatAED(stats.weekRevenue)} />
        <Stat
          label="Being fulfilled"
          value={String(stats.inProgress)}
          href={listUrl(ORDERS, { status: { in: IN_PROGRESS.join(',') } })}
        />
        <Stat
          label="Needs attention"
          value={String(stats.attention)}
          href={listUrl(ORDERS, { needsAttention: { equals: 'true' } })}
          tone={stats.attention > 0 ? 'warn' : undefined}
        />
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 16 }}>
        <div style={card}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Recent orders</h3>
          {stats.recent.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.7 }}>No orders yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {stats.recent.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--theme-elevation-100)' }}>
                    <td style={{ padding: '7px 6px 7px 0' }}>
                      <Link href={`${ORDERS}/${o.id}`} style={{ fontWeight: 600 }}>
                        {o.orderNumber}
                      </Link>
                      {o.needsAttention && (
                        <span title="Needs attention" style={{ color: 'var(--theme-error-500)', marginLeft: 6 }}>
                          ●
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '7px 6px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.customerName || o.customerEmail}
                    </td>
                    <td style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>{formatAED(o.amountAED ?? 0)}</td>
                    <td style={{ padding: '7px 0 7px 6px', opacity: 0.8 }}>{statusText(o.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {checks && (
          <div style={card}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>
              Launch readiness{' '}
              <span style={{ fontWeight: 400, opacity: 0.7 }}>
                — {failing.length === 0 ? 'all clear' : `${failing.length} to do`}
              </span>
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
              {checks.map((c) => (
                <li key={c.label} style={{ display: 'flex', gap: 8, padding: '5px 0' }}>
                  <span aria-hidden="true" style={{ color: c.ok ? 'var(--theme-success-500)' : 'var(--theme-warning-500)', fontWeight: 700 }}>
                    {c.ok ? '✓' : '!'}
                  </span>
                  <span>
                    {c.href ? <Link href={c.href}>{c.label}</Link> : c.label}
                    {!c.ok && c.detail && <span style={{ display: 'block', opacity: 0.75 }}>{c.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
