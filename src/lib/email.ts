import type { Payload } from 'payload'

import { MissingCredentialError, resolveCredential } from './credentials-core'
import { createBrevoClient, createMockBrevoClient, type BrevoClient } from './integrations/brevo'

export const TEMPLATE_KEYS = ['orderConfirmation', 'digitalDelivery', 'shippingNotification', 'downloadResend'] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export const TEMPLATE_ENV: Record<TemplateKey, string> = {
  orderConfirmation: 'BREVO_TEMPLATE_ORDER_CONFIRMATION',
  digitalDelivery: 'BREVO_TEMPLATE_DIGITAL_DELIVERY',
  shippingNotification: 'BREVO_TEMPLATE_SHIPPING_NOTIFICATION',
  downloadResend: 'BREVO_TEMPLATE_DOWNLOAD_RESEND',
}

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailConfigError'
  }
}

type Mailer = {
  send(template: TemplateKey, to: { email: string; name?: string }, params: Record<string, unknown>): Promise<{ messageId: string }>
}

/**
 * Template-based mailer. Template ids and sender come from Store Settings → Brevo
 * (env fallbacks BREVO_TEMPLATE_*, BREVO_SENDER_*); the API key via getCredential().
 */
export async function getMailer(payload: Payload): Promise<Mailer> {
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  const brevo = settings.brevo

  const useMock = process.env.NODE_ENV !== 'production' && process.env.BREVO_MOCK === '1'
  let client: BrevoClient
  if (useMock) client = createMockBrevoClient()
  else {
    try {
      client = createBrevoClient({ apiKey: await resolveCredential(payload, 'brevo.apiKey') })
    } catch (err) {
      if (err instanceof MissingCredentialError) throw new EmailConfigError(err.message)
      throw err
    }
  }

  const senderEmail = brevo?.senderEmail || process.env.BREVO_SENDER_EMAIL
  const senderName = brevo?.senderName || process.env.BREVO_SENDER_NAME || 'Kidzlim'
  const supportEmail = settings.store?.supportEmail || process.env.STORE_SUPPORT_EMAIL || undefined

  return {
    async send(template, to, params) {
      const fromSettings = brevo?.templates?.[template]
      const templateId = fromSettings ?? Number(process.env[TEMPLATE_ENV[template]] || NaN)
      if (!Number.isInteger(templateId) || templateId <= 0) {
        throw new EmailConfigError(
          `Brevo template "${template}" is not set. Add its ID in Admin → Store Settings → Brevo, or ${TEMPLATE_ENV[template]}.`,
        )
      }
      return client.sendTemplate({
        templateId,
        to,
        params: { storeName: settings.store?.name || 'Kidzlim', supportEmail: supportEmail ?? '', ...params },
        ...(senderEmail ? { sender: { name: senderName, email: senderEmail } } : {}),
        ...(supportEmail ? { replyTo: { email: supportEmail } } : {}),
        tags: [template],
      })
    },
  }
}
