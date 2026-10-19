import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  output: 'standalone',
  // Type errors are caught by `npm run typecheck` (run before every push); skipping the check in
  // `next build` keeps the build inside Hostinger's 15-minute / limited-memory build machine.
  typescript: { ignoreBuildErrors: true },
  // scripts/build.mjs sets this from the build machine's real CPU/memory limits.
  ...(process.env.NEXT_BUILD_WORKERS ? { experimental: { cpus: Number(process.env.NEXT_BUILD_WORKERS) } } : {}),
  // Runtime data and secrets must never be traced into the standalone build. Keep these names
  // distinctive: webpack matches them loosely (a './data/**' rule also dropped next's own
  // dist/lib/metadata and broke the server).
  outputFileTracingExcludes: {
    '*': [
      './.env*',
      './deploy/**',
      './protected-media/**',
      './backups/**',
      './src/seed/assets/**',
    ],
  },
  images: {
    localPatterns: [{ pathname: '/api/media/file/**' }, { pathname: '/brand/**' }],
  },
  // Baseline security headers (Phase 8). Nginx terminates TLS; HSTS is only sent in production.
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      ...(process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
        : []),
    ]
    const privatePage = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Cache-Control', value: 'private, no-store' },
    ]
    return [
      { source: '/:path*', headers: security },
      // Personal pages and file links: never cached by proxies, never indexed.
      { source: '/download/:path*', headers: privatePage },
      { source: '/downloads/:path*', headers: privatePage },
      { source: '/checkout/:path*', headers: privatePage },
      { source: '/api/store/:path*', headers: privatePage },
    ]
  },
  // Old static-site URLs → new routes (SEO migration, brief §7).
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/privacy-policy.html', destination: '/privacy-policy', permanent: true },
      { source: '/terms-of-use.html', destination: '/terms-of-use', permanent: true },
      // Common guesses for the shop from the old site and social links.
      { source: '/shop', destination: '/books', permanent: true },
      { source: '/store', destination: '/books', permanent: true },
      { source: '/book/:slug', destination: '/books/:slug', permanent: true },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
