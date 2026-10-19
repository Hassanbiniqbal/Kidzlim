import { z } from 'zod'

/**
 * Thin typed wrapper around Brevo transactional email (POST /v3/smtp/email, template-based).
 * Templates live in Brevo; we send only the template id and params.
 */

export type BrevoTemplateEmail = {
  templateId: number
  to: { email: string; name?: string }
  params: Record<string, unknown>
  sender?: { name: string; email: string }
  replyTo?: { email: string; name?: string }
  tags?: string[]
}

export class BrevoError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'BrevoError'
  }
}

export type BrevoAccount = { email: string; companyName?: string; plan?: string }
export type BrevoTemplate = { id: number; name: string; isActive: boolean }

export interface BrevoClient {
  sendTemplate(email: BrevoTemplateEmail): Promise<{ messageId: string }>
  /** Harmless authenticated call used by "Test connection" (brief §6). */
  getAccount(): Promise<BrevoAccount>
  getTemplate(id: number): Promise<BrevoTemplate | null>
}

const accountSchema = z
  .object({ email: z.string(), companyName: z.string().optional(), plan: z.array(z.object({ type: z.string() }).passthrough()).optional() })
  .passthrough()
const templateSchema = z.object({ id: z.number(), name: z.string(), isActive: z.boolean() }).passthrough()

const sendResponseSchema = z.object({ messageId: z.string() }).passthrough()

export function createBrevoClient({
  apiKey,
  baseUrl = 'https://api.brevo.com/v3',
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: {
  apiKey: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): BrevoClient {
  return {
    async sendTemplate(email) {
      let res: Response
      try {
        res = await fetchImpl(`${baseUrl}/smtp/email`, {
          method: 'POST',
          headers: { 'api-key': apiKey, accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId: email.templateId,
            to: [email.to],
            params: email.params,
            ...(email.sender ? { sender: email.sender } : {}),
            ...(email.replyTo ? { replyTo: email.replyTo } : {}),
            ...(email.tags?.length ? { tags: email.tags } : {}),
          }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: 'no-store',
        })
      } catch (err) {
        throw new BrevoError(`Brevo request failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : res.statusText
        throw new BrevoError(`Brevo send failed (${res.status}): ${message}`, res.status)
      }
      const parsed = sendResponseSchema.safeParse(body)
      if (!parsed.success) throw new BrevoError('Unexpected Brevo response')
      return { messageId: parsed.data.messageId }
    },

    async getAccount() {
      const body = await get('/account', 'account')
      const parsed = accountSchema.safeParse(body)
      if (!parsed.success) throw new BrevoError('Unexpected Brevo account response')
      return { email: parsed.data.email, companyName: parsed.data.companyName, plan: parsed.data.plan?.[0]?.type }
    },

    async getTemplate(id) {
      try {
        const parsed = templateSchema.safeParse(await get(`/smtp/templates/${id}`, 'template'))
        return parsed.success ? { id: parsed.data.id, name: parsed.data.name, isActive: parsed.data.isActive } : null
      } catch (err) {
        if (err instanceof BrevoError && err.status === 404) return null
        throw err
      }
    },
  }

  async function get(path: string, label: string): Promise<unknown> {
    let res: Response
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        headers: { 'api-key': apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
    } catch (err) {
      throw new BrevoError(`Brevo request failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const message =
        body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : res.statusText
      throw new BrevoError(`Brevo ${label} failed (${res.status}): ${message}`, res.status)
    }
    return body
  }
}

/** Development stand-in: logs instead of sending. Enabled with BREVO_MOCK=1, never in production. */
export function createMockBrevoClient(): BrevoClient {
  return {
    async getAccount() {
      return { email: 'mock@kidzlim.test', companyName: 'Kidzlim (mock)', plan: 'free' }
    },
    async getTemplate(id) {
      return { id, name: `Mock template ${id}`, isActive: true }
    },
    async sendTemplate(email) {
      console.info(`[brevo:mock] template ${email.templateId} → ${email.to.email}`, JSON.stringify(email.params))
      return { messageId: `mock-${Date.now()}` }
    },
  }
}
