/** Contact links + form (free endpoint from admin, mailto fallback). STUB — owner: resume-contact. */
import { ButtonLink, SectionShell } from '@/components/ui'
import { getProfile, getSite } from '@/lib/content'
import type { SectionProps } from './types'

export default function Contact({ section, folio }: SectionProps) {
  const { contact } = getSite()
  const { email } = getProfile()
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Contact'} note={section.note}>
      {contact.blurb ? <p className="measure">{contact.blurb}</p> : null}
      {email ? <ButtonLink href={`mailto:${email}`} icon="mail">{email}</ButtonLink> : null}
    </SectionShell>
  )
}
