/** Education. STUB — owner: credentials. */
import { SectionShell } from '@/components/ui'
import { getEducation } from '@/lib/content'
import type { SectionProps } from './types'

export default function Education({ section, folio }: SectionProps) {
  const items = getEducation()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Education'} note={section.note}>
      <ul className="grid gap-4 list-none m-0 p-0">
        {items.map((e) => <li key={e.id}><strong>{e.degree}</strong> · {e.institution}</li>)}
      </ul>
    </SectionShell>
  )
}
