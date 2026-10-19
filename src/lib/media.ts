import type { Media } from '@/payload-types'

/** Upload fields are either a populated Media doc or just its id (depth 0). */
export type MediaRef = number | Media | null | undefined

export function asMedia(ref: MediaRef): Media | null {
  return ref && typeof ref === 'object' ? ref : null
}

type Size = 'thumbnail' | 'card' | 'hero'

/**
 * Payload returns absolute URLs when `serverURL` is set; strip the origin so
 * next/image treats them as local (`/api/media/file/**`) on any host.
 */
const toPath = (url: string) => (url.startsWith('/') ? url : new URL(url).pathname)

/** Best URL for the requested size, falling back to the original upload. */
export function mediaUrl(ref: MediaRef, size?: Size): string | null {
  const media = asMedia(ref)
  if (!media) return null
  const url = (size && media.sizes?.[size]?.url) || media.url
  return url ? toPath(url) : null
}
