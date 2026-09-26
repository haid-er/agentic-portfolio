/**
 * /projects/[slug]: static case pages, one per enabled project.
 *
 * Layout (mobile first, 7/5 split at >= 1024px):
 *   breadcrumb -> kicker (pillar / dates) -> display title -> summary lede -> links
 *   specification plate (role, period, pillar, code, outcome)
 *   story (drop cap on the first paragraph, numbered margin folios) | stack core + tags
 *   Proof: related playground demos (specimen cards)
 *   same-pillar projects, then previous / next.
 *
 * Everything shown comes from content/projects.json and the demo registry. Empty
 * fields are hidden; private projects never show a repo link (projectLinks).
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Badge, ButtonLink, Card, Icon, Kicker, Metric, Mono } from '@/components/ui'
import { getProfile, getProject, getProjects, projectLinks, type Project } from '@/lib/content'
import { getDemo, type Demo } from '@/lib/demos'
import { buildMetadata, jsonLdString, siteUrl } from '@/lib/seo'
import { cx } from '@/lib/utils'
import { DemoProofCard } from '../_components/DemoProofCard'
import { StackCore } from '../_components/StackCore'
import { parseOutcome, pillarLabel, pillarLayer, projectRange } from '../_lib/model'

type Params = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = getProject((await params).slug)
  if (!p) return {}
  const base = buildMetadata({ title: p.title, description: p.summary, path: `/projects/${p.slug}`, segmentImage: true })
  return { ...base, keywords: Array.from(new Set([...p.tags, ...p.stack])) }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const tagHref = (tag: string) => `/projects?projects-tag=${encodeURIComponent(tag)}`
const pillarHref = (p: Project) => `/projects?projects=${p.pillar}`

function relatedDemos(p: Project): Demo[] {
  return p.demoSlugs.map((s) => getDemo(s)).filter((d): d is Demo => Boolean(d))
}

function neighbours(p: Project) {
  const all = getProjects()
  const i = all.findIndex((x) => x.slug === p.slug)
  return {
    prev: i > 0 ? all[i - 1] : undefined,
    next: i >= 0 && i < all.length - 1 ? all[i + 1] : undefined,
    samePillar: all.filter((x) => x.pillar === p.pillar && x.slug !== p.slug).slice(0, 3),
  }
}

function projectJsonLd(p: Project) {
  const url = `${siteUrl()}/projects/${p.slug}`
  const links = projectLinks(p)
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: p.title,
    description: p.summary,
    url,
    keywords: p.tags.join(', ') || undefined,
    dateCreated: p.start || undefined,
    author: { '@type': 'Person', name: getProfile().name, url: siteUrl() },
    sameAs: [links.live, links.repo].filter(Boolean),
  }
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default async function ProjectPage({ params }: Params) {
  const p = getProject((await params).slug)
  if (!p) notFound()

  const links = projectLinks(p)
  const range = projectRange(p)
  const pillar = pillarLabel(p.pillar)
  const layer = pillarLayer(p.pillar)
  const outcome = parseOutcome(p.outcome)
  const story = p.story.filter((s) => s.trim())
  const demos = relatedDemos(p)
  const { prev, next, samePillar } = neighbours(p)
  const hasSide = p.stack.length > 0 || p.tags.length > 0

  return (
    <article className="wrap py-s7 md:py-s8 grid gap-s8" aria-labelledby="project-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(projectJsonLd(p)) }} />

      {/* ---------------- head ---------------- */}
      <header className="grid gap-s6 lg:grid-cols-[7fr_5fr] lg:items-end">
        <div className="grid gap-s4 min-w-0">
          <nav aria-label="Breadcrumb">
            <ol className="m-0 p-0 list-none mono flex flex-wrap items-center gap-x-2 text-ink-2">
              <li><Link href="/#projects" className="inline-flex min-h-tap items-center no-underline hover:text-ink">Index</Link></li>
              <li aria-hidden="true" className="text-accent-ink">/</li>
              <li><Link href="/projects" className="inline-flex min-h-tap items-center no-underline hover:text-ink">Projects</Link></li>
              <li aria-hidden="true" className="text-accent-ink">/</li>
              <li aria-current="page" className="text-ink-3 [overflow-wrap:anywhere]">{p.title}</li>
            </ol>
          </nav>
          <Kicker parts={[pillar, range]} />
          <h1 id="project-title" className="text-[clamp(2.6rem,9vw,5.75rem)] [overflow-wrap:anywhere]">{p.title}</h1>
          <p className="m-0 measure text-2 text-ink-2 leading-snug">{p.summary}</p>
          {links.live || links.repo || p.private ? (
            <div className="flex flex-wrap items-center gap-3 pt-s2">
              {links.live ? <ButtonLink href={links.live} icon="arrow-up-right" arrow={false}>Visit live site</ButtonLink> : null}
              {links.repo ? <ButtonLink href={links.repo} variant="secondary" icon="github">Read the code</ButtonLink> : null}
              {p.private ? <Badge><Icon name="lock" size={12} />Private code</Badge> : null}
            </div>
          ) : null}
        </div>

        <Card feature layer={layer} className="grid gap-s4 almanac:mr-[6px]">
          <Mono as="p" className="m-0 flex items-center justify-between gap-3">
            <span>Specification</span>
            <Icon name="register" size={16} className="text-accent-2" />
          </Mono>
          <dl className="m-0 grid gap-0">
            {p.role ? <SpecRow term="Role">{p.role}</SpecRow> : null}
            {range ? <SpecRow term="Period"><span className="nums">{range}</span></SpecRow> : null}
            {pillar ? (
              <SpecRow term="Pillar">
                <Link href={pillarHref(p)} className="underline decoration-1 underline-offset-4 decoration-accent-ink hover:text-accent-ink">{pillar}</Link>
              </SpecRow>
            ) : null}
            <SpecRow term="Code">
              {links.repo ? (
                <a href={links.repo} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-4 decoration-accent-ink hover:text-accent-ink [overflow-wrap:anywhere]">
                  Public repository<span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : p.private ? 'Private' : null}
            </SpecRow>
          </dl>
          {outcome ? (
            <div className="grid gap-1 pt-s3 border-t border-rule-soft">
              <Mono as="p" className="m-0">Outcome</Mono>
              {outcome.metric ? (
                <Metric from={outcome.metric.from} to={outcome.metric.to} label={outcome.metric.label} />
              ) : (
                <p className="m-0 text-1">{outcome.text}</p>
              )}
            </div>
          ) : null}
        </Card>
      </header>

      {/* ---------------- story + stack ---------------- */}
      {story.length || hasSide ? (
        <div className={cx('grid gap-s7', story.length > 0 && hasSide && 'lg:grid-cols-[7fr_5fr]')}>
          {story.length ? (
            <section aria-labelledby="story-title" className="grid gap-s4 min-w-0 almanac:border-t-2 almanac:border-rule almanac:pt-s4">
              <h2 id="story-title" className="text-4">Story</h2>
              <ol className="m-0 p-0 list-none grid gap-s5">
                {story.map((para, i) => (
                  <li key={i} className="grid grid-cols-[2.25rem_1fr] gap-s3 items-baseline">
                    <span aria-hidden="true" className="display text-2 text-accent-ink nums">{String(i + 1).padStart(2, '0')}</span>
                    <p
                      className={cx(
                        'm-0 measure text-1',
                        i === 0 && 'first-letter:float-left first-letter:mr-2 first-letter:mt-[.08em] first-letter:font-display first-letter:text-[3.6em] first-letter:leading-[.8] first-letter:text-accent-2',
                      )}
                    >
                      {para}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {hasSide ? (
            <aside aria-label="Stack and tags" className="grid gap-s6 content-start min-w-0">
              {p.stack.length ? (
                <section aria-labelledby="stack-title" className="grid gap-s3">
                  <div className="flex items-baseline justify-between gap-3 almanac:border-t-2 almanac:border-rule almanac:pt-s4">
                    <h2 id="stack-title" className="text-4">Stack</h2>
                    <Mono className="nums">{p.stack.length} {p.stack.length === 1 ? 'layer' : 'layers'}</Mono>
                  </div>
                  <Card padded={false} layer={layer} className="px-s4 py-s2 plate-solid">
                    <StackCore id={`stack-${p.slug}`} items={p.stack} startLayer={layer} />
                  </Card>
                </section>
              ) : null}
              {p.tags.length ? (
                <section aria-labelledby="tags-title" className="grid gap-s2">
                  <Mono as="h2" id="tags-title" className="font-mono font-normal leading-[1.4] [font-variation-settings:normal]">Tags</Mono>
                  <ul className="m-0 p-0 list-none flex flex-wrap gap-x-2">
                    {p.tags.map((t) => (
                      <li key={t}>
                        <Link href={tagHref(t)} className="group inline-flex min-h-tap items-center no-underline">
                          <span className="mono inline-flex items-center gap-1 px-2 py-1 border border-rule rounded-pill text-ink-2 group-hover:text-ink group-hover:bg-bg-2">
                            {t}
                            <Icon name="arrow" size={12} />
                          </span>
                          <span className="sr-only">: all projects tagged {t}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}

      {/* ---------------- proof ---------------- */}
      {demos.length ? (
        <section aria-labelledby="proof-title" className="grid gap-s5 almanac:border-t-2 almanac:border-rule almanac:pt-s4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <h2 id="proof-title" className="text-4">Proof</h2>
            <Mono as="p" className="m-0 nums">
              {demos.length} working {demos.length === 1 ? 'demo' : 'demos'} in the playground
            </Mono>
          </div>
          <ul className="m-0 p-0 list-none grid gap-s5 md:grid-cols-2 xl:grid-cols-3">
            {demos.map((d) => <li key={d.slug} className="min-w-0"><DemoProofCard demo={d} /></li>)}
          </ul>
        </section>
      ) : null}

      {/* ---------------- more ---------------- */}
      {samePillar.length || prev || next ? (
        <footer className="grid gap-s6">
          {samePillar.length ? (
            <section aria-labelledby="more-title" className="grid gap-s3">
              <Mono as="h2" id="more-title" className="font-mono font-normal leading-[1.4] [font-variation-settings:normal]">
                {pillar ? `More in ${pillar}` : 'More projects'}
              </Mono>
              <ul className="m-0 p-0 list-none grid border-t border-rule">
                {samePillar.map((x) => (
                  <li key={x.slug} className="border-b border-rule">
                    <Link href={`/projects/${x.slug}`} className="group grid grid-cols-[1fr_auto] items-center gap-s3 min-h-[52px] py-s2 no-underline">
                      <span className="grid min-w-0">
                        <span className="font-semibold group-hover:text-accent-ink [overflow-wrap:anywhere]">{x.title}</span>
                        {projectRange(x) ? <span className="mono text-ink-3 nums">{projectRange(x)}</span> : null}
                      </span>
                      <Icon name="arrow" size={18} className="text-ink-2 transition-transform duration-[var(--dur-fast)] motion-safe:group-hover:translate-x-[3px]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {prev || next ? (
            <nav aria-label="Previous and next project" className="grid gap-s3 xs:grid-cols-2">
              {prev ? <Neighbour project={prev} dir="prev" /> : <span className="hidden xs:block" />}
              {next ? <Neighbour project={next} dir="next" /> : null}
            </nav>
          ) : null}
        </footer>
      ) : null}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* small pieces                                                        */
/* ------------------------------------------------------------------ */

function SpecRow({ term, children }: { term: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-s3 py-s2 border-b border-rule-soft last:border-b-0 items-baseline">
      <dt className="mono text-ink-3">{term}</dt>
      <dd className="m-0 text-0 text-ink min-w-0">{children}</dd>
    </div>
  )
}

function Neighbour({ project, dir }: { project: Project; dir: 'prev' | 'next' }) {
  const isNext = dir === 'next'
  return (
    <Link
      href={`/projects/${project.slug}`}
      rel={dir}
      className={cx(
        'group grid gap-1 p-s4 min-h-tap no-underline bg-surface border border-rule rounded-2',
        'transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] motion-safe:hover:-translate-y-[2px]',
        'almanac:hover:shadow-press strata:border-transparent strata:shadow-plate',
        isNext && 'xs:text-right xs:col-start-2',
      )}
    >
      <span className={cx('mono text-ink-3 inline-flex items-center gap-2', isNext && 'xs:justify-end')}>
        {!isNext ? <Icon name="arrow" size={14} className="rotate-180" /> : null}
        {isNext ? 'Next project' : 'Previous project'}
        {isNext ? <Icon name="arrow" size={14} /> : null}
      </span>
      <span className="display text-2 [overflow-wrap:anywhere] group-hover:text-accent-ink">{project.title}</span>
    </Link>
  )
}
