import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import fs from 'fs'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { isAdmin } from './access/roles'
import { AuditLog } from './collections/AuditLog'
import { Books } from './collections/Books'
import { Media } from './collections/Media'
import { Orders } from './collections/Orders'
import { Pages } from './collections/Pages'
import { ProtectedFiles } from './collections/ProtectedFiles'
import { Series } from './collections/Series'
import { Users } from './collections/Users'
import { WebhookEvents } from './collections/WebhookEvents'
import { env, isSqliteUrl } from './env'
import { Settings } from './globals/Settings'
import { fulfilmentTasks } from './jobs/fulfilment'
import { migrations as postgresMigrations } from './migrations'
import { migrations as sqliteMigrations } from './migrations-sqlite'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * The database follows DATABASE_URL: `file:/path/kidzlim.db` → SQLite (Hostinger Node.js hosting,
 * local dev), `postgres://…` → PostgreSQL (Docker/VPS). Each has its own committed migrations,
 * applied on boot in production; dev uses schema push.
 */
function database() {
  if (isSqliteUrl(env.DATABASE_URL)) {
    const file = env.DATABASE_URL.replace(/^file:(\/\/)?/, '')
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }) // libsql won't create folders
    return sqliteAdapter({
      client: { url: env.DATABASE_URL },
      migrationDir: path.resolve(dirname, 'migrations-sqlite'),
      prodMigrations: sqliteMigrations,
    })
  }
  return postgresAdapter({
    pool: { connectionString: env.DATABASE_URL },
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: postgresMigrations,
  })
}

export default buildConfig({
  serverURL: env.NEXT_PUBLIC_SERVER_URL,
  admin: {
    user: Users.slug,
    theme: 'dark',
    // Built-in avatar instead of Gravatar: no third-party image requests (allowed by the CSP) and
    // admins' email hashes aren't sent to Gravatar.
    avatar: 'default',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — Kidzlim Admin',
      icons: [{ rel: 'icon', type: 'image/png', url: '/brand/kidzlim-mascot.png' }],
    },
    components: {
      graphics: {
        Logo: '/components/admin/Logo#Logo',
        Icon: '/components/admin/Icon#Icon',
      },
      // Warns admins on every admin page when a required credential is missing (brief §6).
      header: ['/components/admin/CredentialBanner#CredentialBanner'],
      // Store overview + launch checklist at the top of the dashboard (Phase 8).
      beforeDashboard: ['/components/admin/StoreOverview#StoreOverview'],
    },
  },
  collections: [Books, Series, Orders, Pages, Media, ProtectedFiles, Users, WebhookEvents, AuditLog],
  globals: [Settings],
  jobs: {
    tasks: fulfilmentTasks,
    enableConcurrencyControl: true,
    // No autoRun: jobs are run only by lib/job-runner.ts (one run at a time, every minute plus
    // right after webhooks/admin actions), because overlapping runs can claim the same job.
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      admin: { ...defaultJobsCollection.admin, hidden: ({ user }) => user?.role !== 'admin', group: 'Admin' },
      // Job inputs reference orders; only admins may see or touch the queue (server code uses overrideAccess).
      access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
    }),
  },
  editor: lexicalEditor(),
  // The admin and storefront use the REST/Local API only; an unused GraphQL endpoint is just
  // extra attack surface (expensive nested queries, schema introspection).
  graphQL: { disable: true },
  // Hard cap per upload (print-ready PDFs are the largest files). Images are far smaller.
  upload: { limits: { fileSize: 250 * 1024 * 1024 } },
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: database(),
  sharp,
})
