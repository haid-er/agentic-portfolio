/** About: bio, pillars, motto, languages. STUB — owner: hero-about. */
import { SectionShell } from '@/components/ui'
import { getSite } from '@/lib/content'
import type { SectionProps } from './types'

export default function About({ section, folio }: SectionProps) {
  const { about, profile } = getSite()
  if (!about.body.length && !profile.motto) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'About'} note={section.note}>
      <div className="measure grid gap-4">
        {about.body.map((p, i) => <p key={i} className="m-0">{p}</p>)}
        {profile.motto ? <p className="m-0 italic text-ink-2">{profile.motto}</p> : null}
      </div>
    </SectionShell>
  )
}
