import { z } from 'zod'

export const MAX_QTY_PER_LINE = 20
export const MAX_LINES = 50

/** What the browser is allowed to send: identifiers and quantities only — never prices. */
export const cartLineSchema = z.object({
  bookId: z.number().int().positive(),
  sku: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
})
export type CartLineInput = z.infer<typeof cartLineSchema>

export const cartSchema = z.object({
  lines: z.array(cartLineSchema).max(MAX_LINES),
})

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined))

export const addressSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  phone: z
    .string()
    .trim()
    .min(6, 'Enter a phone number for the courier')
    .max(30)
    .regex(/^\+?[\d\s().-]+$/, 'Use digits, spaces and + only'),
  addressLine1: z.string().trim().min(1, 'Address is required').max(100),
  addressLine2: optionalText(100),
  city: z.string().trim().min(1, 'City is required').max(60),
  state: optionalText(60),
  postCode: optionalText(20),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Choose a country'),
})
export type Address = z.infer<typeof addressSchema>

export const shippingQuoteRequestSchema = z.object({
  lines: cartSchema.shape.lines,
  address: addressSchema,
})
