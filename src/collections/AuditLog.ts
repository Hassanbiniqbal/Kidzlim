import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/roles'

/** Append-only record of who changed what, when (brief §7). Written by server code only. */
export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'Audit entry', plural: 'Audit log' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'actorEmail', 'action', 'entity', 'entityLabel', 'summary'],
    group: 'Admin',
    description: 'Every change made by a person to orders, store settings and users. Entries cannot be edited or deleted.',
    pagination: { defaultLimit: 50 },
  },
  defaultSort: '-createdAt',
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'actor', type: 'relationship', relationTo: 'users', admin: { readOnly: true, width: '50%' } },
        { name: 'actorEmail', label: 'By', type: 'text', index: true, admin: { readOnly: true, width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'action',
          type: 'select',
          required: true,
          index: true,
          options: ['create', 'update', 'delete', 'order-action', 'test-connection'],
          admin: { readOnly: true, width: '33%' },
        },
        { name: 'entity', type: 'text', required: true, index: true, admin: { readOnly: true, width: '33%' } },
        { name: 'entityLabel', label: 'Record', type: 'text', admin: { readOnly: true, width: '33%' } },
      ],
    },
    { name: 'entityId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'summary', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'changes', type: 'json', admin: { readOnly: true, description: 'Field → from / to. Secret values are never stored.' } },
  ],
}
