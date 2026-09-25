/** Services cards. STUB — owner: services-testimonials. */
import { Card, SectionShell } from '@/components/ui'
import { getServices } from '@/lib/content'
import type { SectionProps } from './types'

export default function Services({ section, folio }: SectionProps) {
  const items = getServices()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Services'} note={section.note}>
      <ul className="grid gap-4 md:grid-cols-3 list-none m-0 p-0">
        {items.map((s) => <li key={s.id}><Card><h3 className="text-2">{s.title}</h3><p className="text-0">{s.summary}</p></Card></li>)}
      </ul>
    </SectionShell>
  )
}
