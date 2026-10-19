import 'server-only'

import type { Payload } from 'payload'

import { credentialStatuses, resolveCredential } from './credentials-core'
import { TEMPLATE_ENV, TEMPLATE_KEYS } from './email'
import { createBrevoClient, createMockBrevoClient } from './integrations/brevo'
import { createGelatoClient, createMockGelatoClient } from './integrations/gelato'
import { createStripeGateway } from './integrations/stripe'

export const INTEGRATIONS = ['stripe', 'gelato', 'brevo'] as const
export type Integration = (typeof INTEGRATIONS)[number]

export type Check = { label: string; ok: boolean; detail?: string; warn?: boolean }
export type CheckResult = { integration: Integration; ok: boolean; checks: Check[] }

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))
const sourceLabel = (s: string) => (s === 'settings' ? 'Store Settings (encrypted)' : s === 'env' ? 'server environment' : 'not set')
const dev = () => process.env.NODE_ENV !== 'production'

async function credentialCheck(payload: Payload, key: Parameters<typeof resolveCredential>[1], label: string): Promise<Check> {
  const status = (await credentialStatuses(payload)).find((s) => s.key === key)
  if (!status || status.source === 'missing') return { label, ok: false, detail: status?.warning ?? 'Not set' }
  return { label, ok: true, detail: `From ${sourceLabel(status.source)}${status.warning ? ` — ${status.warning}` : ''}`, warn: Boolean(status.warning) }
}

/** One harmless authenticated call per integration (brief §6), plus config sanity checks. */
export async function testIntegration(payload: Payload, integration: Integration): Promise<CheckResult> {
  const checks: Check[] = []
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })

  if (integration === 'stripe') {
    const keyCheck = await credentialCheck(payload, 'stripe.secretKey', 'Secret key')
    checks.push(keyCheck)
    if (keyCheck.ok) {
      try {
        const key = await resolveCredential(payload, 'stripe.secretKey')
        const balance = await createStripeGateway(key).retrieveBalance()
        const mode = settings.stripe?.mode ?? 'test'
        checks.push({ label: 'Stripe API (GET /v1/balance)', ok: true, detail: `Connected (${balance.livemode ? 'live' : 'test'} account)` })
        checks.push({
          label: 'Mode matches key',
          ok: balance.livemode === (mode === 'live'),
          detail: balance.livemode === (mode === 'live') ? `${mode} mode` : `Settings say ${mode} mode but the key is a ${balance.livemode ? 'live' : 'test'} key`,
        })
      } catch (err) {
        checks.push({ label: 'Stripe API (GET /v1/balance)', ok: false, detail: errMsg(err) })
      }
    }
    checks.push(await credentialCheck(payload, 'stripe.webhookSigningSecret', 'Webhook signing secret'))
  }

  if (integration === 'gelato') {
    const mock = dev() && process.env.GELATO_MOCK === '1'
    const keyCheck = mock ? { label: 'API key', ok: true, detail: 'GELATO_MOCK=1 (development)' } : await credentialCheck(payload, 'gelato.apiKey', 'API key')
    checks.push(keyCheck)
    if (keyCheck.ok) {
      try {
        const client = mock ? createMockGelatoClient() : createGelatoClient({ apiKey: await resolveCredential(payload, 'gelato.apiKey') })
        const n = await client.listCatalogs()
        checks.push({ label: 'Gelato API (product catalogue)', ok: true, detail: `Connected — ${n} catalogues available${mock ? ' (mock)' : ''}` })
      } catch (err) {
        checks.push({ label: 'Gelato API (product catalogue)', ok: false, detail: errMsg(err) })
      }
    }
    checks.push(await credentialCheck(payload, 'gelato.webhookSecret', 'Webhook secret'))
    const countries = settings.store?.shippingCountries ?? []
    checks.push({
      label: 'Shipping countries',
      ok: true,
      warn: countries.length === 0,
      detail: countries.length ? countries.join(', ') : 'None set in Store tab — falling back to STORE_SHIPPING_COUNTRIES or UAE only',
    })
  }

  if (integration === 'brevo') {
    const mock = dev() && process.env.BREVO_MOCK === '1'
    const keyCheck = mock ? { label: 'API key', ok: true, detail: 'BREVO_MOCK=1 (development)' } : await credentialCheck(payload, 'brevo.apiKey', 'API key')
    checks.push(keyCheck)
    if (keyCheck.ok) {
      try {
        const client = mock ? createMockBrevoClient() : createBrevoClient({ apiKey: await resolveCredential(payload, 'brevo.apiKey') })
        const account = await client.getAccount()
        checks.push({
          label: 'Brevo API (GET /v3/account)',
          ok: true,
          detail: `Connected as ${account.email}${account.plan ? ` (${account.plan} plan)` : ''}`,
        })
        for (const key of TEMPLATE_KEYS) {
          const id = settings.brevo?.templates?.[key] ?? Number(process.env[TEMPLATE_ENV[key]] || NaN)
          if (!Number.isInteger(id) || id <= 0) {
            checks.push({ label: `Template: ${key}`, ok: false, detail: 'No template ID set' })
            continue
          }
          const t = await client.getTemplate(id)
          checks.push({
            label: `Template: ${key}`,
            ok: Boolean(t?.isActive),
            detail: !t ? `Template #${id} not found in Brevo` : t.isActive ? `#${id} “${t.name}”` : `#${id} “${t.name}” is not active`,
          })
        }
      } catch (err) {
        checks.push({ label: 'Brevo API (GET /v3/account)', ok: false, detail: errMsg(err) })
      }
    }
    const sender = settings.brevo?.senderEmail || process.env.BREVO_SENDER_EMAIL
    checks.push({
      label: 'Sender email',
      ok: Boolean(sender),
      detail: sender ? `${sender} — must be a verified sender/domain in Brevo (SPF, DKIM, DMARC)` : 'Not set',
    })
  }

  return { integration, ok: checks.every((c) => c.ok), checks }
}

