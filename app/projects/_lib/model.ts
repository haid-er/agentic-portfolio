/**
 * Project view model (server safe). Turns content/projects.json items into the
 * small, serialisable shape the cards and the client filter need.
 *
 * - The repo link goes through projectLinks(), so private repos never render.
 * - Proof slugs are limited to demos that are visible in the playground.
 * - Pillar labels come from site.profile.pillars; nothing here is hard-coded copy.
 */
import type { Layer } from '@/components/ui'
import { PILLARS, getProfile, getProjects, projectLinks, type Pillar, type Project } from '@/lib/content'
import { PILLAR_GLYPH, isDemoEnabled, type DemoSlug, type GlyphId } from '@/lib/demos'
import { formatPartialDate, formatRange } from '@/lib/utils'

export interface OutcomeView {
  /** Plain text as written in content. */
  text: string
  /** Set when the outcome reads "label from → to" (the one metric treatment). */
  metric?: { from: string; to: string; label: string }
}

export interface ProjectCardData {
  slug: string
  title: string
  summary: string
  role: string
  pillar: Pillar
  pillarLabel: string
  glyph: GlyphId
  layer: Layer
  range: string
  tags: string[]
  stack: string[]
  outcome?: OutcomeView
  live?: string
  repo?: string
  private: boolean
  featured: boolean
  learning: boolean
  proofs: DemoSlug[]
}

export interface PillarOption {
  id: Pillar
  label: string
  glyph: GlyphId
  count: number
}

/** Pillar -> Strata layer colour (1-6), in schema order so it never shifts. */
export function pillarLayer(p: Pillar): Layer {
  return ((PILLARS.indexOf(p) % 6) + 1) as Layer
}

export function pillarLabel(p: Pillar): string {
  return getProfile().pillars.find((x) => x.id === p)?.title ?? ''
}

/** "Response time 27s → 3.5s" -> metric; anything else stays text. */
export function parseOutcome(outcome: string | undefined): OutcomeView | undefined {
  const text = outcome?.trim()
  if (!text) return undefined
  const m = /^(.*?)\s*([^\s→]+)\s*→\s*([^\s→]+)$/.exec(text)
  if (m && m[2] && m[3]) return { text, metric: { label: (m[1] ?? '').trim(), from: m[2], to: m[3] } }
  return { text }
}

/**
 * "Aug 2022 – Jan 2023", "May 2025", or "" when undated.
 * A project without an end date shows its start only: unlike experience, a
 * missing project end does not mean "present", so nothing is implied. Only an
 * explicit `ongoing: true` shows "– Present".
 */
export function projectRange(p: Pick<Project, 'start' | 'end' | 'ongoing'>): string {
  if (p.ongoing && p.start) return formatRange(p.start, '')
  if (!p.start) return p.end ? formatPartialDate(p.end) : ''
  if (!p.end || p.end === p.start) return formatPartialDate(p.start)
  return formatRange(p.start, p.end)
}

export function visibleProofs(p: Project): DemoSlug[] {
  return p.demoSlugs.filter((s) => isDemoEnabled(s))
}

export function toCardData(p: Project): ProjectCardData {
  const links = projectLinks(p)
  return {
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    role: p.role ?? '',
    pillar: p.pillar,
    pillarLabel: pillarLabel(p.pillar),
    glyph: PILLAR_GLYPH[p.pillar],
    layer: pillarLayer(p.pillar),
    range: projectRange(p),
    tags: p.tags.filter(Boolean),
    stack: p.stack.filter(Boolean),
    outcome: parseOutcome(p.outcome),
    live: links.live,
    repo: links.repo,
    private: p.private,
    featured: p.featured,
    learning: Boolean(p.learning),
    proofs: visibleProofs(p),
  }
}

/** Every enabled project as card data: real work first, learning builds last, otherwise content order. */
export function getProjectCards(): ProjectCardData[] {
  const cards = getProjects().map(toCardData)
  return [...cards.filter((c) => !c.learning), ...cards.filter((c) => c.learning)]
}

/** Pillars that have at least one project, in schema order, with counts. */
export function getPillarOptions(cards: ProjectCardData[]): PillarOption[] {
  return PILLARS.map((id) => ({ id, label: pillarLabel(id), glyph: PILLAR_GLYPH[id], count: cards.filter((c) => c.pillar === id).length }))
    .filter((o) => o.count > 0 && o.label)
}
