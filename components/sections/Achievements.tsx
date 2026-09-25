/** Achievements (incl. the Best Graphic Designer stamp). STUB — owner: credentials. */
import { SectionShell } from '@/components/ui'
import { getAchievements } from '@/lib/content'
import type { SectionProps } from './types'

export default function Achievements({ section, folio }: SectionProps) {
  const items = getAchievements()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Achievements'} note={section.note}>
      <ul className="grid gap-2 list-none m-0 p-0">
        {items.map((a) => <li key={a.id}>{a.title}</li>)}
      </ul>
    </SectionShell>
  )
}
