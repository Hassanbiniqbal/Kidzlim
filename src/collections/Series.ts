import type { CollectionConfig } from 'payload'

import { anyone, isAdmin, isAdminOrStaff } from '../access/roles'
import { slugField } from '../fields/slug'

/** Book series / categories, used for the filter on the shop page and on each book page. */
export const Series: CollectionConfig = {
  slug: 'series',
  labels: { singular: 'Series', plural: 'Series' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'sortOrder', 'updatedAt'],
    group: 'Shop',
    description: 'Groups books on the shop page (e.g. Prophet Stories, Learn Arabic).',
  },
  defaultSort: 'sortOrder',
  access: {
    read: anyone,
    create: isAdminOrStaff,
    update: isAdminOrStaff,
    delete: isAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'blurb', type: 'textarea', admin: { description: 'One sentence shown on the shop page when this series is selected.' } },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 10,
      admin: { position: 'sidebar', description: 'Lower numbers appear first.' },
    },
    slugField('title'),
  ],
}
