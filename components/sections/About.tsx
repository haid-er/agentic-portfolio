/**
 * About (DESIGN.md 5, 6): bio, the six pillars as an index page, the motto set as a
 * colophon slug, and languages with dot leaders. Everything comes from content/site.json;
 * pillars end in proof links to visible playground demos.
 */
import type { CSSProperties } from 'react'
import { Icon, ProofRow, SectionShell, Tag } from '@/components/ui'
import { getSite, type PillarInfo } from '@/lib/content'
import { getDemos, PILLAR_GLYPH, type DemoSlug } from '@/lib/demos'
import { cx, folio as pad } from '@/lib/utils'
import type { SectionProps } from './types'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Body paragraphs, minus any that only restate the motto (it gets its own slug). */
function bioParagraphs(body: string[], motto: string): string[] {
  const m = norm(motto)
  return body.map((p) => p.trim()).filter((p) => p && !(m && norm(p).endsWith(m) && norm(p).length < m.length + 12))
}

function PillarRow({ pillar, n, proofs }: { pillar: PillarInfo; n: number; proofs: DemoSlug[] }) {
  return (
    <li
      className={cx(
        'grid grid-cols-[auto_1fr] gap-x-s4 gap-y-2 py-s4',
        'almanac:border-t almanac:border-rule',
        'strata:bg-surface strata:rounded-1 strata:px-s4 strata:shadow-[inset_4px_0_0_var(--layer)]',
      )}
      style={{ '--layer': `var(--layer-${((n - 1) % 6) + 1})` } as CSSProperties}
    >
      <span className="grid justify-items-center gap-1 pt-1">
        <span aria-hidden="true" className="display text-2 nums text-accent-ink leading-none">{pad(n)}</span>
        <span className="text-ink-3"><Icon name={PILLAR_GLYPH[pillar.id]} size={20} /></span>
      </span>
      <div className="grid gap-2 min-w-0">
        <h3 className="text-3">{pillar.title}</h3>
        {pillar.summary ? <p className="m-0 text-ink-2">{pillar.summary}</p> : null}
        <ProofRow slugs={proofs} />
      </div>
    </li>
  )
}

/** Fallback heading when the admin leaves the section title empty. */
export const DEFAULT_TITLE = 'About'

/** The same test as this section's early `return null` (used by the nav and index). */
export function shouldRender(): boolean {
  const { about, profile } = getSite()
  const paragraphs = bioParagraphs(about.body.length ? about.body : [profile.shortBio], profile.motto)
  return paragraphs.length > 0 || Boolean(profile.motto) || profile.pillars.length > 0
}

export default function About({ section, folio }: SectionProps) {
  const { about, profile } = getSite()
  const paragraphs = bioParagraphs(about.body.length ? about.body : [profile.shortBio], profile.motto)
  const pillars = profile.pillars
  const languages = profile.languages.filter((l) => l.name)
  const interests = profile.interests.filter(Boolean)
  if (!shouldRender()) return null

  const demos = getDemos()
  const proofsFor = (id: PillarInfo['id']) => demos.filter((d) => d.pillar === id).slice(0, 2).map((d) => d.slug)

  return (
    <SectionShell id={section.id} folio={folio} title={section.title || DEFAULT_TITLE} note={section.note}>
      <div className="grid gap-s7 mid:grid-cols-12 mid:gap-s6">
        <div className="grid gap-s6 content-start mid:col-span-7">
          {paragraphs.length ? (
            <div className="measure grid gap-s4">
              {paragraphs.map((p, i) => (
                <p key={i} className={cx('m-0', i === 0 && 'text-2 leading-snug text-ink')}>{p}</p>
              ))}
            </div>
          ) : null}

          {profile.motto ? (
            <figure className="m-0 measure border border-rule bg-surface px-s5 py-s5 grid gap-s3 strata:rounded-2 almanac:shadow-press">
              <figcaption className="mono text-ink-3 inline-flex items-center gap-2">
                <Icon name="register" size={16} />
                Motto
              </figcaption>
              <blockquote className="m-0">
                <p className="display text-4 m-0 almanac:italic [text-wrap:balance]">{profile.motto}</p>
              </blockquote>
            </figure>
          ) : null}

          {languages.length || interests.length ? (
            <div className="grid gap-s6 xs:grid-cols-2 measure">
              {languages.length ? (
                <div className="grid gap-s3 content-start">
                  <h3 className="mono text-ink-3 font-normal [font-variation-settings:normal] [font-stretch:100%]">Languages</h3>
                  <dl className="m-0 grid gap-2">
                    {languages.map((l) => (
                      <div key={l.name} className="flex items-baseline gap-2">
                        <dt className="font-semibold text-ink">{l.name}</dt>
                        <span aria-hidden="true" className="flex-1 border-b border-dotted border-rule translate-y-[-.3em] min-w-4" />
                        <dd className="m-0 mono text-ink-2">{l.level}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
              {interests.length ? (
                <div className="grid gap-s3 content-start">
                  <h3 className="mono text-ink-3 font-normal [font-variation-settings:normal] [font-stretch:100%]">Interests</h3>
                  <ul className="m-0 p-0 list-none flex flex-wrap gap-2">
                    {interests.map((t) => <li key={t}><Tag>{t}</Tag></li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {pillars.length ? (
          <div className="mid:col-span-5 min-w-0">
            <ol className="m-0 p-0 list-none grid almanac:border-b almanac:border-rule strata:gap-s3" aria-label="Pillars">
              {pillars.map((p, i) => <PillarRow key={p.id} pillar={p} n={i + 1} proofs={proofsFor(p.id)} />)}
            </ol>
          </div>
        ) : null}
      </div>
    </SectionShell>
  )
}
