import type { Block } from 'payload'

const link = (prefix: string, required = false) =>
  [
    { name: `${prefix}Label`, type: 'text', required, admin: { width: '50%' } },
    { name: `${prefix}Link`, type: 'text', required, admin: { width: '50%', placeholder: '/books' } },
  ] as const

export const HeroBlock: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  fields: [
    { name: 'eyebrow', type: 'text', admin: { placeholder: 'e.g. Little Muslims, Big Faith' } },
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { type: 'row', fields: [...link('cta')] },
  ],
}

export const RichTextBlock: Block = {
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  labels: { singular: 'Rich text', plural: 'Rich text' },
  fields: [{ name: 'content', type: 'richText', required: true }],
}

export const BookGridBlock: Block = {
  slug: 'bookGrid',
  interfaceName: 'BookGridBlock',
  labels: { singular: 'Book grid', plural: 'Book grids' },
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'featured',
      options: [
        { label: 'Featured books', value: 'featured' },
        { label: 'Latest books', value: 'latest' },
        { label: 'Pick books manually', value: 'manual' },
      ],
    },
    {
      name: 'books',
      type: 'relationship',
      relationTo: 'books',
      hasMany: true,
      admin: { condition: (_, siblingData) => siblingData?.source === 'manual' },
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 8,
      min: 1,
      max: 48,
      admin: { condition: (_, siblingData) => siblingData?.source !== 'manual' },
    },
  ],
}

export const TestimonialsBlock: Block = {
  slug: 'testimonials',
  interfaceName: 'TestimonialsBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'quote', type: 'textarea', required: true },
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, admin: { width: '40%' } },
            {
              name: 'context',
              type: 'text',
              admin: { width: '40%', placeholder: 'e.g. Mother of 2 (Dubai)' },
            },
            { name: 'rating', type: 'number', min: 1, max: 5, defaultValue: 5, admin: { width: '20%' } },
          ],
        },
        { name: 'photo', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}

export const FaqBlock: Block = {
  slug: 'faq',
  interfaceName: 'FaqBlock',
  labels: { singular: 'FAQ', plural: 'FAQs' },
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'richText', required: true },
      ],
    },
  ],
}

export const CtaBlock: Block = {
  slug: 'cta',
  interfaceName: 'CtaBlock',
  labels: { singular: 'Call to action', plural: 'Calls to action' },
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea' },
    { type: 'row', fields: [...link('button', true)] },
  ],
}

export const FEATURE_ICONS = [
  'book',
  'moon',
  'heart',
  'sparkles',
  'star',
  'users',
  'globe',
  'printer',
  'download',
  'pen',
  'shield',
  'leaf',
] as const
export type FeatureIcon = (typeof FEATURE_ICONS)[number]

export const FeaturesBlock: Block = {
  slug: 'features',
  interfaceName: 'FeaturesBlock',
  labels: { singular: 'Feature grid', plural: 'Feature grids' },
  fields: [
    { name: 'anchor', type: 'text', admin: { description: 'Optional section id for links, e.g. "about" → /#about' } },
    { name: 'heading', type: 'text', required: true },
    { name: 'intro', type: 'textarea' },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional illustration shown beside the features.' },
    },
    {
      name: 'columns',
      type: 'select',
      defaultValue: '3',
      options: [
        { label: '2 columns', value: '2' },
        { label: '3 columns', value: '3' },
      ],
    },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'icon',
              type: 'select',
              defaultValue: 'book',
              options: FEATURE_ICONS.map((value) => ({ label: value, value })),
              admin: { width: '25%' },
            },
            { name: 'title', type: 'text', required: true, admin: { width: '75%' } },
          ],
        },
        { name: 'text', type: 'textarea' },
      ],
    },
  ],
}

export const pageBlocks: Block[] = [
  HeroBlock,
  FeaturesBlock,
  RichTextBlock,
  BookGridBlock,
  TestimonialsBlock,
  FaqBlock,
  CtaBlock,
]
