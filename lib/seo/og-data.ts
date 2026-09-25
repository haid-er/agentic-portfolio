/**
 * Content -> share-card data. Owner: seo-theme.
 * Cards always print in Almanac (the world that reads light), with admin token
 * overrides applied, so link previews look like the printed page.
 */
import { getEducation, getExperience, getProfile, getSite, getTheme } from '@/lib/content'
import { worldTokens } from '@/lib/theme/tokens'
import { formatPartialDate } from '@/lib/utils'
import type { OgCard, OgLayer } from './og'
import { displayHost } from './url'

/** "Euthyna (Terra Instinct)" -> "Euthyna"; "Punjab University College … (PUCIT), …" -> "PUCIT". */
export function shortOrg(name: string): string {
  const acronym = name.match(/\(([A-Z][A-Z0-9&]{1,9})\)/)?.[1]
  if (acronym) return acronym
  return name.replace(/\s*\([^)]*\)/g, '').split(',')[0].trim()
}

/** The career as sediment, newest on top (the hero's core sample, DESIGN.md 6.1). */
export function careerLayers(limit = 6): OgLayer[] {
  const rows = [
    ...getExperience().map((e) => ({ start: e.start, label: shortOrg(e.org) })),
    ...getEducation().map((e) => ({ start: e.start, label: shortOrg(e.institution) })),
  ].filter((r) => r.start)
  return rows
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, limit)
    .map((r) => ({ year: formatPartialDate(r.start), label: r.label }))
}

/** Shared furniture: palette, masthead strip, edition label and host. */
export function ogFurniture(): Pick<OgCard, 'colors' | 'edition' | 'location' | 'strapline' | 'host'> {
  const site = getSite()
  const theme = getTheme()
  return {
    colors: worldTokens(theme, 'almanac'),
    edition: theme.themes.almanac.label,
    location: site.masthead.location || site.profile.location,
    strapline: site.masthead.strapline,
    host: displayHost(),
  }
}

/** Strip the `*em*` markers used in hero copy. */
const plain = (s: string) => s.replace(/\*([^*]+)\*/g, '$1')

/** The home page card: name, role and the core-sample plate. */
export function siteOgCard(): OgCard {
  const site = getSite()
  const p = getProfile()
  const ogImage = site.seo.ogImage
  return {
    ...ogFurniture(),
    kicker: site.hero.kicker,
    title: p.name,
    subtitle: plain(site.hero.role || p.headline || p.tagline),
    footer: 'Proof: /playground →',
    layers: careerLayers(),
    plateTitle: site.hero.plateTitle,
    plateNote: site.hero.plateNote,
    backdrop: ogImage && /\.(png|jpe?g)(\?|$)/i.test(ogImage) ? ogImage : undefined,
  }
}

/** An inner-page card (project, demo): kicker, title, summary and proof chips. */
export function pageOgCard(page: {
  kicker: string[]
  title: string
  summary?: string
  chips?: string[]
  chipsTitle?: string
  path: string
}): OgCard {
  return {
    ...ogFurniture(),
    kicker: page.kicker,
    title: page.title,
    subtitle: page.summary && page.summary.length > 150 ? `${page.summary.slice(0, 147).trimEnd()}…` : page.summary,
    footer: `Proof: ${page.path} →`,
    chips: page.chips,
    chipsTitle: page.chipsTitle,
  }
}
