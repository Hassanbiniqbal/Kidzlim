import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

/**
 * Idempotency ledger for incoming webhooks. `key` is UNIQUE: a webhook handler claims
 * a key inside its transaction before doing any work, so a retried or duplicated
 * delivery can never be processed twice.
 */
export const WebhookEvents: CollectionConfig = {
  slug: 'webhook-events',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'type', 'createdAt'],
    group: 'Admin',
    description: 'Processed payment/fulfilment webhooks (read-only log).',
  },
  access: {
    read: isAdmin,
    create: () => false, // written by server code with overrideAccess only
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'provider', type: 'select', required: true, options: ['stripe', 'gelato'] },
    { name: 'eventId', type: 'text', index: true },
    { name: 'type', type: 'text' },
    { name: 'order', type: 'relationship', relationTo: 'orders' },
  ],
}
