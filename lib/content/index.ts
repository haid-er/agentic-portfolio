/**
 * Typed, validated content getters.
 *
 * content/*.json is imported statically and parsed with the zod schemas at
 * module load, so invalid content fails `next build` (and every page that
 * imports it). On Vercel, admin saves commit JSON to GitHub, which redeploys.
 *
 * Site code: use the `get*()` getters; they return only `enabled` items.
 * Admin code: use `COLLECTIONS` + `getRawCollection()` (includes disabled items).
 */
import type { z } from 'zod'
import { SCHEMAS, type CollectionData, type CollectionName, type SectionId } from './schema'

import siteJson from '@/content/site.json'
import themeJson from '@/content/theme.json'
import skillsJson from '@/content/skills.json'
import experienceJson from '@/content/experience.json'
import projectsJson from '@/content/projects.json'
import researchJson from '@/content/research.json'
import educationJson from '@/content/education.json'
import certificationsJson from '@/content/certifications.json'
import achievementsJson from '@/content/achievements.json'
import servicesJson from '@/content/services.json'
import testimonialsJson from '@/content/testimonials.json'
import resumeJson from '@/content/resume.json'
import playgroundJson from '@/content/playground.json'
import aiJson from '@/content/ai.json'

export * from './schema'

/* ------------------------------------------------------------------ */
/* collection registry (reused by /admin)                              */
/* ------------------------------------------------------------------ */

export interface CollectionMeta<N extends CollectionName = CollectionName> {
  name: N
  /** Path relative to repo root; also the GitHub Contents API path. */
  file: `content/${N}.json`
  label: string
  description: string
  /** 'list' collections are `{ items: [...] }` (+ optional extra fields). */
  kind: 'object' | 'list'
  schema: (typeof SCHEMAS)[N]
}

const meta = <N extends CollectionName>(
  name: N,
  label: string,
  description: string,
  kind: 'object' | 'list',
): CollectionMeta<N> => ({ name, file: `content/${name}.json`, label, description, kind, schema: SCHEMAS[name] })

export const COLLECTIONS: { [N in CollectionName]: CollectionMeta<N> } = {
  site: meta('site', 'Site & profile', 'Profile, hero, about, contact, socials, section order + visibility, SEO, analytics', 'object'),
  theme: meta('theme', 'Themes', 'Names, swap labels and tokens of both printed worlds', 'object'),
  skills: meta('skills', 'Skills', 'Skill chips, pillars, levels and proof demos', 'list'),
  experience: meta('experience', 'Experience', 'Roles and highlights with proof demos', 'list'),
  projects: meta('projects', 'Projects', 'Project cards and detail pages', 'list'),
  research: meta('research', 'Research', 'Publications, results and the neighbouring pipeline', 'list'),
  education: meta('education', 'Education', 'Degrees and schooling', 'list'),
  certifications: meta('certifications', 'Certifications', 'Certificates with verify links', 'list'),
  achievements: meta('achievements', 'Achievements', 'Awards, competitions, talks', 'list'),
  services: meta('services', 'Services', 'What he can be hired for', 'list'),
  testimonials: meta('testimonials', 'Testimonials', 'Quotes (section hidden when none enabled)', 'list'),
  resume: meta('resume', 'Résumé', 'Résumé page and PDF', 'object'),
  playground: meta('playground', 'Playground', 'Per-demo visibility, copy overrides, featured demo', 'object'),
  ai: meta('ai', 'AI providers', 'Provider toggles, models, token and rate limits', 'object'),
}

/* ------------------------------------------------------------------ */
/* parse at module load: invalid content fails the build               */
/* ------------------------------------------------------------------ */

function parse<N extends CollectionName>(name: N, raw: unknown): CollectionData<N> {
  const res = (SCHEMAS[name] as z.ZodType).safeParse(raw)
  if (!res.success) {
    const issues = res.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
    throw new Error(`Invalid content/${name}.json:\n${issues}`)
  }
  return res.data as CollectionData<N>
}

const DATA: { [N in CollectionName]: CollectionData<N> } = {
  site: parse('site', siteJson),
  theme: parse('theme', themeJson),
  skills: parse('skills', skillsJson),
  experience: parse('experience', experienceJson),
  projects: parse('projects', projectsJson),
  research: parse('research', researchJson),
  education: parse('education', educationJson),
  certifications: parse('certifications', certificationsJson),
  achievements: parse('achievements', achievementsJson),
  services: parse('services', servicesJson),
  testimonials: parse('testimonials', testimonialsJson),
  resume: parse('resume', resumeJson),
  playground: parse('playground', playgroundJson),
  ai: parse('ai', aiJson),
}

/** Admin only: the full collection including disabled/unverified items. */
export function getRawCollection<N extends CollectionName>(name: N): CollectionData<N> {
  return DATA[name]
}

/** Validate arbitrary data against a collection schema (admin save path). */
export function validateCollection<N extends CollectionName>(name: N, data: unknown) {
  return (SCHEMAS[name] as z.ZodType).safeParse(data) as
    | { success: true; data: CollectionData<N> }
    | { success: false; error: z.ZodError }
}

/* ------------------------------------------------------------------ */
/* site getters (enabled items only)                                   */
/* ------------------------------------------------------------------ */

type Enabled = { enabled: boolean }
export const visible = <T extends Enabled>(items: readonly T[]): T[] => items.filter((i) => i.enabled)

export const getSite = () => DATA.site
export const getProfile = () => DATA.site.profile
export const getSocials = () => visible(DATA.site.socials)
export const getSeo = () => DATA.site.seo
export const getTheme = () => DATA.theme

/** Enabled sections in render order. */
export const getSections = () => visible(DATA.site.sections)
export const isSectionEnabled = (id: SectionId) => getSections().some((s) => s.id === id)
export const getSection = (id: SectionId) => DATA.site.sections.find((s) => s.id === id)

export const getSkills = () => visible(DATA.skills.items)
export const getExperience = () => visible(DATA.experience.items)
export const getProjects = () => visible(DATA.projects.items)
export const getProject = (slug: string) => getProjects().find((p) => p.slug === slug)
export const getResearch = () => ({ ...DATA.research, items: visible(DATA.research.items) })
export const getEducation = () => visible(DATA.education.items)
export const getCertifications = () => visible(DATA.certifications.items)
export const getAchievements = () => visible(DATA.achievements.items)
export const getServices = () => visible(DATA.services.items)
export const getTestimonials = () => visible(DATA.testimonials.items)
export const getResume = () => DATA.resume
export const getPlayground = () => DATA.playground
export const getAiConfig = () => DATA.ai

/** Public project links: the repo link is dropped when the project is private. */
export function projectLinks(p: CollectionData<'projects'>['items'][number]) {
  return { live: p.links.live || undefined, repo: p.private ? undefined : p.links.repo || undefined }
}
