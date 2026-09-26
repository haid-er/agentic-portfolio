/**
 * Web app manifest. Owner: seo-theme.
 * Names come from content/site.json; colours from the Almanac world's tokens
 * (admin overrides included), so an installed app opens on the same cream stock.
 * Icons are served by app/icon.tsx (/icon/192, /icon/512) and app/apple-icon.tsx.
 */
import type { MetadataRoute } from 'next'
import { getProfile, getSection, getSeo, getTheme } from '@/lib/content'
import { manifestIcons } from '@/lib/seo/icon'
import { worldTokens } from '@/lib/theme'

export default function manifest(): MetadataRoute.Manifest {
  const seo = getSeo()
  const profile = getProfile()
  const paper = worldTokens(getTheme(), 'almanac')
  const shortcut = (id: 'playground' | 'resume', url: string) => {
    const s = getSection(id)
    const name = s?.navLabel || s?.title
    return s?.enabled && name ? [{ name, url }] : []
  }
  return {
    id: '/',
    name: seo.title,
    short_name: profile.name,
    description: seo.description,
    lang: 'en',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: paper['--bg'],
    theme_color: paper['--bg'],
    icons: manifestIcons(),
    categories: ['portfolio', 'developer', 'education'],
    shortcuts: [...shortcut('playground', '/playground'), ...shortcut('resume', '/resume')],
  }
}
