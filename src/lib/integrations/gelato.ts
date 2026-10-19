import { z } from 'zod'

/**
 * Thin typed wrapper around the Gelato Orders API v4 (https://order.gelatoapis.com).
 * Only what the store needs; responses are validated with Zod so a contract change
 * fails loudly instead of producing a wrong shipping price.
 */

export type GelatoAddress = {
  firstName: string
  lastName: string
  companyName?: string
  addressLine1: string
  addressLine2?: string
  city: string
  postCode?: string
  state?: string
  country: string // ISO 3166-1 alpha-2
  email: string
  phone: string
}

export type GelatoQuoteRequest = {
  orderReferenceId: string
  customerReferenceId: string
  currency: string
  allowMultipleQuotes?: boolean
  recipient: GelatoAddress
  products: { itemReferenceId: string; productUid: string; quantity: number; pageCount?: number }[]
}

const money = z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)])

const shipmentMethodSchema = z
  .object({
    shipmentMethodUid: z.string(),
    name: z.string(),
    price: money,
    currency: z.string(),
    minDeliveryDays: z.number().int().nullable().optional(),
    maxDeliveryDays: z.number().int().nullable().optional(),
    type: z.string().optional(),
  })
  .passthrough()

const quoteSchema = z
  .object({
    id: z.string().optional(),
    itemReferenceIds: z.array(z.string()).optional(),
    fulfillmentCountry: z.string().optional(),
    shipmentMethods: z.array(shipmentMethodSchema),
  })
  .passthrough()

export const quoteResponseSchema = z
  .object({
    orderReferenceId: z.string().optional(),
    quotes: z.array(quoteSchema),
  })
  .passthrough()

export type GelatoQuoteResponse = z.infer<typeof quoteResponseSchema>
export type GelatoShipmentMethod = z.infer<typeof shipmentMethodSchema>

export class GelatoError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'GelatoError'
  }
}

export type GelatoCreateOrderRequest = {
  orderType: 'order' | 'draft'
  orderReferenceId: string
  customerReferenceId: string
  currency: string
  items: {
    itemReferenceId: string
    productUid: string
    quantity: number
    pageCount?: number
    files: { type: string; url: string }[]
  }[]
  shipmentMethodUid?: string
  shippingAddress: GelatoAddress
}

export const createOrderResponseSchema = z
  .object({
    id: z.string(),
    orderReferenceId: z.string().optional(),
    fulfillmentStatus: z.string().optional(),
  })
  .passthrough()
export type GelatoCreateOrderResponse = z.infer<typeof createOrderResponseSchema>

/** Header Gelato sends with our webhook secret (Gelato → Developer → Webhooks → Authorization). */
export const GELATO_SECRET_HEADER = 'x-kidzlim-webhook-secret'

const fulfillmentSchema = z
  .object({
    trackingCode: z.string().nullable().optional(),
    trackingUrl: z.string().nullable().optional(),
    shipmentMethodName: z.string().nullable().optional(),
  })
  .passthrough()

/** Shared by GET /v4/orders/{id} and the order_status_updated webhook body. */
export const gelatoOrderSchema = z
  .object({
    id: z.string().optional(),
    orderId: z.string().optional(),
    orderReferenceId: z.string().optional(),
    fulfillmentStatus: z.string().optional(),
    items: z
      .array(
        z
          .object({
            itemReferenceId: z.string().optional(),
            fulfillmentStatus: z.string().optional(),
            fulfillments: z.array(fulfillmentSchema).nullable().optional(),
          })
          .passthrough(),
      )
      .nullable()
      .optional(),
  })
  .passthrough()
export type GelatoOrder = z.infer<typeof gelatoOrderSchema>

export interface GelatoClient {
  quote(request: GelatoQuoteRequest, opts?: { idempotencyKey?: string }): Promise<GelatoQuoteResponse>
  createOrder(request: GelatoCreateOrderRequest, opts: { idempotencyKey: string }): Promise<GelatoCreateOrderResponse>
  getOrder(gelatoOrderId: string): Promise<GelatoOrder>
  /** Only possible before production starts; Gelato returns an error afterwards. */
  cancelOrder(gelatoOrderId: string): Promise<void>
  /** Harmless authenticated call used by "Test connection" (Gelato product catalogue). */
  listCatalogs(): Promise<number>
}

export function createGelatoClient({
  apiKey,
  baseUrl = 'https://order.gelatoapis.com',
  fetchImpl = fetch,
  timeoutMs = 15_000,
}: {
  apiKey: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): GelatoClient {
  async function call<T>(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    label: string,
    idempotencyKey?: string,
  ): Promise<T> {
    let res: Response
    try {
      res = await fetchImpl(path.startsWith('https://') ? path : `${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
    } catch (err) {
      throw new GelatoError(`Gelato request failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    const json: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const message =
        json && typeof json === 'object' && 'message' in json && typeof json.message === 'string' ? json.message : res.statusText
      throw new GelatoError(`Gelato ${label} failed (${res.status}): ${message}`, res.status)
    }

    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      throw new GelatoError(`Unexpected Gelato ${label} response: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
    }
    return parsed.data
  }

  const id = (gelatoOrderId: string) => encodeURIComponent(gelatoOrderId)
  const productBase = baseUrl.replace('order.gelatoapis.com', 'product.gelatoapis.com')

  return {
    quote: (request, opts) => call('POST', '/v4/orders:quote', request, quoteResponseSchema, 'quote', opts?.idempotencyKey),
    createOrder: (request, opts) =>
      call('POST', '/v4/orders', request, createOrderResponseSchema, 'order', opts.idempotencyKey),
    getOrder: (gelatoOrderId) => call('GET', `/v4/orders/${id(gelatoOrderId)}`, null, gelatoOrderSchema, 'get order'),
    cancelOrder: async (gelatoOrderId) => {
      await call('POST', `/v4/orders/${id(gelatoOrderId)}:cancel`, {}, z.unknown(), 'cancel', `gelato-cancel-${gelatoOrderId}`)
    },
    listCatalogs: async () => {
      const res = await call(
        'GET',
        `${productBase}/v3/catalogs`,
        null,
        z.union([z.array(z.unknown()), z.object({ data: z.array(z.unknown()) }).passthrough()]),
        'catalog',
      )
      return Array.isArray(res) ? res.length : res.data.length
    },
  }
}

/**
 * Development-only stand-in so the checkout UI can be exercised without a Gelato key.
 * Enabled with GELATO_MOCK=1 and never in production.
 */
export function createMockGelatoClient(): GelatoClient {
  return {
    async listCatalogs() {
      return 3
    },
    async getOrder() {
      // The mock has no order store: callers fall back to the (authenticated) webhook body.
      throw new GelatoError('getOrder is not available in mock mode', 501)
    },
    async cancelOrder(gelatoOrderId) {
      if (process.env.GELATO_MOCK_CANCEL_FAILS === '1') {
        throw new GelatoError(`Gelato cancel failed (409): Order ${gelatoOrderId} is already in production`, 409)
      }
    },
    async createOrder(request) {
      return { id: `mock-gelato-${request.orderReferenceId}`, orderReferenceId: request.orderReferenceId, fulfillmentStatus: 'created' }
    },
    async quote(request) {
      const units = request.products.reduce((n, p) => n + p.quantity, 0)
      return {
        quotes: [
          {
            id: 'mock-quote',
            itemReferenceIds: request.products.map((p) => p.itemReferenceId),
            fulfillmentCountry: request.recipient.country,
            shipmentMethods: [
              { shipmentMethodUid: 'mock_standard', name: 'Standard (mock)', price: 18 + 4 * (units - 1), currency: request.currency, minDeliveryDays: 5, maxDeliveryDays: 8 },
              { shipmentMethodUid: 'mock_express', name: 'Express (mock)', price: 39 + 6 * (units - 1), currency: request.currency, minDeliveryDays: 2, maxDeliveryDays: 3 },
            ],
          },
        ],
      }
    },
  }
}
