import type { Field } from 'payload'

export const seoField: Field = {
  name: 'seo',
  label: 'SEO',
  type: 'group',
  fields: [
    {
      name: 'metaTitle',
      type: 'text',
      admin: { description: 'Shown in Google results and the browser tab. Aim for ≤ 60 characters.' },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      admin: { description: 'Aim for 120–160 characters.' },
    },
    {
      name: 'ogImage',
      label: 'Social share image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: '1200 × 630 recommended.' },
    },
  ],
}
