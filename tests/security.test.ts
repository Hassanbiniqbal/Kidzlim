import { afterEach, describe, expect, it } from 'vitest'

import { MIN_PASSWORD_LENGTH, requireStrongPassword } from '@/collections/Users'
import { clientIp, rateLimit } from '@/lib/rate-limit'

const req = (headers: Record<string, string>) => new Request('https://kidzlim.test/api', { headers })

describe('clientIp (rate-limit key)', () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS
  })

  it('ignores a forged first X-Forwarded-For entry and uses the one our proxy added', () => {
    // Client sends "X-Forwarded-For: 1.2.3.4"; the proxy appends the real address.
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('a client rotating fake addresses still lands in one rate-limit bucket', () => {
    const key = (fake: string) => `t:${clientIp(req({ 'x-forwarded-for': `${fake}, 198.51.100.7` }))}`
    const results = Array.from({ length: 6 }, (_, i) => rateLimit(key(`10.0.0.${i}`), 5, 60_000).ok)
    expect(results).toEqual([true, true, true, true, true, false])
  })

  it('supports more than one trusted proxy', () => {
    process.env.TRUSTED_PROXY_HOPS = '2'
    expect(clientIp(req({ 'x-forwarded-for': 'forged, 203.0.113.9, 10.0.0.2' }))).toBe('203.0.113.9')
  })

  it('falls back to X-Real-IP, then "unknown"', () => {
    expect(clientIp(req({ 'x-real-ip': '192.0.2.1' }))).toBe('192.0.2.1')
    expect(clientIp(req({}))).toBe('unknown')
  })
})

describe('admin passwords', () => {
  const run = (password: string) =>
    requireStrongPassword({ data: { password } } as unknown as Parameters<typeof requireStrongPassword>[0])

  it(`rejects passwords shorter than ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(() => run('short-pass')).toThrow()
  })

  it('accepts a long passphrase, and updates that do not change the password', () => {
    expect(() => run('three blue camels sing')).not.toThrow()
    expect(() =>
      requireStrongPassword({ data: { name: 'New name' } } as unknown as Parameters<typeof requireStrongPassword>[0]),
    ).not.toThrow()
  })
})
