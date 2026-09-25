/** Homepage featured specimen card (DESIGN.md 10). STUB — owner: playground-hub. */
import Link from 'next/link'
import { ButtonLink, Card, SectionShell } from '@/components/ui'
import type { SectionProps } from '@/components/sections/types'
import { getPlayground } from '@/lib/content'
import { getFeaturedDemo } from '@/lib/demos'

export default function FeaturedDemo({ section, folio }: SectionProps) {
  const demo = getFeaturedDemo()
  if (!demo) return null
  const { intro } = getPlayground()
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Playground'} note={section.note || intro}>
      <Card feature>
        <h3 className="text-3"><Link href={`/playground/${demo.slug}`}>{demo.title}</Link></h3>
        <p className="text-0">{demo.summary}</p>
        <ButtonLink href="/playground" variant="secondary">All demos</ButtonLink>
      </Card>
    </SectionShell>
  )
}
