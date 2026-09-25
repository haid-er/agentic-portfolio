/** Skills grouped by pillar; every chip links to its proof demo. STUB — owner: skills-experience. */
import { ProofChip, SectionShell } from '@/components/ui'
import { getSkills } from '@/lib/content'
import type { SectionProps } from './types'

export default function Skills({ section, folio }: SectionProps) {
  const skills = getSkills()
  if (!skills.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Skills'} note={section.note}>
      <ul className="flex flex-wrap gap-x-3 gap-y-2 list-none m-0 p-0">
        {skills.map((s) => (
          <li key={s.id}><ProofChip skill={s.name} slug={s.demoSlugs[0]!} extra={s.demoSlugs.length - 1} /></li>
        ))}
      </ul>
    </SectionShell>
  )
}
