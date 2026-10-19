import type { CollectionBeforeChangeHook, CollectionConfig, TextFieldSingleValidation } from 'payload'

import { isAdmin, isAdminOrStaff, publishedOrAdminStaff } from '../access/roles'
import { seoField } from '../fields/seo'
import { slugField } from '../fields/slug'

export const VARIANT_TYPES = ['paperback', 'hardcover', 'digital'] as const
export type VariantType = (typeof VARIANT_TYPES)[number]

const isPhysical = (type: unknown): boolean => type === 'paperback' || type === 'hardcover'

const requireGelatoUidForPrint: TextFieldSingleValidation = (value, { siblingData }) =>
  isPhysical((siblingData as { type?: VariantType }).type) && !value
    ? 'Gelato product UID is required for printed variants.'
    : true

/** Fills a printed variant's page count from its print file when left empty (Gelato prices by pages). */
const fillPageCounts: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!Array.isArray(data.variants)) return data
  const variants = await Promise.all(
    data.variants.map(async (v: Record<string, unknown>) => {
      if (!isPhysical(v.type) || v.pageCount || !v.printFile) return v
      const id = typeof v.printFile === 'object' && v.printFile !== null ? (v.printFile as { id: number }).id : v.printFile
      const file = await req.payload
        .findByID({ collection: 'protected-files', id: id as number, depth: 0, overrideAccess: true, req })
        .catch(() => null)
      return file?.pageCount ? { ...v, pageCount: file.pageCount } : v
    }),
  )
  return { ...data, variants }
}

export const Books: CollectionConfig = {
  slug: 'books',
  hooks: { beforeChange: [fillPageCounts] },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'series', 'status', 'featured', 'updatedAt'],
    listSearchableFields: ['title', 'slug'],
    group: 'Shop',
  },
  access: {
    read: publishedOrAdminStaff,
    create: isAdminOrStaff,
    update: isAdminOrStaff,
    delete: isAdmin,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Details',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'richText' },
            {
              type: 'row',
              fields: [
                {
                  name: 'ageRange',
                  type: 'text',
                  admin: { placeholder: 'e.g. 5–8', width: '33%' },
                },
                {
                  name: 'language',
                  type: 'text',
                  admin: { placeholder: 'e.g. English / Arabic', width: '33%' },
                },
                {
                  name: 'publishedYear',
                  type: 'number',
                  min: 1900,
                  max: 2100,
                  admin: { width: '33%' },
                },
              ],
            },
            { name: 'coverImage', type: 'upload', relationTo: 'media', required: true },
            { name: 'galleryImages', type: 'upload', relationTo: 'media', hasMany: true },
          ],
        },
        {
          label: 'Variants & Pricing',
          fields: [
            {
              name: 'variants',
              type: 'array',
              minRows: 1,
              labels: { singular: 'Variant', plural: 'Variants' },
              admin: { initCollapsed: false },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'type',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'Paperback', value: 'paperback' },
                        { label: 'Hardcover', value: 'hardcover' },
                        { label: 'Digital (PDF)', value: 'digital' },
                      ],
                      admin: { width: '34%' },
                    },
                    { name: 'sku', type: 'text', required: true, index: true, admin: { width: '33%' } },
                    {
                      name: 'active',
                      type: 'checkbox',
                      defaultValue: true,
                      admin: { width: '33%', style: { alignSelf: 'flex-end' } },
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'priceAED',
                      label: 'Price (AED)',
                      type: 'number',
                      required: true,
                      min: 0,
                      admin: { width: '50%', step: 0.01 },
                    },
                    {
                      name: 'compareAtPriceAED',
                      label: 'Compare-at price (AED)',
                      type: 'number',
                      min: 0,
                      admin: {
                        width: '50%',
                        step: 0.01,
                        description: 'Optional original price, shown struck through.',
                      },
                    },
                  ],
                },
                {
                  name: 'gelatoProductUid',
                  label: 'Gelato product UID',
                  type: 'text',
                  admin: {
                    condition: (_, siblingData) => isPhysical(siblingData?.type),
                  },
                  validate: requireGelatoUidForPrint,
                },
                {
                  name: 'pageCount',
                  type: 'number',
                  min: 1,
                  admin: {
                    condition: (_, siblingData) => isPhysical(siblingData?.type),
                    description: 'Number of pages in the print file. Gelato uses it to price multi-page books.',
                  },
                },
                {
                  name: 'printFile',
                  type: 'upload',
                  relationTo: 'protected-files',
                  filterOptions: { kind: { equals: 'print' } },
                  admin: {
                    condition: (_, siblingData) => isPhysical(siblingData?.type),
                    description: 'Print-ready PDF with bleed (Shop → Book PDFs, type: print). Page count fills in automatically.',
                  },
                },
                {
                  name: 'digitalFile',
                  type: 'upload',
                  relationTo: 'protected-files',
                  filterOptions: { kind: { equals: 'digital' } },
                  admin: {
                    condition: (_, siblingData) => siblingData?.type === 'digital',
                    description: 'PDF delivered to buyers (Shop → Book PDFs, type: digital). Stamped with the buyer’s email on download.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [seoField],
        },
      ],
    },
    slugField('title'),
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'series',
      type: 'relationship',
      relationTo: 'series',
      index: true,
      admin: { position: 'sidebar', description: 'Used for the filters on the shop page.' },
    },
  ],
}
