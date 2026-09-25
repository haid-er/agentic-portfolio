/**
 * /projects: the full project index (every enabled project, no "Show all" cap).
 * Same grid and filters as the homepage section; titles are h2 here.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/ui'
import { getProfile, getSection } from '@/lib/content'
import { buildMetadata } from '@/lib/seo'
import { ProjectGrid } from './_components/ProjectGrid'
import { getPillarOptions, getProjectCards } from './_lib/model'

function pageCopy() {
  const section = getSection('projects')
  const title = section?.title || 'Projects'
  const name = getProfile().name
  const description = section?.note || `${title} by ${name}. Every project links to a working demo in the playground.`
  return { title, description }
}

export function generateMetadata(): Metadata {
  const { title, description } = pageCopy()
  return buildMetadata({ title, description, path: '/projects' })
}

export default function ProjectsIndexPage() {
  const { title, description } = pageCopy()
  const projects = getProjectCards()
  return (
    <div className="wrap py-s7 md:py-s8 grid gap-s7">
      <header className="grid gap-s4 almanac:border-b-2 almanac:border-rule almanac:pb-s5">
        <nav aria-label="Breadcrumb">
          <Link href="/#projects" className="mono inline-flex min-h-tap items-center gap-2 text-ink-2 no-underline hover:text-ink">
            <Icon name="arrow" size={14} className="rotate-180" />
            Index
          </Link>
        </nav>
        <h1 className="text-[clamp(2.8rem,10vw,6rem)]">{title}</h1>
        <p className="m-0 measure text-2 text-ink-2">{description}</p>
      </header>

      {projects.length ? (
        <ProjectGrid projects={projects} pillars={getPillarOptions(projects)} headingLevel="h2" />
      ) : null}
    </div>
  )
}
