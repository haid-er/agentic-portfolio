/** Testimonials; hidden when none are enabled. STUB — owner: services-testimonials. */
import { SectionShell } from '@/components/ui'
import { getTestimonials } from '@/lib/content'
import type { SectionProps } from './types'

export default function Testimonials({ section, folio }: SectionProps) {
  const items = getTestimonials()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Testimonials'} note={section.note}>
      {items.map((t) => (
        <blockquote key={t.id} className="m-0"><p>{t.quote}</p><footer className="mono">{t.author}</footer></blockquote>
      ))}
    </SectionShell>
  )
}
