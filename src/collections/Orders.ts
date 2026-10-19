import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminOrStaff } from '../access/roles'
import { collectionAuditHooks } from '../lib/audit'

const audit = collectionAuditHooks({
  entity: 'orders',
  label: (d) => String(d.orderNumber ?? d.id),
  ignore: ['fulfilmentLog', 'downloadToken'],
})

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'submitted_to_gelato',
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const

const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/**
 * Orders are created by the Stripe webhook (later phase, via overrideAccess).
 * In the admin they are read-mostly.
 */
export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customerEmail', 'status', 'needsAttention', 'amountAED', 'createdAt'],
    group: 'Shop',
  },
  hooks: { afterChange: [audit.afterChange], afterDelete: [audit.afterDelete] },
  access: {
    read: isAdminOrStaff,
    create: isAdmin,
    update: isAdminOrStaff,
    delete: isAdmin,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Summary',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'orderNumber', type: 'text', required: true, unique: true, index: true },
                { name: 'customerName', type: 'text' },
                { name: 'customerEmail', type: 'email', required: true, index: true },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'subtotalAED', label: 'Books (AED)', type: 'number', min: 0, admin: { readOnly: true } },
                { name: 'shippingAmount', label: 'Shipping (AED)', type: 'number', min: 0, admin: { readOnly: true } },
                { name: 'taxAmount', label: 'VAT incl. (AED)', type: 'number', min: 0, admin: { readOnly: true } },
                { name: 'amountAED', label: 'Total (AED)', type: 'number', min: 0, admin: { readOnly: true } },
                { name: 'currency', type: 'text', defaultValue: 'AED', admin: { readOnly: true } },
              ],
            },
            {
              name: 'shippingMethod',
              type: 'group',
              admin: { condition: (data) => Boolean(data?.shippingMethod?.name) },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'name', type: 'text', admin: { readOnly: true } },
                    {
                      name: 'gelatoMethodUids',
                      label: 'Gelato shipment method UIDs',
                      type: 'json',
                      admin: { readOnly: true },
                    },
                  ],
                },
              ],
            },
            {
              name: 'items',
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'book', type: 'relationship', relationTo: 'books', required: true },
                    {
                      name: 'variant',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'Paperback', value: 'paperback' },
                        { label: 'Hardcover', value: 'hardcover' },
                        { label: 'Digital (PDF)', value: 'digital' },
                      ],
                    },
                    { name: 'sku', type: 'text' },
                    { name: 'quantity', type: 'number', required: true, min: 1, defaultValue: 1 },
                    { name: 'unitPrice', type: 'number', required: true, min: 0 },
                  ],
                },
              ],
            },
            { name: 'shippingAddress', type: 'json' },
          ],
        },
        {
          label: 'Payment',
          fields: [
            {
              name: 'stripeSessionId',
              type: 'text',
              // Idempotency guard for the checkout.session.completed webhook (brief §3).
              unique: true,
              index: true,
              admin: { readOnly: true },
            },
            { name: 'stripePaymentIntentId', type: 'text', index: true, admin: { readOnly: true } },
            { name: 'stripeCustomerId', type: 'text', admin: { readOnly: true } },
            {
              name: 'paidAt',
              type: 'date',
              admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
            },
          ],
        },
        {
          label: 'Fulfilment',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'gelatoOrderId', type: 'text', index: true, admin: { readOnly: true } },
                { name: 'gelatoStatus', type: 'text', admin: { readOnly: true } },
                {
                  name: 'gelatoSubmittedAt',
                  type: 'date',
                  admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'confirmationSentAt',
                  label: 'Confirmation email sent',
                  type: 'date',
                  admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
                },
                {
                  name: 'digitalDeliveredAt',
                  label: 'Download email sent',
                  type: 'date',
                  admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'trackingCode', type: 'text' },
                { name: 'trackingUrl', type: 'text' },
                {
                  name: 'shippingNotifiedAt',
                  label: 'Shipping email sent',
                  type: 'date',
                  admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'downloadToken',
                  type: 'text',
                  index: true,
                  // SHA-256 of the emailed token — the token itself is never stored.
                  admin: { readOnly: true, description: 'Hash only. The link itself is in the customer’s email.' },
                  access: { read: ({ req }) => Boolean(req.user) },
                },
                { name: 'downloadExpiresAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
                { name: 'downloadCount', label: 'Total downloads', type: 'number', defaultValue: 0, min: 0, admin: { readOnly: true } },
              ],
            },
            {
              name: 'downloadCounts',
              label: 'Downloads per file',
              type: 'json',
              admin: {
                description: 'SKU → number of downloads. Admins can lower a number to give a customer more downloads.',
              },
            },
            {
              name: 'fulfilmentLog',
              type: 'array',
              admin: { readOnly: true, initCollapsed: true },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'at',
                      type: 'date',
                      required: true,
                      admin: { date: { pickerAppearance: 'dayAndTime' } },
                    },
                    { name: 'event', type: 'text', required: true },
                  ],
                },
                { name: 'detail', type: 'json' },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: ORDER_STATUSES.map((value) => ({ label: statusLabel(value), value })),
      admin: { position: 'sidebar' },
    },
    {
      name: 'needsAttention',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', description: 'Set automatically when something needs a human (failed print, mismatch…).' },
    },
    {
      name: 'attentionReason',
      type: 'textarea',
      admin: { position: 'sidebar', condition: (data) => Boolean(data?.needsAttention) },
    },
    {
      name: 'refundedAmountAED',
      label: 'Refunded (AED)',
      type: 'number',
      min: 0,
      admin: { position: 'sidebar', readOnly: true, condition: (data) => Boolean(data?.refundedAmountAED) },
    },
    {
      name: 'orderActions',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '/components/admin/OrderActions#OrderActions' } },
    },
  ],
}
