/**
 * Site share card (1200×630), printed in Almanac. Owner: seo-theme.
 * Everything on it comes from content: name, role, kicker, masthead strip and
 * the core-sample layers. An admin-uploaded `seo.ogImage` (PNG/JPEG) replaces it.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getProfile, getSeo } from '@/lib/content'
import { OG_IMAGE_SIZE, renderOgImage } from '@/lib/seo/og'
import { siteOgCard } from '@/lib/seo/og-data'

export const alt = `${getProfile().name}: ${getProfile().headline || getSeo().title}`
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

/** A site-relative upload becomes a data URI (the renderer cannot fetch its own host at build time). */
async function resolveBackdrop(src?: string): Promise<string | undefined> {
  if (!src) return undefined
  if (/^https?:\/\//.test(src)) return src
  if (!src.startsWith('/') || src.includes('..')) return undefined
  try {
    const file = await readFile(path.join(process.cwd(), 'public', src.split('?')[0]))
    const type = /\.png$/i.test(src.split('?')[0]) ? 'image/png' : 'image/jpeg'
    return `data:${type};base64,${file.toString('base64')}`
  } catch {
    return undefined
  }
}

export default async function OgImage() {
  const card = siteOgCard()
  return renderOgImage({ ...card, backdrop: await resolveBackdrop(card.backdrop) })
}
