/**
 * Small in-memory fixed-window limiter. Good enough for a single app container;
 * swap for Redis if the app is ever scaled horizontally.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    return { ok: true, retryAfterSec: 0 }
  }
  bucket.count += 1
  return { ok: bucket.count <= limit, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) }
}

/**
 * The visitor's IP for rate limiting. X-Forwarded-For is a list the client can pre-fill, so the
 * FIRST entry is attacker-controlled; each trusted proxy (Hostinger/LiteSpeed, or Nginx on a VPS)
 * appends the address it received the request from. So we read from the RIGHT, skipping
 * TRUSTED_PROXY_HOPS - 1 entries (default 1 proxy in front of the app).
 */
export function clientIp(req: Request): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1)
  const chain = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return chain[chain.length - hops] || req.headers.get('x-real-ip') || 'unknown'
}
