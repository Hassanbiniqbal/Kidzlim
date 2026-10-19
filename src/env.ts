import { z } from 'zod'

/**
 * Infrastructure environment, validated once at startup.
 * Integration credentials (Stripe, Gelato, Brevo) are NOT read here — they go through
 * getCredential() (Settings → env).
 */
export const isSqliteUrl = (url: string) => url.startsWith('file:')

const envSchema = z.object({
  /** `file:/absolute/path/kidzlim.db` (SQLite) or `postgres://user:pass@host:5432/db`. */
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((u) => isSqliteUrl(u) || /^postgres(ql)?:\/\//.test(u), 'Use file:/path/to/kidzlim.db (SQLite) or postgres://… (PostgreSQL)'),
  PAYLOAD_SECRET: z.string().min(32, 'PAYLOAD_SECRET must be at least 32 characters'),
  NEXT_PUBLIC_SERVER_URL: z.string().url().default('http://localhost:3000'),
  MEDIA_DIR: z.string().min(1).default('./media'),
  /** Paid PDFs — must NOT be inside the web root or the public media folder. */
  PROTECTED_MEDIA_DIR: z.string().min(1).default('./protected-media'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`)
}

export const env = parsed.data
