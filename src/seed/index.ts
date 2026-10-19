/**
 * Seeds launch content: brand artwork, Home / About / Privacy / Terms pages.
 * Safe to re-run — existing pages (matched by slug) and media (by filename) are updated, not duplicated.
 *
 *   npm run seed          # pages + media
 *   npm run seed:books    # also the full book catalogue (97 books, 7 series) with covers
 */
import path from 'path'
import { fileURLToPath } from 'url'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import type { Page } from '../payload-types'
import { aboutLayout, homeLayout, type MediaIds, PAGE_SEO, privacyLayout, termsLayout } from './content'
import { seedCatalogue } from './books'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const asset = (file: string) => path.join(dirname, 'assets', file)

async function upsertMedia(payload: Payload, file: string, alt: string): Promise<number> {
  const existing = await payload.find({
    collection: 'media',
    where: { alt: { equals: alt } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs[0]) return existing.docs[0].id
  const doc = await payload.create({ collection: 'media', data: { alt }, filePath: asset(file) })
  return doc.id
}

async function upsertPage(
  payload: Payload,
  slug: keyof typeof PAGE_SEO,
  title: string,
  layout: NonNullable<Page['layout']>,
) {
  const data = { title, slug, status: 'published' as const, layout, seo: { ...PAGE_SEO[slug] } }
  const existing = await payload.find({ collection: 'pages', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  if (existing.docs[0]) {
    await payload.update({ collection: 'pages', id: existing.docs[0].id, data })
    payload.logger.info(`↻ updated page /${slug}`)
  } else {
    await payload.create({ collection: 'pages', data })
    payload.logger.info(`＋ created page /${slug}`)
  }
}

async function run() {
  const payload = await getPayload({ config })

  const m: MediaIds = {
    treasure: await upsertMedia(payload, 'treasure.jpg', 'Kidzlim children discovering a treasure chest of Islamic books'),
    running: await upsertMedia(payload, 'running.jpg', 'A Kidzlim boy running joyfully through a garden'),
    creativeMonsters: await upsertMedia(payload, 'creative-monsters.jpg', 'Kidzlim Creative Monsters illustration'),
    usmanHusna: await upsertMedia(payload, 'usman-husna.png', 'Usman and Husna, the Kidzlim characters'),
  }

  await upsertPage(payload, 'home', 'Home', homeLayout(m))
  await upsertPage(payload, 'about', 'About Kidzlim', aboutLayout(m))
  await upsertPage(payload, 'privacy-policy', 'Privacy Policy', privacyLayout())
  await upsertPage(payload, 'terms-of-use', 'Terms of Use', termsLayout())

  if (process.env.SEED_BOOKS === '1') await seedCatalogue(payload)

  payload.logger.info('Seed complete.')
  process.exit(0)
}

// `payload run` exits once the module has loaded, so the work must be awaited at top level.
try {
  await run()
} catch (err) {
  console.error(err)
  process.exit(1)
}
