/** Working record ledger (DESIGN.md 6.4). STUB — owner: skills-experience. */
import { ProofRow, SectionShell } from '@/components/ui'
import { getExperience } from '@/lib/content'
import { formatRange } from '@/lib/utils'
import type { SectionProps } from './types'

export default function Experience({ section, folio }: SectionProps) {
  const items = getExperience()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Experience'} note={section.note}>
      <ol className="grid gap-s5 list-none m-0 p-0">
        {items.map((e) => (
          <li key={e.id} className="grid gap-2">
            <span className="mono text-ink-3">{formatRange(e.start, e.end)}</span>
            <h3 className="text-3">{e.role}</h3>
            <p className="m-0 text-ink-2">{e.org}</p>
            <ProofRow slugs={e.highlights.flatMap((h) => (h.proofDemo ? [h.proofDemo] : []))} />
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}
