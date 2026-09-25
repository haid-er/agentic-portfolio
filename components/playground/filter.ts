/**
 * Gallery filter state <-> URL, and the filtering itself. Pure and client safe.
 * URL: /playground?skill=react&pillar=ai&q=queue&phone=1
 * `skill` accepts a content skill id, a slugified skill name, or a registry skill
 * (free text, slugified), so /playground?skill=x works from anywhere.
 */
import type { Pillar } from '@/lib/content/schema'
import type { DemoCardModel, SkillRef } from './model'
import { slugify } from './slug'

export interface FilterState {
  q: string
  pillar: Pillar | 'all'
  /** Raw ?skill= value ('' = any). */
  skill: string
  phone: boolean
}

export const EMPTY: FilterState = { q: '', pillar: 'all', skill: '', phone: false }

export type ResolvedSkill =
  | { kind: 'none' }
  | { kind: 'skill'; skill: SkillRef }
  | { kind: 'tag'; label: string; key: string }
  | { kind: 'unknown'; raw: string }

export function parseFilters(params: URLSearchParams, pillars: readonly string[]): FilterState {
  const pillar = params.get('pillar') ?? ''
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    pillar: pillars.includes(pillar) ? (pillar as Pillar) : 'all',
    skill: (params.get('skill') ?? '').slice(0, 80),
    phone: params.get('phone') === '1',
  }
}

export function filtersToQuery(f: FilterState): string {
  const p = new URLSearchParams()
  if (f.skill) p.set('skill', f.skill)
  if (f.pillar !== 'all') p.set('pillar', f.pillar)
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.phone) p.set('phone', '1')
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function resolveSkill(raw: string, skills: SkillRef[], cards: DemoCardModel[]): ResolvedSkill {
  const key = slugify(raw)
  if (!key) return { kind: 'none' }
  const skill = skills.find((s) => s.id === raw) ?? skills.find((s) => s.id === key || slugify(s.name) === key)
  if (skill) return { kind: 'skill', skill }
  for (const c of cards) {
    const hit = c.skills.find((s) => slugify(s) === key)
    if (hit) return { kind: 'tag', label: hit, key }
  }
  return { kind: 'unknown', raw }
}

function matchesSkill(c: DemoCardModel, r: ResolvedSkill): boolean {
  switch (r.kind) {
    case 'none': return true
    case 'skill': return r.skill.slugs.includes(c.slug)
    case 'tag': return c.skills.some((s) => slugify(s) === r.key)
    case 'unknown': return false
  }
}

function matchesQuery(c: DemoCardModel, q: string): boolean {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  return terms.every((t) => c.search.includes(t))
}

/** Everything except the pillar filter (used for the per-pillar counts). */
export function baseFilter(cards: DemoCardModel[], f: FilterState, r: ResolvedSkill): DemoCardModel[] {
  return cards.filter((c) => matchesSkill(c, r) && matchesQuery(c, f.q) && (!f.phone || c.mobile.ok))
}

export function applyFilters(cards: DemoCardModel[], f: FilterState, r: ResolvedSkill): DemoCardModel[] {
  return baseFilter(cards, f, r).filter((c) => f.pillar === 'all' || c.pillar === f.pillar)
}

export const isFiltered = (f: FilterState) => Boolean(f.q.trim() || f.skill || f.phone || f.pillar !== 'all')
