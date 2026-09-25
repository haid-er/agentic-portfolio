/**
 * Homepage: renders enabled sections in content order (content/site.json -> sections).
 * Add a section = add its id to SECTION_IDS (schema) + a component here.
 */
import type { ReactNode } from 'react'
import About from '@/components/sections/About'
import Achievements from '@/components/sections/Achievements'
import Certifications from '@/components/sections/Certifications'
import Contact from '@/components/sections/Contact'
import Education from '@/components/sections/Education'
import Experience from '@/components/sections/Experience'
import GitHubActivity from '@/components/sections/GitHubActivity'
import Hero from '@/components/sections/Hero'
import Projects from '@/components/sections/Projects'
import Research from '@/components/sections/Research'
import Resume from '@/components/sections/Resume'
import Services from '@/components/sections/Services'
import Skills from '@/components/sections/Skills'
import Testimonials from '@/components/sections/Testimonials'
import type { SectionProps } from '@/components/sections/types'
import FeaturedDemo from '@/components/playground/FeaturedDemo'
import { getSections, type SectionId } from '@/lib/content'
import { folio } from '@/lib/utils'

type SectionComponent = (props: SectionProps) => ReactNode | Promise<ReactNode>

const SECTION_COMPONENTS: Record<SectionId, SectionComponent> = {
  hero: Hero,
  about: About,
  experience: Experience,
  skills: Skills,
  projects: Projects,
  playground: FeaturedDemo,
  research: Research,
  education: Education,
  certifications: Certifications,
  achievements: Achievements,
  services: Services,
  testimonials: Testimonials,
  github: GitHubActivity,
  resume: Resume,
  contact: Contact,
}

export default function HomePage() {
  return (
    <>
      {getSections().map((section, i) => {
        const Component = SECTION_COMPONENTS[section.id]
        return <Component key={section.id} section={section} folio={folio(i + 1)} />
      })}
    </>
  )
}
