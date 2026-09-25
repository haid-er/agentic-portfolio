/**
 * /resume: the résumé as a printed proof sheet, generated from content.
 * On screen it sits on the press bed with crop marks; in print (and "Save as
 * PDF") it becomes plain black ink on A4. Every role line keeps its proof slug,
 * so the paper copy still points at the working demos.
 */
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ButtonLink, Card, Kicker, Tag } from '@/components/ui'
import {
  getAchievements,
  getCertifications,
  getEducation,
  getExperience,
  getProfile,
  getProjects,
  getResearch,
  getResume,
  getSite,
  getSocials,
  projectLinks,
  type DemoSlug,
  type ExperienceItem,
} from '@/lib/content'
import { isDemoEnabled } from '@/lib/demos'
import { buildMetadata, siteUrl } from '@/lib/seo'
import { cx, formatPartialDate, formatRange } from '@/lib/utils'
import { ResumeActions } from './_client/ResumeActions'
import { resumePdfUrl } from './pdf'
import './resume.css'

export function generateMetadata(): Metadata {
  const p = getProfile()
  const r = getResume()
  return buildMetadata({
    title: 'Résumé',
    description: r.summary || p.shortBio || undefined,
    path: '/resume',
  })
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

/** "https://www.linkedin.com/in/haid-er/" -> "linkedin.com/in/haid-er" (readable on paper). */
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

const isExternal = (href: string) => /^https?:\/\//.test(href)

function ExtLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
  ) : (
    <a href={href} className={className}>{children}</a>
  )
}

/** Inline "→ slug" proof mark after a line; hidden demos are dropped. */
function Proof({ slug }: { slug?: DemoSlug }) {
  if (!slug || !isDemoEnabled(slug)) return null
  return (
    <>
      {' '}
      <Link
        href={`/playground/${slug}`}
        className="font-mono text-00 text-accent-ink whitespace-nowrap underline decoration-1 underline-offset-2 hover:text-ink"
        aria-label={`Proof: ${slug}`}
      >
        → {slug}
      </Link>
    </>
  )
}

function Block({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('resume-block grid gap-s3 content-start', className)}>
      <h2 className="mono font-medium text-accent-ink border-b border-rule pb-s1">{title}</h2>
      {children}
    </section>
  )
}

function EntryHead({ title, sub, meta }: { title: ReactNode; sub?: ReactNode; meta?: string }) {
  return (
    <header className="grid gap-1 xs:grid-cols-[1fr_auto] xs:items-baseline xs:gap-s3 print:grid-cols-[1fr_auto]">
      <h3 className="text-2 leading-[1.15]">{title}</h3>
      {meta ? <p className="mono m-0 text-ink-3 nums xs:text-right xs:row-span-2 print:text-right">{meta}</p> : null}
      {sub ? <p className="m-0 text-0 text-ink-2 almanac:italic">{sub}</p> : null}
    </header>
  )
}

function Role({ item }: { item: ExperienceItem }) {
  const where = [item.product && item.product !== item.org ? item.product : '', item.location, item.mode]
    .filter(Boolean)
    .join(' · ')
  const org = item.orgUrl ? <ExtLink href={item.orgUrl} className="no-underline hover:underline">{item.org}</ExtLink> : item.org
  return (
    <article className="resume-entry grid gap-s2">
      <EntryHead
        title={item.role}
        sub={<>{org}{where ? <span className="text-ink-3 not-italic"> · {where}</span> : null}</>}
        meta={formatRange(item.start, item.end)}
      />
      {item.summary ? <p className="m-0 text-0 text-ink-2 measure">{item.summary}</p> : null}
      {item.metric ? (
        <p className="m-0 flex flex-wrap items-baseline gap-2">
          <span className="display text-3 text-ink line-through decoration-accent-2 [text-decoration-thickness:.08em]">{item.metric.from}</span>
          <span aria-hidden="true" className="text-ink-3">→</span>
          <span className="sr-only">to</span>
          <span className="display text-3 text-accent">{item.metric.to}</span>
          <span className="mono text-ink-3">{item.metric.label}</span>
        </p>
      ) : null}
      {item.highlights.length ? (
        <ul className="m-0 pl-5 grid gap-1 text-0 marker:text-accent-ink">
          {item.highlights.map((h) => (
            <li key={h.text} className="measure">
              {h.text}
              <Proof slug={h.proofDemo} />
            </li>
          ))}
        </ul>
      ) : null}
      {item.stack.length ? <p className="m-0 mono text-ink-3 normal-case tracking-normal">{item.stack.join(' · ')}</p> : null}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function ResumePage() {
  const resume = getResume()
  if (!resume.enabled) notFound()

  const site = getSite()
  const p = getProfile()
  const research = getResearch()
  const experience = getExperience()
  const projects = getProjects().filter((x) => x.featured)
  const education = getEducation()
  const certs = getCertifications()
  const achievements = getAchievements()
  const pdfUrl = resumePdfUrl()
  const host = shortUrl(siteUrl())

  const paperUrls = new Set(research.items.map((r) => r.url).filter(Boolean))
  const socials = getSocials().filter((s) => s.url && !s.url.startsWith('mailto:') && !paperUrls.has(s.url))
  const summary = resume.summary || p.shortBio
  const fileName = `${p.name.replace(/\s+/g, '-')}-Resume.pdf`

  return (
    <div className="resume-page wrap py-s7 md:py-s8">
      {/* toolbar (screen only) */}
      <div className="no-print mx-auto mb-s7 grid max-w-[920px] gap-s4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-s2">
          <Kicker parts={['Résumé', resume.updated ? `Updated ${formatPartialDate(resume.updated)}` : '', pdfUrl ? 'PDF on file' : 'Prints to PDF']} />
          <ButtonLink href="/" variant="ghost" size="sm" arrow={false} className="justify-self-start -ml-3">
            ← {p.name}
          </ButtonLink>
        </div>
        <ResumeActions pdfUrl={pdfUrl} fileName={fileName} />
      </div>

      <div className="resume-sheet mx-auto max-w-[920px]">
        <span aria-hidden="true" className="crop crop-tl" />
        <span aria-hidden="true" className="crop crop-tr" />
        <span aria-hidden="true" className="crop crop-bl" />
        <span aria-hidden="true" className="crop crop-br" />

        <Card as="article" feature padded={false} layer={1} className="resume-sheet-body grid gap-s6 p-s5 md:p-s7" aria-labelledby="resume-name">
          {/* masthead */}
          <header className="grid gap-s4 md:grid-cols-[1fr_auto] md:items-end print:grid-cols-[1fr_auto] print:items-end border-b-2 border-rule pb-s5">
            <div className="grid gap-s2 min-w-0">
              <h1 id="resume-name" className="text-[clamp(2.4rem,8vw,4.4rem)]">{p.name}</h1>
              {p.headline ? <p className="m-0 text-2 text-ink-2">{p.headline}</p> : null}
              {p.tagline ? <p className="m-0 text-0 text-ink-3 measure">{p.tagline}</p> : null}
            </div>
            <address className="not-italic grid gap-1 text-0 md:text-right print:text-right [overflow-wrap:anywhere]">
              {p.location ? <span>{p.location}</span> : null}
              {p.email ? <a href={`mailto:${p.email}`} className="no-underline hover:underline">{p.email}</a> : null}
              {p.phone ? <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} className="no-underline hover:underline nums">{p.phone}</a> : null}
              {socials.map((s) => (
                <ExtLink key={s.id} href={s.url} className="no-underline hover:underline">
                  {isExternal(s.url) ? shortUrl(s.url) : s.handle || s.label}
                </ExtLink>
              ))}
            </address>
          </header>

          {summary ? <p className="m-0 text-1 measure">{summary}</p> : null}

          <div className="grid gap-s6 md:grid-cols-[minmax(0,1fr)_15rem] print:grid-cols-[minmax(0,1fr)_13rem] md:gap-s7 print:gap-s6">
            {/* main column */}
            <div className="grid gap-s6 content-start min-w-0">
              {experience.length ? (
                <Block title="Experience">
                  <div className="grid gap-s5">
                    {experience.map((e) => <Role key={e.id} item={e} />)}
                  </div>
                </Block>
              ) : null}

              {projects.length ? (
                <Block title="Selected projects">
                  <div className="grid gap-s4">
                    {projects.map((pr) => {
                      const links = projectLinks(pr)
                      const range = pr.start ? formatRange(pr.start, pr.end ?? '') : ''
                      return (
                        <article key={pr.id} className="resume-entry grid gap-1">
                          <EntryHead title={pr.title} sub={pr.role} meta={range} />
                          {pr.summary ? <p className="m-0 text-0 text-ink-2 measure">{pr.summary}<Proof slug={pr.demoSlugs[0]} /></p> : null}
                          {links.live || links.repo ? (
                            <p className="m-0 flex flex-wrap gap-x-s4 text-00 font-mono [overflow-wrap:anywhere]">
                              {links.live ? <ExtLink href={links.live} className="text-accent-ink">{shortUrl(links.live)}</ExtLink> : null}
                              {links.repo ? <ExtLink href={links.repo} className="text-accent-ink">{shortUrl(links.repo)}</ExtLink> : null}
                            </p>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                </Block>
              ) : null}

              {research.items.length ? (
                <Block title="Research">
                  {research.items.map((r) => {
                    const where = [r.venue, r.volume, r.article ? `article ${r.article}` : '', r.year].filter(Boolean).join(', ')
                    const byline = r.authorPosition && r.authorCount ? `${ordinal(r.authorPosition)} of ${r.authorCount} authors` : ''
                    return (
                      <article key={r.id} className="resume-entry grid gap-1">
                        <h3 className="text-2 leading-[1.15]">{r.url ? <ExtLink href={r.url} className="no-underline hover:underline">{r.title}</ExtLink> : r.title}</h3>
                        {where ? <p className="m-0 text-0 text-ink-2 almanac:italic">{where}</p> : null}
                        <p className="m-0 mono text-ink-3">
                          {[byline, r.doi ? `DOI ${r.doi}` : ''].filter(Boolean).join(' · ')}
                          <Proof slug={r.demoSlugs[0]} />
                        </p>
                        {r.results.length ? (
                          <p className="m-0 text-0 text-ink-2 nums">
                            {r.results.map((x) => `${x.label} ${x.value}${x.unit}`).join(' · ')}
                            {r.resultsCaption ? <span className="text-ink-3"> ({r.resultsCaption.toLowerCase()})</span> : null}
                          </p>
                        ) : null}
                      </article>
                    )
                  })}
                </Block>
              ) : null}
            </div>

            {/* side column */}
            <aside className="grid gap-s6 content-start min-w-0" aria-label="Skills, education and credentials">
              {resume.expertise.length ? (
                <Block title="Expertise">
                  <ol className="m-0 p-0 list-none grid gap-1 text-0">
                    {resume.expertise.map((x, i) => (
                      <li key={x} className="flex gap-s2">
                        <span aria-hidden="true" className="font-mono text-00 text-accent-ink nums pt-[2px]">{String(i + 1).padStart(2, '0')}</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ol>
                </Block>
              ) : null}

              {resume.technologies.length ? (
                <Block title="Technologies">
                  <ul className="resume-tags m-0 p-0 list-none flex flex-wrap gap-1">
                    {resume.technologies.map((t) => <li key={t}><Tag className="normal-case tracking-normal">{t}</Tag></li>)}
                  </ul>
                </Block>
              ) : null}

              {education.length ? (
                <Block title="Education">
                  {education.map((ed) => {
                    const range = ed.start || ed.end ? formatRange(ed.start, ed.end) : ''
                    return (
                      <article key={ed.id} className="resume-entry grid gap-1 text-0">
                        <h3 className="text-1 leading-[1.2]">{[ed.degree, ed.field].filter(Boolean).join(' in ')}</h3>
                        <p className="m-0 text-ink-2 almanac:italic">{ed.institution}</p>
                        {[range, ed.location].some(Boolean) ? <p className="m-0 mono text-ink-3 nums">{[range, ed.location].filter(Boolean).join(' · ')}</p> : null}
                        {ed.grade ? <p className="m-0 font-semibold nums">{ed.grade}</p> : null}
                      </article>
                    )
                  })}
                </Block>
              ) : null}

              {certs.length ? (
                <Block title="Certifications">
                  <ul className="m-0 p-0 list-none grid gap-s3 text-0">
                    {certs.map((c) => (
                      <li key={c.id} className="resume-entry grid gap-[2px]">
                        {c.url ? <ExtLink href={c.url} className="font-semibold no-underline hover:underline">{c.name}</ExtLink> : <span className="font-semibold">{c.name}</span>}
                        <span className="text-ink-2">{[c.issuer, formatPartialDate(c.date)].filter(Boolean).join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                </Block>
              ) : null}

              {achievements.length ? (
                <Block title="Recognition">
                  <ul className="m-0 p-0 list-none grid gap-s2 text-0">
                    {achievements.map((a) => (
                      <li key={a.id} className="resume-entry">
                        <span className="font-semibold">{a.title}</span>
                        {a.date ? <span className="text-ink-3 nums"> · {formatPartialDate(a.date)}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Block>
              ) : null}

              {p.languages.length ? (
                <Block title="Languages">
                  <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-s3 gap-y-1 text-0">
                    {p.languages.map((l) => (
                      <div key={l.name} className="contents">
                        <dt className="font-semibold">{l.name}</dt>
                        <dd className="m-0 text-ink-2">{l.level}</dd>
                      </div>
                    ))}
                  </dl>
                </Block>
              ) : null}
            </aside>
          </div>

          {/* colophon: on paper, tell the reader where the proofs run */}
          <footer className="border-t border-rule pt-s3 flex flex-wrap justify-between gap-x-s4 gap-y-1 mono text-ink-3">
            <span>{site.masthead.strapline ? `${site.masthead.strapline} · ` : ''}{host}/playground</span>
            {resume.updated ? <span className="nums">Updated {formatPartialDate(resume.updated)}</span> : null}
          </footer>
        </Card>
      </div>
    </div>
  )
}
