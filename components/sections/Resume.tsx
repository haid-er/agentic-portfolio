/** Résumé teaser linking to /resume. STUB — owner: resume-contact. */
import { ButtonLink, SectionShell } from '@/components/ui'
import { getResume } from '@/lib/content'
import type { SectionProps } from './types'

export default function Resume({ section, folio }: SectionProps) {
  const resume = getResume()
  if (!resume.enabled) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Résumé'} note={section.note}>
      {resume.summary ? <p className="measure">{resume.summary}</p> : null}
      <ButtonLink href="/resume">Open the résumé</ButtonLink>
    </SectionShell>
  )
}
