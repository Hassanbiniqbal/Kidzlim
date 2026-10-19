import type { Field } from 'payload'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slugField = (sourceField: string): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
    description: `URL path, e.g. "my-first-quran-stories". Lowercase letters, numbers and dashes. Usually the ${sourceField}.`,
  },
  validate: (value: string | null | undefined) =>
    !value || SLUG_PATTERN.test(value) ? true : 'Use lowercase letters, numbers and single dashes only.',
})
