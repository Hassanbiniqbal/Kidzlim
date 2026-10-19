import type { Field, GlobalConfig } from 'payload'

import { isAdmin } from '../access/roles'
import { secretField } from '../fields/secret'
import { globalAuditHook } from '../lib/audit'

/** "Test connection" panel at the top of an integration tab (brief §6). */
const testConnection = (integration: 'stripe' | 'gelato' | 'brevo'): Field => ({
  name: 'testConnection',
  type: 'ui',
  admin: {
    components: { Field: { path: '/components/admin/IntegrationTest#IntegrationTest', clientProps: { integration } } },
  },
})

const templateId = (name: string, label: string): Field => ({
  name,
  label,
  type: 'number',
  min: 1,
  admin: { width: '50%', description: 'Brevo template ID' },
})

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Store Settings',
  admin: {
    group: 'Admin',
  },
  hooks: {
    afterChange: [
      globalAuditHook({
        entity: 'settings',
        secretPaths: ['stripe.secretKey', 'stripe.webhookSigningSecret', 'gelato.apiKey', 'gelato.webhookSecret', 'brevo.apiKey'],
      }),
    ],
  },
  // Restricted to the admin role only (brief §6).
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          name: 'store',
          label: 'Store',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'name', type: 'text', required: true, defaultValue: 'Kidzlim', admin: { width: '50%' } },
                { name: 'supportEmail', type: 'email', admin: { width: '50%' } },
              ],
            },
            {
              name: 'currency',
              type: 'select',
              required: true,
              defaultValue: 'AED',
              options: [{ label: 'AED — UAE Dirham', value: 'AED' }],
            },
            {
              name: 'shippingCountries',
              type: 'text',
              hasMany: true,
              admin: {
                description:
                  'ISO 3166-1 alpha-2 country codes you ship printed books to (e.g. AE, SA, GB). Press Enter after each.',
              },
              validate: (value: string[] | null | undefined) =>
                !value || value.every((code) => /^[A-Z]{2}$/.test(code))
                  ? true
                  : 'Use 2-letter uppercase country codes, e.g. AE.',
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'downloadExpiryHours',
                  type: 'number',
                  required: true,
                  defaultValue: 48,
                  min: 1,
                  admin: { width: '50%' },
                },
                {
                  name: 'maxDownloadsPerOrder',
                  type: 'number',
                  required: true,
                  defaultValue: 5,
                  min: 1,
                  admin: { width: '50%' },
                },
              ],
            },
          ],
        },
        {
          name: 'stripe',
          label: 'Stripe',
          fields: [
            testConnection('stripe'),
            {
              name: 'mode',
              type: 'radio',
              required: true,
              defaultValue: 'test',
              options: [
                { label: 'Test mode', value: 'test' },
                { label: 'Live mode', value: 'live' },
              ],
              admin: { layout: 'horizontal' },
            },
            {
              name: 'publishableKey',
              type: 'text',
              admin: { description: 'Starts with pk_test_ or pk_live_. Not secret.' },
            },
            secretField({
              group: 'stripe',
              name: 'secretKey',
              label: 'Secret key',
              description: 'Starts with sk_test_ or sk_live_ (restricted keys rk_… also work).',
              pattern: /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/,
              patternHint: 'Stripe secret keys start with sk_test_ or sk_live_.',
            }),
            secretField({
              group: 'stripe',
              name: 'webhookSigningSecret',
              label: 'Webhook signing secret',
              description: 'Starts with whsec_.',
              pattern: /^whsec_[A-Za-z0-9+/=]{10,}$/,
              patternHint: 'Stripe webhook secrets start with whsec_.',
            }),
          ],
        },
        {
          name: 'gelato',
          label: 'Gelato',
          fields: [
            testConnection('gelato'),
            secretField({
              group: 'gelato',
              name: 'apiKey',
              label: 'API key',
              pattern: /^\S{16,}$/,
              patternHint: 'Paste the full Gelato API key.',
            }),
            secretField({
              group: 'gelato',
              name: 'webhookSecret',
              label: 'Webhook secret',
              pattern: /^\S{24,}$/,
              patternHint: 'Use at least 24 random characters.',
              description:
                'Any long random string. In Gelato → Developer → Webhooks, add https://<your-domain>/api/store/gelato/webhook, enable Authorization → HTTP header, name x-kidzlim-webhook-secret, value = this secret.',
            }),
          ],
        },
        {
          name: 'brevo',
          label: 'Brevo',
          fields: [
            testConnection('brevo'),
            secretField({
              group: 'brevo',
              name: 'apiKey',
              label: 'API key',
              description: 'Starts with xkeysib-.',
              pattern: /^xkeysib-[A-Za-z0-9-]{20,}$/,
              patternHint: 'Brevo API keys start with xkeysib-.',
            }),
            {
              type: 'row',
              fields: [
                { name: 'senderName', type: 'text', defaultValue: 'Kidzlim', admin: { width: '50%' } },
                { name: 'senderEmail', type: 'email', admin: { width: '50%' } },
              ],
            },
            {
              name: 'templates',
              type: 'group',
              fields: [
                {
                  type: 'row',
                  fields: [
                    templateId('orderConfirmation', 'Order confirmation'),
                    templateId('digitalDelivery', 'Digital delivery'),
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    templateId('shippingNotification', 'Shipping notification'),
                    templateId('downloadResend', 'Download resend'),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
