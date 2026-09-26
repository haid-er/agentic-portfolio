/**
 * Playground view models (server only). Shapes the demo registry + content into
 * small, serialisable objects for the gallery (client) and the demo page.
 * Every visible string comes from content/ or the demo registry.
 */
import {
  getAchievements, getCertifications, getEducation, getExperience, getProfile, getProjects,
  getResearch, getSection, getServices, getSkills, isSectionEnabled, type SectionId,
} from '@/lib/content'
import type { Pillar } from '@/lib/content/schema'
import { PILLARS } from '@/lib/content/schema'
import { getDemos, PILLAR_GLYPH, type Demo, type DemoSlug, type GlyphId } from '@/lib/demos'
import type { PosterKind } from './posters'
import { hash, slugify } from './slug'

export type LayerN = 1 | 2 | 3 | 4 | 5 | 6

/** A skill from content/skills.json that points at a demo. */
export interface SkillRef {
  id: string
  name: string
  pillar: Pillar
  level: 'core' | 'working' | 'exploring'
  slugs: DemoSlug[]
}

export interface PillarOption {
  id: Pillar
  label: string
  summary: string
  glyph: GlyphId
  layer: LayerN
  count: number
}

/** Everything a specimen card needs (serialisable: crosses into the client gallery). */
export interface DemoCardModel {
  slug: DemoSlug
  /** Catalogue number in registry order ("No. 07"). */
  no: number
  title: string
  summary: string
  mirrors: string
  pillar: Pillar
  pillarLabel: string
  glyph: GlyphId
  /** Poster family for the preview (varies within a pillar). */
  poster: PosterKind
  layer: LayerN
  runsIn: Demo['runsIn']
  usesAI: boolean
  mobile: Demo['mobile']
  /** Content skills that name this demo as proof (chips). */
  proves: Pick<SkillRef, 'id' | 'name'>[]
  /** Registry skills (free text), shown when no content skill points here. */
  skills: string[]
  stack: string[]
  /** Lower-case haystack for search. */
  search: string
}

/** Pillars in the order the profile lists them, then any missing ones. */
function pillarOrder(): { id: Pillar; label: string; summary: string }[] {
  const listed = getProfile().pillars.map((p) => ({ id: p.id, label: p.title || p.id, summary: p.summary || '' }))
  const missing = PILLARS.filter((id) => !listed.some((p) => p.id === id)).map((id) => ({ id, label: id, summary: '' }))
  return [...listed, ...missing]
}

export function pillarLabel(id: Pillar): string {
  return pillarOrder().find((p) => p.id === id)?.label ?? id
}

export function pillarLayer(id: Pillar): LayerN {
  const i = pillarOrder().findIndex((p) => p.id === id)
  return (((i < 0 ? 0 : i) % 6) + 1) as LayerN
}

export function glyphOf(d: Pick<Demo, 'glyph' | 'pillar'>): GlyphId {
  return d.glyph ?? PILLAR_GLYPH[d.pillar]
}

/** Explicit registry glyphs keep their poster; pillar defaults pick from a pool by slug. */
const POSTER_POOL: Record<Pillar, PosterKind[]> = {
  fullstack: ['strata', 'columns', 'flow'],
  ai: ['nodes', 'scatter', 'flow'],
  realtime: ['square', 'flow'],
  esg: ['leaf', 'scatter'],
  fundamentals: ['saw', 'columns'],
  craft: ['broadsheet'],
}

export function posterOf(d: Pick<Demo, 'glyph' | 'pillar' | 'slug'>): PosterKind {
  if (d.glyph) return d.glyph
  const pool = POSTER_POOL[d.pillar]
  return pool[hash(d.slug) % pool.length] ?? PILLAR_GLYPH[d.pillar]
}

export function getSkillRefs(): SkillRef[] {
  return getSkills().map((s) => ({ id: s.id, name: s.name, pillar: s.pillar, level: s.level, slugs: s.demoSlugs }))
}

export function toCardModel(d: Demo, no: number, skills = getSkillRefs()): DemoCardModel {
  const proves = skills.filter((s) => s.slugs.includes(d.slug)).map(({ id, name }) => ({ id, name }))
  const label = pillarLabel(d.pillar)
  const search = [d.title, d.summary, d.mirrors, label, d.slug, ...d.skills, ...proves.map((p) => p.name), ...d.notes.stack]
    .join(' ')
    .toLowerCase()
  return {
    slug: d.slug,
    no,
    title: d.title,
    summary: d.summary,
    mirrors: d.mirrors,
    pillar: d.pillar,
    pillarLabel: label,
    glyph: glyphOf(d),
    poster: posterOf(d),
    layer: pillarLayer(d.pillar),
    runsIn: d.runsIn,
    usesAI: d.usesAI,
    mobile: d.mobile,
    proves,
    skills: d.skills,
    stack: d.notes.stack,
    search,
  }
}

/** The whole gallery: cards, pillar filters (with counts) and skill filters. */
export function getGalleryModel() {
  const skills = getSkillRefs()
  const demos = getDemos()
  const cards = demos.map((d, i) => toCardModel(d, i + 1, skills))
  const pillars: PillarOption[] = pillarOrder()
    .map((p) => ({
      id: p.id,
      label: p.label,
      summary: p.summary,
      glyph: PILLAR_GLYPH[p.id],
      layer: pillarLayer(p.id),
      count: cards.filter((c) => c.pillar === p.id).length,
    }))
    .filter((p) => p.count > 0)
  const visible = new Set(cards.map((c) => c.slug))
  const skillOptions = skills
    .map((s) => ({ ...s, slugs: s.slugs.filter((x) => visible.has(x)) }))
    .filter((s) => s.slugs.length > 0)
  return { cards, pillars, skills: skillOptions }
}

/* ------------------------------------------------------------------ */
/* "Where it shows up in the record" (demo page)                       */
/* ------------------------------------------------------------------ */

export interface RecordMention {
  key: string
  /** Section title-ish label, e.g. the org or "Project". */
  kind: string
  title: string
  detail?: string
  href?: string
}

const anchor = (id: SectionId) => `/#${id}`
/** The section's own title from content (falls back to a plain label). */
const sectionLabel = (id: SectionId, fallback: string) => getSection(id)?.title || fallback

/**
 * Every visible content item that names this demo as its proof. Items inside a
 * section the admin has switched off never show up here.
 */
export function getRecordMentions(slug: DemoSlug): RecordMention[] {
  const out: RecordMention[] = []
  if (isSectionEnabled('experience')) {
    for (const e of getExperience()) {
      const hits = e.highlights.filter((h) => h.proofDemo === slug)
      hits.forEach((h, i) => out.push({ key: `exp-${e.id}-${i}`, kind: e.org, title: e.role, detail: h.text, href: anchor('experience') }))
    }
  }
  if (isSectionEnabled('projects')) {
    for (const p of getProjects()) {
      if (p.demoSlugs.includes(slug)) out.push({ key: `proj-${p.id}`, kind: sectionLabel('projects', 'Project'), title: p.title, detail: p.summary || undefined, href: `/projects/${p.slug}` })
    }
  }
  if (isSectionEnabled('research')) {
    const research = getResearch()
    for (const r of research.items) {
      if (r.demoSlugs.includes(slug)) out.push({ key: `res-${r.id}`, kind: [r.venue, r.year].filter(Boolean).join(' · '), title: r.title, href: anchor('research') })
    }
    if (research.pipeline.enabled && research.pipeline.demoSlug === slug && research.pipeline.title) {
      out.push({ key: 'res-pipeline', kind: sectionLabel('research', ''), title: research.pipeline.title, detail: research.pipeline.note || undefined, href: anchor('research') })
    }
  }
  if (isSectionEnabled('education')) {
    for (const ed of getEducation()) {
      if (ed.demoSlugs?.includes(slug)) out.push({ key: `edu-${ed.id}`, kind: ed.institution, title: [ed.degree, ed.field].filter(Boolean).join(', '), href: anchor('education') })
    }
  }
  if (isSectionEnabled('certifications')) {
    for (const c of getCertifications()) {
      if (c.demoSlugs?.includes(slug)) out.push({ key: `cert-${c.id}`, kind: c.issuer, title: c.name, href: anchor('certifications') })
    }
  }
  if (isSectionEnabled('achievements')) {
    for (const a of getAchievements()) {
      if (a.demoSlugs?.includes(slug)) out.push({ key: `ach-${a.id}`, kind: sectionLabel('achievements', ''), title: a.title, detail: a.detail || undefined, href: anchor('achievements') })
    }
  }
  if (isSectionEnabled('services')) {
    for (const s of getServices()) {
      if (s.demoSlugs.includes(slug)) out.push({ key: `svc-${s.id}`, kind: sectionLabel('services', ''), title: s.title, detail: s.summary || undefined, href: anchor('services') })
    }
  }
  return out
}

/** Previous / next visible demo (wrapping) and up to 3 others in the same pillar. */
export function getNeighbours(slug: DemoSlug) {
  const skills = getSkillRefs()
  const demos = getDemos()
  const i = demos.findIndex((d) => d.slug === slug)
  const n = demos.length
  const at = (k: number) => {
    const d = demos[(k + n) % n]
    return d ? toCardModel(d, ((k + n) % n) + 1, skills) : undefined
  }
  const current = demos[i]
  const related = current
    ? demos
        .map((d, k) => ({ d, k }))
        .filter(({ d }) => d.pillar === current.pillar && d.slug !== slug)
        .slice(0, 3)
        .map(({ d, k }) => toCardModel(d, k + 1, skills))
    : []
  return {
    no: i + 1,
    total: n,
    prev: n > 1 ? at(i - 1) : undefined,
    next: n > 1 ? at(i + 1) : undefined,
    related,
  }
}

export { slugify }
