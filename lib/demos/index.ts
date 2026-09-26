/**
 * Demo catalogue for the site: registry metadata merged with admin overrides
 * from content/playground.json. Hidden demos are excluded entirely (DESIGN.md 10).
 */
import { getPlayground, getSkills } from '@/lib/content'
import { DEMOS, getDemoMeta, type DemoMeta, type DemoSlug } from './registry'
import { DEMO_NOTES } from './notes'
import type { DemoNotes } from './types'

export * from './registry'
export type { DemoNotes, DemoProps } from './types'

export interface Demo extends DemoMeta {
  notes: DemoNotes
  /** Skill names from content/skills.json that point at this demo. */
  provenBy: string[]
}

function merge(meta: DemoMeta): Demo {
  const o = getPlayground().demos.find((d) => d.slug === meta.slug)
  return {
    ...meta,
    title: o?.title || meta.title,
    summary: o?.summary || meta.summary,
    mirrors: o?.mirrors || meta.mirrors,
    skills: o?.skills?.length ? o.skills : meta.skills,
    mobile: o?.mobileNote?.trim() ? { ok: false, reason: o.mobileNote.trim() } : meta.mobile,
    notes: o?.limits?.length ? { ...DEMO_NOTES[meta.slug], limits: o.limits } : DEMO_NOTES[meta.slug],
    provenBy: getSkills().filter((s) => s.demoSlugs.includes(meta.slug)).map((s) => s.name),
  }
}

/** A demo is visible unless content/playground.json disables it. */
export function isDemoEnabled(slug: DemoSlug): boolean {
  const o = getPlayground().demos.find((d) => d.slug === slug)
  return o ? o.enabled : true
}

/** Visible demos in registry order. */
export function getDemos(): Demo[] {
  return DEMOS.filter((d) => isDemoEnabled(d.slug)).map(merge)
}

/** A visible demo by slug, or undefined (hidden or unknown -> 404). */
export function getDemo(slug: string): Demo | undefined {
  const meta = getDemoMeta(slug)
  return meta && isDemoEnabled(meta.slug) ? merge(meta) : undefined
}

/** The homepage featured demo (falls back to the first visible one). */
export function getFeaturedDemo(): Demo | undefined {
  return getDemo(getPlayground().featured) ?? getDemos()[0]
}
