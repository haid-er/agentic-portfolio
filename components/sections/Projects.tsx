/**
 * Projects (homepage section): the filterable project grid.
 *
 * Server component: builds serialisable card data from content/projects.json
 * (enabled items only, private repo links dropped by projectLinks) and hands it
 * to the small client grid, which filters by pillar and tag. The first six cards
 * show until "Show all"; /projects is the full index.
 */
import { SectionShell } from '@/components/ui'
import { ProjectGrid } from '@/app/projects/_components/ProjectGrid'
import { getPillarOptions, getProjectCards } from '@/app/projects/_lib/model'
import type { SectionProps } from './types'

const HOME_LIMIT = 6

export default function Projects({ section, folio }: SectionProps) {
  const projects = getProjectCards()
  if (!projects.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Projects'} note={section.note}>
      <ProjectGrid
        projects={projects}
        pillars={getPillarOptions(projects)}
        limit={HOME_LIMIT}
        indexHref="/projects"
      />
    </SectionShell>
  )
}
