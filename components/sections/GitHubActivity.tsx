/** Live GitHub activity for the public profile (ISR 6h). STUB — owner: hero-about. */
import { SectionShell } from '@/components/ui'
import type { SectionProps } from './types'

export default function GitHubActivity({ section, folio }: SectionProps) {
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'On GitHub'} note={section.note}>
      <p className="mono text-ink-3 m-0">Activity feed pending.</p>
    </SectionShell>
  )
}
