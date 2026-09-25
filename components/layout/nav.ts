/**
 * Navigation model (server only): derived from the enabled sections in
 * content/site.json, the visible demos and projects. Nothing here is hard-coded
 * about Malik; labels come from content or the demo registry.
 */
import type { IconName } from '@/components/ui/Icon'
import {
  getAchievements, getCertifications, getEducation, getExperience, getProfile, getProjects,
  getResearch, getResume, getSection, getSections, getServices, getSkills, getSocials, getTestimonials, getTheme,
  type SectionId,
} from '@/lib/content'
import { getDemos, getFeaturedDemo, PILLAR_GLYPH } from '@/lib/demos'
import { folio } from '@/lib/utils'
import type { IndexEntry, IndexGroup, NavModel, NavSection, ThemeLabels } from './types'
import { socialIcon } from '@/components/ui/Icon'

/** One glyph per section (UI furniture only). */
const SECTION_ICON: Record<SectionId, IconName> = {
  hero: 'register',
  about: 'info',
  experience: 'strata',
  skills: 'leaders',
  projects: 'core',
  playground: 'pulse',
  research: 'sine',
  education: 'doc',
  certifications: 'check',
  achievements: 'register',
  services: 'square',
  testimonials: 'broadsheet',
  github: 'github',
  resume: 'doc',
  contact: 'mail',
}

/**
 * Sections whose component renders nothing when their collection is empty.
 * The nav must not offer an anchor that is not on the page.
 */
function hasContent(id: SectionId): boolean {
  switch (id) {
    case 'experience': return getExperience().length > 0
    case 'skills': return getSkills().length > 0
    case 'projects': return getProjects().length > 0
    case 'playground': return Boolean(getFeaturedDemo())
    case 'research': return getResearch().items.length > 0
    case 'education': return getEducation().length > 0
    case 'certifications': return getCertifications().length > 0
    case 'achievements': return getAchievements().length > 0
    case 'services': return getServices().length > 0
    case 'testimonials': return getTestimonials().length > 0
    case 'resume': return getResume().enabled
    default: return true
  }
}

/** The playground section links to the full gallery; every other section is an anchor. */
const sectionHref = (id: SectionId) => (id === 'playground' ? '/playground' : `/#${id}`)

export function getNavModel(): NavModel {
  const all = getSections()
  const sections: NavSection[] = []
  all.forEach((s, i) => {
    if (s.id === 'hero' || !hasContent(s.id)) return
    const label = (s.navLabel || s.title).trim()
    if (!label) return
    sections.push({
      id: s.id,
      label,
      folio: folio(i + 1),
      href: sectionHref(s.id),
      icon: SECTION_ICON[s.id],
      layer: ((sections.length % 6) + 1) as NavSection['layer'],
    })
  })

  // Admin marks nav-worthy sections by giving them a short navLabel.
  const labelled = sections.filter((s) => Boolean(all.find((x) => x.id === s.id)?.navLabel?.trim()))
  const primary = (labelled.length ? labelled : sections).slice(0, 3)

  const playgroundLabel = getSection('playground')?.navLabel || getSection('playground')?.title || 'Playground'
  const groupLabels: Record<IndexGroup, string> = {
    section: 'Sections',
    demo: playgroundLabel,
    project: getSection('projects')?.title || 'Projects',
    page: 'Pages',
    action: 'Actions',
  }

  const index: IndexEntry[] = [
    ...sections.map<IndexEntry>((s) => ({
      key: `section:${s.id}`,
      group: 'section',
      label: all.find((x) => x.id === s.id)?.title || s.label,
      hint: s.folio,
      icon: s.icon,
      // In the index the playground section is an anchor; the gallery is a page below.
      href: `/#${s.id}`,
      keywords: `${s.label} ${s.id}`,
    })),
    ...getDemos().map<IndexEntry>((d) => ({
      key: `demo:${d.slug}`,
      group: 'demo',
      label: d.title,
      hint: d.slug,
      icon: (d.glyph ?? PILLAR_GLYPH[d.pillar]) as IconName,
      href: `/playground/${d.slug}`,
      keywords: `${d.summary} ${d.skills.join(' ')} ${d.provenBy.join(' ')} ${d.pillar}`,
    })),
    ...getProjects().map<IndexEntry>((p) => ({
      key: `project:${p.slug}`,
      group: 'project',
      label: p.title,
      hint: p.slug,
      icon: 'core',
      href: `/projects/${p.slug}`,
      keywords: `${p.summary} ${p.tags.join(' ')} ${p.stack.join(' ')}`,
    })),
    ...pages(playgroundLabel),
    ...actions(),
  ]

  return { sections, primary, spyIds: all.map((s) => s.id), index, groupLabels }
}

function pages(playgroundLabel: string): IndexEntry[] {
  const out: IndexEntry[] = [
    { key: 'page:home', group: 'page', label: getProfile().name, hint: '/', icon: 'register', href: '/', keywords: 'home front page top' },
    { key: 'page:playground', group: 'page', label: playgroundLabel, hint: '/playground', icon: 'pulse', href: '/playground', keywords: 'demos gallery all' },
  ]
  if (getResume().enabled) {
    out.push({
      key: 'page:resume', group: 'page', label: getSection('resume')?.title || 'Résumé', hint: '/resume',
      icon: 'doc', href: '/resume', keywords: 'resume cv print pdf',
    })
  }
  return out
}

function actions(): IndexEntry[] {
  const email = getProfile().email
  const out: IndexEntry[] = [
    // Label is filled in on the client ("Reprint in {other world}").
    { key: 'action:theme', group: 'action', label: '', hint: 'theme', icon: 'register', action: 'theme', keywords: 'theme world reprint switch colour color' },
  ]
  if (email) {
    out.push({ key: 'action:copy-email', group: 'action', label: 'Copy email address', hint: email, icon: 'copy', action: 'copy', value: email, keywords: 'email mail contact copy' })
  }
  for (const s of getSocials()) {
    if (!s.url) continue
    const external = /^https?:\/\//.test(s.url)
    out.push({
      key: `social:${s.id}`, group: 'action', label: s.label, hint: s.handle || '', icon: socialIcon(s.icon || s.id),
      href: s.url, external, keywords: `social profile ${s.id}`,
    })
  }
  return out
}

/** Both worlds' names and swap labels (content/theme.json). */
export function themeLabels(): ThemeLabels {
  const { themes } = getTheme()
  return {
    almanac: { label: themes.almanac.label, swapLabel: themes.almanac.swapLabel },
    strata: { label: themes.strata.label, swapLabel: themes.strata.swapLabel },
  }
}
