/**
 * One place for every homepage section: its component, its "has content" test
 * (the same test as the component's early `return null`) and its fallback title.
 * app/page.tsx renders from it; components/layout/nav.ts uses it so the nav never
 * offers an anchor that is not on the page and never omits one that is.
 */
import type { ReactNode } from 'react'
import { getSections, type SectionId } from '@/lib/content'
import FeaturedDemo, * as playground from '@/components/playground/FeaturedDemo'
import About, * as about from './About'
import Achievements, * as achievements from './Achievements'
import Certifications, * as certifications from './Certifications'
import Contact, * as contact from './Contact'
import Education, * as education from './Education'
import Experience, * as experience from './Experience'
import GitHubActivity, * as github from './GitHubActivity'
import Hero, * as hero from './Hero'
import Projects, * as projects from './Projects'
import Research, * as research from './Research'
import Resume, * as resume from './Resume'
import Services, * as services from './Services'
import Skills, * as skills from './Skills'
import Testimonials, * as testimonials from './Testimonials'
import type { SectionProps } from './types'

export type SectionComponent = (props: SectionProps) => ReactNode | Promise<ReactNode>

export interface SectionEntry {
  Component: SectionComponent
  shouldRender: () => boolean
  defaultTitle: string
}

const entry = (Component: SectionComponent, m: { shouldRender: () => boolean; DEFAULT_TITLE: string }): SectionEntry => ({
  Component,
  shouldRender: m.shouldRender,
  defaultTitle: m.DEFAULT_TITLE,
})

export const SECTIONS: Record<SectionId, SectionEntry> = {
  hero: entry(Hero, hero),
  about: entry(About, about),
  experience: entry(Experience, experience),
  skills: entry(Skills, skills),
  projects: entry(Projects, projects),
  playground: entry(FeaturedDemo, playground),
  research: entry(Research, research),
  education: entry(Education, education),
  certifications: entry(Certifications, certifications),
  achievements: entry(Achievements, achievements),
  services: entry(Services, services),
  testimonials: entry(Testimonials, testimonials),
  github: entry(GitHubActivity, github),
  resume: entry(Resume, resume),
  contact: entry(Contact, contact),
}

/**
 * Enabled sections that actually have something to show, in content order. Folio
 * numbers come from this list, so a hidden or empty section never leaves a gap.
 */
export function renderedSections() {
  return getSections().filter((s) => SECTIONS[s.id].shouldRender())
}
