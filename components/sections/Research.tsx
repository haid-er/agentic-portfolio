/**
 * Research block (DESIGN.md 6.5).
 *
 * - Each paper prints as a --bg-2 inset plate: kicker (venue / year), title in
 *   display type, a DOI slug, and the abstract.
 * - Authorship is an author strip: one mark per author, Malik's mark inked and
 *   named, every other mark left blank. Co-author names are never rendered.
 * - Results are printed accuracy meters (fill once on view, static under reduced motion).
 * - A citation block offers BibTeX: the content entry when present, otherwise one
 *   built only from the content fields (no author list, which would name colleagues).
 * - The neighbouring pipeline (MotionIQ) is a separate numbered grid, never
 *   presented as the paper's own pipeline.
 *
 * All copy comes from content/research.json, site.profile and the demo registry.
 */
import { ButtonLink, Icon, Kicker, Meter, Mono, ProofRow, SectionShell, type IconName } from '@/components/ui'
import { getProfile, getResearch, type ResearchItem } from '@/lib/content'
import { getDemo, isDemoEnabled, type DemoSlug } from '@/lib/demos'
import { cx } from '@/lib/utils'
import type { SectionProps } from './types'

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

const visibleSlugs = (slugs: readonly DemoSlug[] | undefined) => (slugs ?? []).filter((s) => isDemoEnabled(s))

/** "Multimedia Tools and Applications (Springer)" -> journal + publisher. */
function splitVenue(venue: string): { journal: string; publisher?: string } {
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(venue)
  return m ? { journal: m[1] ?? venue, publisher: m[2] } : { journal: venue }
}

/** "85 (9)" -> volume 85, number 9. */
function splitVolume(volume: string | undefined): { volume?: string; number?: string } {
  if (!volume) return {}
  const m = /^\s*([^()\s]+)\s*(?:\(([^)]+)\))?\s*$/.exec(volume)
  return m ? { volume: m[1], number: m[2] } : { volume }
}

/** "Vol. 85 (9) · Art. 731 · 2026" style meta parts. */
function metaParts(r: ResearchItem): string[] {
  return [r.volume ? `Vol. ${r.volume}` : '', r.article ? `Art. ${r.article}` : '', r.year].filter(Boolean)
}

/** BibTeX from content only: the stored entry, else fields we hold (no authors). */
function bibtexFor(r: ResearchItem): string {
  if (r.bibtex) return r.bibtex.trim()
  if (!r.doi) return ''
  const { journal, publisher } = splitVenue(r.venue)
  const { volume, number } = splitVolume(r.volume)
  const key = `${r.id.replace(/[^a-z0-9]/gi, '')}${r.year}`
  const esc = (s: string) => s.replace(/[{}]/g, '')
  const fields: Array<[string, string | undefined]> = [
    ['title', `{${esc(r.title)}}`],
    ['journal', esc(journal)],
    ['publisher', publisher && esc(publisher)],
    ['year', r.year],
    ['volume', volume],
    ['number', number],
    ['pages', r.article],
    ['doi', r.doi],
    ['url', r.url || `https://doi.org/${r.doi}`],
  ]
  const body = fields
    .filter((f): f is [string, string] => Boolean(f[1]))
    .map(([k, v]) => `  ${k.padEnd(9)} = {${v}}`)
    .join(',\n')
  return `% author field omitted here: resolve the full author list via the DOI\n@article{${key},\n${body}\n}`
}

/* ------------------------------------------------------------------ */
/* author strip                                                        */
/* ------------------------------------------------------------------ */

function AuthorStrip({ position, count, name }: { position: number; count: number; name: string }) {
  const summary = `${ordinal(position)} of ${count} authors`
  return (
    <div className="grid gap-2">
      <Mono tone="ink-2">{summary}</Mono>
      <ol aria-label={`Author order: ${name}, ${summary}`} className="m-0 p-0 list-none flex flex-wrap items-center gap-2">
        {Array.from({ length: count }, (_, i) => {
          const self = i + 1 === position
          return (
            <li
              key={i}
              aria-hidden={self ? undefined : true}
              className={cx(
                'inline-flex items-center gap-2 h-8 border rounded-pill',
                self
                  ? 'px-3 bg-ink text-bg almanac:text-on-accent border-ink almanac:shadow-[3px_3px_0_var(--accent-2)]'
                  : 'w-8 justify-center border-rule-soft text-ink-3 border-dashed',
              )}
            >
              <span className="mono nums">{i + 1}</span>
              {self ? <span className="text-0 font-semibold normal-case tracking-normal">{name}</span> : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* citation                                                            */
/* ------------------------------------------------------------------ */

function Citation({ bibtex }: { bibtex: string }) {
  return (
    <details className="group border border-rule rounded-1 bg-surface">
      <summary className="mono flex items-center justify-between gap-3 min-h-tap px-4 cursor-pointer text-ink list-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <Icon name="doc" size={16} />
          BibTeX
        </span>
        <span aria-hidden="true" className="text-accent-ink transition-transform duration-[var(--dur-fast)] group-open:rotate-45">
          <Icon name="plus" size={16} />
        </span>
      </summary>
      <div className="grid gap-2 px-4 pb-4">
        <Mono tone="ink-3">Click the entry to select it all</Mono>
        <pre
          tabIndex={0}
          aria-label="BibTeX entry"
          className="m-0 p-3 bg-bg-2 rounded-0 overflow-x-auto text-00 leading-relaxed font-mono text-ink select-all whitespace-pre"
        >
          {bibtex}
        </pre>
      </div>
    </details>
  )
}

/* ------------------------------------------------------------------ */
/* paper plate                                                         */
/* ------------------------------------------------------------------ */

function Paper({ r, name, index }: { r: ResearchItem; name: string; index: number }) {
  const { journal, publisher } = splitVenue(r.venue)
  const proofs = visibleSlugs(r.demoSlugs)
  const lead = proofs[0] ? getDemo(proofs[0]) : undefined
  const bibtex = bibtexFor(r)
  const headingId = `paper-${r.id}`

  return (
    <article
      aria-labelledby={headingId}
      className={cx(
        'relative grid gap-s6 p-s5 md:p-s6 bg-bg-2 rounded-2 min-w-0',
        'almanac:border almanac:border-rule',
        'strata:shadow-plate strata:border-t-4 strata:border-t-layer-2',
        'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-s7',
      )}
    >
      {/* left: the paper */}
      <div className="grid gap-s5 content-start min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Kicker parts={[`Paper ${String(index + 1).padStart(2, '0')}`, journal, r.year]} />
          {publisher ? <Mono tone="ink-3">{publisher}</Mono> : null}
        </div>

        <h3 id={headingId} className="display m-0 text-3 md:text-4 [overflow-wrap:anywhere]">
          {r.title}
        </h3>

        <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-ink-2 almanac:italic">
          <span>{journal}</span>
          {metaParts(r).map((p) => (
            <span key={p} className="not-italic mono nums self-center text-ink-3">{p}</span>
          ))}
        </p>

        {r.authorPosition && r.authorCount && r.authorPosition <= r.authorCount ? (
          <AuthorStrip position={r.authorPosition} count={r.authorCount} name={name} />
        ) : null}

        {r.abstract ? <p className="m-0 measure text-1 text-ink">{r.abstract}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          {lead ? (
            <ButtonLink href={`/playground/${lead.slug}`} icon="pulse">
              {`Try ${lead.title}`}
            </ButtonLink>
          ) : null}
          {r.url ? (
            <ButtonLink href={r.url} variant="secondary" icon="external" aria-label={`Read "${r.title}" at the publisher (opens in a new tab)`}>
              Read the paper
            </ButtonLink>
          ) : null}
        </div>

        {r.doi ? (
          <a
            href={`https://doi.org/${r.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mono inline-flex items-center gap-2 min-h-tap self-start max-w-full text-accent-ink no-underline border-b border-current hover:text-ink [overflow-wrap:anywhere] normal-case"
          >
            <span className="uppercase">DOI</span>
            <span className="tracking-normal">{r.doi}</span>
            <Icon name="arrow-up-right" size={14} />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}

        {bibtex ? <Citation bibtex={bibtex} /> : null}
      </div>

      {/* right: the results */}
      {r.results.length ? (
        <figure className="m-0 grid gap-s5 content-start min-w-0 p-s5 bg-surface rounded-1 almanac:border almanac:border-rule">
          <figcaption className="grid gap-1">
            <Mono tone="accent">Results</Mono>
            {r.resultsCaption ? <span className="text-0 text-ink-2">{r.resultsCaption}</span> : null}
          </figcaption>
          <div className="grid gap-s5">
            {r.results.map((res, i) => (
              <Meter
                key={res.label}
                label={res.label}
                value={res.value}
                unit={res.unit}
                ink={((i % 3) + 1) as 1 | 2 | 3}
                note={res.note}
              />
            ))}
          </div>
          {proofs.length ? <ProofRow slugs={proofs} className="pt-s3 border-t border-rule-soft" /> : null}
        </figure>
      ) : proofs.length ? (
        <ProofRow slugs={proofs} />
      ) : null}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* neighbouring pipeline                                               */
/* ------------------------------------------------------------------ */

const STEP_GLYPHS: IconName[] = ['pulse', 'sine', 'square', 'saw']

function Pipeline({ title, note, steps, demoSlug }: { title: string; note: string; steps: string[]; demoSlug?: DemoSlug }) {
  const proof = demoSlug && isDemoEnabled(demoSlug) ? demoSlug : undefined
  return (
    <section aria-labelledby="research-pipeline" className="grid gap-s5 mt-s7">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:gap-s6">
        <div className="grid gap-2">
          <Mono tone="ink-3" className="inline-flex items-center gap-2">
            <Icon name="strata" size={16} />
            {`${steps.length} steps`}
          </Mono>
          <h3 id="research-pipeline" className="display m-0 text-3">{title}</h3>
        </div>
        {note ? <p className="m-0 text-0 text-ink-2 measure">{note}</p> : null}
      </div>

      <ol className="m-0 p-0 list-none grid gap-px grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 almanac:bg-rule almanac:border almanac:border-rule strata:gap-s3">
        {steps.map((s, i) => (
          <li
            key={`${i}-${s}`}
            className="relative grid gap-s3 content-start p-s4 min-h-[7.5rem] bg-surface strata:rounded-1 strata:shadow-[inset_0_3px_0_var(--step-layer)]"
            style={{ ['--step-layer' as string]: `var(--layer-${(i % 6) + 1})` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="display text-3 nums text-accent-ink strata:text-accent">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-ink-3"><Icon name={STEP_GLYPHS[i % STEP_GLYPHS.length] ?? 'pulse'} size={22} /></span>
            </div>
            <span className="text-0 text-ink">{s}</span>
          </li>
        ))}
      </ol>

      {proof ? <ProofRow slugs={[proof]} /> : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* section                                                             */
/* ------------------------------------------------------------------ */

export default function Research({ section, folio }: SectionProps) {
  const { items, pipeline } = getResearch()
  const showPipeline = pipeline.enabled && pipeline.steps.length > 0
  if (!items.length && !showPipeline) return null
  const { name } = getProfile()

  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Research'} note={section.note}>
      <div className="grid gap-s7">
        {items.map((r, i) => <Paper key={r.id} r={r} name={name} index={i} />)}
      </div>
      {showPipeline ? (
        <Pipeline title={pipeline.title} note={pipeline.note} steps={pipeline.steps} demoSlug={pipeline.demoSlug} />
      ) : null}
    </SectionShell>
  )
}
