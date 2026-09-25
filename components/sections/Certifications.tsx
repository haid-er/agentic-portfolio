/** Certifications with verify links. STUB — owner: credentials. */
import { SectionShell } from '@/components/ui'
import { getCertifications } from '@/lib/content'
import type { SectionProps } from './types'

export default function Certifications({ section, folio }: SectionProps) {
  const items = getCertifications()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Certifications'} note={section.note}>
      <ul className="grid gap-2 list-none m-0 p-0">
        {items.map((c) => <li key={c.id}>{c.name} · <span className="text-ink-2">{c.issuer}</span></li>)}
      </ul>
    </SectionShell>
  )
}
