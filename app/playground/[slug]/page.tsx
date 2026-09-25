/**
 * /playground/[slug]: one demo, printed as a catalogue plate.
 *
 *   breadcrumb -> kicker (pillar · runs in · No.) -> title -> summary -> phone note
 *   specimen label: the real work it mirrors + skills it proves (links to skill landings)
 *   the live demo (registry loader, client only) on a solid plate
 *   how it works · honest limits · built with (from the demo's notes.ts)
 *   where it shows up in the record (content items naming this demo as proof)
 *   previous / next, then more from the same pillar
 *
 * Hidden demos are not generated (dynamicParams = false) and 404.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Icon, Kicker } from '@/components/ui'
import {
  DemoNotesBlock, DemoPager, DetailHead, RecordMentions, RelatedDemos, SpecimenLabel,
} from '@/components/playground/DemoDetail'
import { DemoStage } from '@/components/playground/DemoStage'
import { getNeighbours, getRecordMentions, toCardModel } from '@/components/playground/model'
import { PhoneNote } from '@/components/playground/SpecimenCard'
import { catalogueNo, runsInLabel } from '@/components/playground/slug'
import { getProfile, getSection } from '@/lib/content'
import { getDemo, getDemos } from '@/lib/demos'
import { breadcrumbJsonLd, demoJsonLd, demoMetadata, jsonLdString } from '@/lib/seo'

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return getDemos().map((d) => ({ slug: d.slug }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = getDemo((await params).slug)
  if (!d) return {}
  return demoMetadata({ slug: d.slug, title: d.title, summary: d.summary, skills: Array.from(new Set([...d.provenBy, ...d.skills])) })
}

export default async function DemoPage({ params }: Params) {
  const demo = getDemo((await params).slug)
  if (!demo) notFound()

  const nav = getNeighbours(demo.slug)
  const card = toCardModel(demo, nav.no)
  const mentions = getRecordMentions(demo.slug)
  const galleryTitle = getSection('playground')?.title || 'Playground'
  const skillsForLd = Array.from(new Set([...demo.provenBy, ...demo.skills]))
  const ld = [
    demoJsonLd({ slug: demo.slug, title: demo.title, summary: demo.summary, skills: skillsForLd }),
    breadcrumbJsonLd([
      { name: getProfile().name, path: '/' },
      { name: galleryTitle, path: '/playground' },
      { name: demo.title, path: `/playground/${demo.slug}` },
    ]),
  ]

  return (
    <article aria-labelledby="demo-title" className="wrap grid gap-s7 py-s7 md:gap-s8 md:py-s8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />

      <header className="grid gap-s6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-s7">
        <div className="grid gap-s4">
          <nav aria-label="Breadcrumb">
            <Link href="/playground" className="mono inline-flex min-h-tap items-center gap-2 text-ink-2 no-underline hover:text-ink">
              <Icon name="arrow" size={14} className="rotate-180" />
              {galleryTitle}
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-x-s3 gap-y-1">
            <Icon name={card.glyph} size={20} className="text-accent-ink" />
            <Kicker className="m-0" parts={[card.pillarLabel, runsInLabel(card.runsIn), `${catalogueNo(nav.no)} of ${nav.total}`]} />
          </div>
          <h1 id="demo-title" className="text-[clamp(2.6rem,9vw,5.5rem)]">{demo.title}</h1>
          {demo.summary ? <p className="m-0 measure text-2 text-ink-2">{demo.summary}</p> : null}
          <div className="flex flex-wrap items-center gap-s3">
            {demo.usesAI ? <Badge tone="accent">Uses AI</Badge> : null}
            <PhoneNote mobile={demo.mobile} />
          </div>
        </div>
        <SpecimenLabel card={card} proves={card.proves} />
      </header>

      <section aria-labelledby="try-title" className="grid gap-s4">
        <div className="flex flex-wrap items-end justify-between gap-s3">
          <DetailHead id="try-title" kicker="Live specimen" title="Try it" />
          {!demo.mobile.ok ? (
            <a href="#how-it-works" className="mono inline-flex min-h-tap items-center gap-2 text-accent-ink md:hidden">
              <Icon name="info" size={14} />
              On a phone? Read how it works
            </a>
          ) : null}
        </div>
        <DemoStage slug={demo.slug} title={demo.title} no={nav.no} glyph={card.glyph} runsIn={demo.runsIn} />
      </section>

      <DemoNotesBlock howItWorks={demo.notes.howItWorks} limits={demo.notes.limits} stack={demo.notes.stack} />

      <RecordMentions mentions={mentions} />

      <DemoPager prev={nav.prev} next={nav.next} total={nav.total} />

      <RelatedDemos cards={nav.related} pillarLabel={card.pillarLabel} />
    </article>
  )
}
