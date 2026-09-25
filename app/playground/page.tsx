/**
 * /playground: the specimen catalogue. Every visible demo, grouped by pillar,
 * with search, pillar / skill filters and skill landings (/playground?skill=x).
 * Hidden demos (content/playground.json) never appear.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/ui'
import { GalleryFromUrl } from '@/components/playground/GalleryFromUrl'
import { getGalleryModel } from '@/components/playground/model'
import { getPlayground, getProfile, getSection } from '@/lib/content'
import { breadcrumbJsonLd, buildMetadata, jsonLdString } from '@/lib/seo'

function pageCopy() {
  const section = getSection('playground')
  const title = section?.title || 'Playground'
  const intro = getPlayground().intro || section?.note || ''
  const description = intro || `Working demos by ${getProfile().name}. Each one proves a skill from the record.`
  return { title, intro, description }
}

export function generateMetadata(): Metadata {
  const { title, description } = pageCopy()
  return buildMetadata({ title, description, path: '/playground' })
}

export default function PlaygroundPage() {
  const { title, intro } = pageCopy()
  const { cards, pillars, skills } = getGalleryModel()
  const breadcrumbs = breadcrumbJsonLd([
    { name: getProfile().name, path: '/' },
    { name: title, path: '/playground' },
  ])

  return (
    <div className="wrap grid gap-s7 py-s7 md:py-s8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbs) }} />
      <header className="grid gap-s4 almanac:border-b-2 almanac:border-rule almanac:pb-s5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-s7">
        <div className="grid gap-s4">
          <nav aria-label="Breadcrumb">
            <Link href="/#playground" className="mono inline-flex min-h-tap items-center gap-2 text-ink-2 no-underline hover:text-ink">
              <Icon name="arrow" size={14} className="rotate-180" />
              Index
            </Link>
          </nav>
          <h1 className="text-[clamp(2.8rem,10vw,6rem)]">{title}</h1>
          {intro ? <p className="m-0 measure text-2 text-ink-2">{intro}</p> : null}
        </div>
        <CatalogueStats demos={cards.length} pillars={pillars.length} skills={skills.length} />
      </header>

      {cards.length ? <GalleryFromUrl cards={cards} pillars={pillars} skills={skills} /> : null}
    </div>
  )
}

/** A small colophon of counts (derived, never invented): demos, pillars, skills proven. */
function CatalogueStats({ demos, pillars, skills }: { demos: number; pillars: number; skills: number }) {
  const rows = [
    { label: 'Specimens', value: demos },
    { label: 'Pillars', value: pillars },
    { label: 'Skills proven', value: skills },
  ].filter((r) => r.value > 0)
  if (!rows.length) return null
  return (
    <dl className="m-0 grid grid-cols-3 border border-rule bg-surface rounded-2 strata:border-0 strata:shadow-plate">
      {rows.map((r, i) => (
        <div key={r.label} className={i ? 'border-l border-rule-soft p-s3 md:p-s4' : 'p-s3 md:p-s4'}>
          <dt className="mono text-ink-3">{r.label}</dt>
          <dd className="display nums m-0 text-4 text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}
