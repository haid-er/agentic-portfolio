/** Filterable project grid. STUB — owner: projects. */
import Link from 'next/link'
import { Card, SectionShell } from '@/components/ui'
import { getProjects } from '@/lib/content'
import type { SectionProps } from './types'

export default function Projects({ section, folio }: SectionProps) {
  const items = getProjects()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Projects'} note={section.note}>
      <ul className="grid gap-4 md:grid-cols-2 list-none m-0 p-0">
        {items.map((p) => (
          <li key={p.id}>
            <Card>
              <h3 className="text-3"><Link href={`/projects/${p.slug}`}>{p.title}</Link></h3>
              <p className="text-0 text-ink-2">{p.summary}</p>
            </Card>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
