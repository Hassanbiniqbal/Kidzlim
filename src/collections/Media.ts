import path from 'path'
import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrStaff } from '../access/roles'
import { env } from '../env'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
  },
  access: {
    read: anyone,
    create: isAdminOrStaff,
    update: isAdminOrStaff,
    delete: isAdminOrStaff,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    // Mounted volume in Docker (MEDIA_DIR=/app/media); ./media locally.
    staticDir: path.resolve(env.MEDIA_DIR),
    // Raster images only. SVG is excluded on purpose: it can carry scripts and is served from
    // this site's own origin, so an uploaded SVG could run code in an admin's browser.
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    imageSizes: [
      { name: 'thumbnail', width: 400 },
      { name: 'card', width: 800 },
      { name: 'hero', width: 1600 },
    ],
    adminThumbnail: 'thumbnail',
  },
}
