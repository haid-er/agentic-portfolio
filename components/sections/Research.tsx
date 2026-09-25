/** Research block (DESIGN.md 6.5). STUB — owner: credentials. */
import { SectionShell } from '@/components/ui'
import { getResearch } from '@/lib/content'
import type { SectionProps } from './types'

export default function Research({ section, folio }: SectionProps) {
  const { items } = getResearch()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Research'} note={section.note}>
      <ul className="grid gap-4 list-none m-0 p-0">
        {items.map((r) => <li key={r.id} className="display text-3">{r.title}</li>)}
      </ul>
    </SectionShell>
  )
}
