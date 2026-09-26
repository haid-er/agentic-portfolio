/**
 * Working record (DESIGN.md 6.4, 5): a borehole-style timeline of every role,
 * then the ledger itself.
 *
 * - The timeline strip draws each role to scale on a month axis (overlaps get
 *   their own lane) and links down to its ledger entry.
 * - Current roles print as a feature card; past roles sit in a 3-column ledger at
 *   >= 900px (hairlines in Almanac, gapped cards in Strata), one column on mobile.
 * - Every highlight with a visible proof demo ends in "Proof: slug".
 * - The only metric is the one in content (experience.metric).
 *
 * All copy comes from content/experience.json and the demo registry.
 */
import type { CSSProperties } from 'react'
import { Badge, Icon, Metric, ProofLink, SectionShell, Tag, type Layer } from '@/components/ui'
import { getExperience, type ExperienceItem } from '@/lib/content'
import { isDemoEnabled, type DemoSlug } from '@/lib/demos'
import { cx, formatPartialDate, formatRange } from '@/lib/utils'
import type { SectionProps } from './types'

/* ------------------------------------------------------------------ */
/* dates                                                               */
/* ------------------------------------------------------------------ */

/** "2025-09" -> absolute month index; "" -> undefined. */
function monthIndex(d: string): number | undefined {
  const [y, m] = d.split('-')
  const year = Number(y)
  if (!y || Number.isNaN(year)) return undefined
  const month = m ? Number(m) - 1 : 0
  return year * 12 + (Number.isNaN(month) ? 0 : month)
}

/** Exclusive end month: an end month counts in full; "" = through this month. */
function endIndex(end: string, now: number): number | undefined {
  if (!end) return now + 1
  const i = monthIndex(end)
  if (i === undefined) return undefined
  return end.includes('-') ? i + 1 : i + 12
}

/** "1 yr 1 mo" for finished roles with month precision (present roles are left out, never estimated). */
function duration(e: ExperienceItem): string {
  if (!e.end || !e.start.includes('-') || !e.end.includes('-')) return ''
  const s = monthIndex(e.start)
  const t = monthIndex(e.end)
  if (s === undefined || t === undefined || t < s) return ''
  const months = t - s + 1
  const y = Math.floor(months / 12)
  const m = months % 12
  return [y ? `${y} yr` : '', m ? `${m} mo` : ''].filter(Boolean).join(' ')
}

const MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', 'on-site': 'On-site' }

/* ------------------------------------------------------------------ */
/* model                                                               */
/* ------------------------------------------------------------------ */

interface Entry {
  item: ExperienceItem
  n: number
  layer: Layer
  anchor: string
  range: string
}

const toLayer = (i: number) => ((i % 6) + 1) as Layer
const layerStyle = (layer: Layer) => ({ '--layer': `var(--layer-${layer})` }) as CSSProperties

function proofFor(slug: DemoSlug | undefined): DemoSlug | undefined {
  return slug && isDemoEnabled(slug) ? slug : undefined
}

/* ------------------------------------------------------------------ */
/* timeline strip                                                      */
/* ------------------------------------------------------------------ */

interface Bar {
  entry: Entry
  start: number
  end: number
  lane: number
}

function layoutBars(entries: Entry[], now: number): { bars: Bar[]; lanes: number; min: number; max: number } {
  const spans = entries
    .map((entry) => ({ entry, start: monthIndex(entry.item.start), end: endIndex(entry.item.end, now) }))
    .filter((s): s is { entry: Entry; start: number; end: number } => s.start !== undefined && s.end !== undefined && s.end > s.start)
    .sort((a, b) => a.start - b.start)

  const laneEnds: number[] = []
  const bars = spans.map((s) => {
    let lane = laneEnds.findIndex((end) => end <= s.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = s.end
    return { ...s, lane }
  })
  const min = Math.min(...bars.map((b) => b.start))
  const max = Math.max(...bars.map((b) => b.end))
  return { bars, lanes: laneEnds.length, min, max }
}

function Timeline({ entries }: { entries: Entry[] }) {
  const today = new Date()
  const now = today.getUTCFullYear() * 12 + today.getUTCMonth()
  const { bars, lanes, min, max } = layoutBars(entries, now)
  if (bars.length < 2) return null

  const span = max - min
  const pct = (i: number) => `${((i - min) / span) * 100}%`
  const firstYear = Math.ceil(min / 12)
  const lastYear = Math.floor(max / 12)
  const ticks: number[] = []
  for (let y = firstYear; y <= lastYear; y++) {
    const at = (y * 12 - min) / span
    if (at > 0.1 && at < 0.9) ticks.push(y)
  }
  const earliest = bars.reduce((a, b) => (b.start < a.start ? b : a))
  const hasPresent = bars.some((b) => !b.entry.item.end)

  return (
    // Below 768px the strip is too narrow to label; the ledger cards below carry the dates.
    <nav aria-label="Timeline of roles" className="mb-s7 hidden md:block">
      <div className="relative grid gap-1 py-s3 border-y border-rule strata:border-rule-soft">
        {/* year gridlines, behind the bars */}
        {ticks.map((y) => (
          <span
            key={y}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-rule-soft"
            style={{ left: pct(y * 12) }}
          />
        ))}
        {Array.from({ length: lanes }, (_, lane) => (
          <ol key={lane} className="relative h-11 list-none m-0 p-0">
            {bars
              .filter((b) => b.lane === lane)
              .map((b) => {
                const { item, n, layer, anchor, range } = b.entry
                const present = !item.end
                return (
                  <li
                    key={item.id}
                    className="absolute inset-y-0"
                    style={{ left: pct(b.start), width: `max(2.75rem, ${((b.end - b.start) / span) * 100}%)`, maxWidth: `calc(100% - ${pct(b.start)})` }}
                  >
                    <a
                      href={`#${anchor}`}
                      aria-label={`Layer ${n}: ${item.role}, ${item.org}, ${range}`}
                      style={layerStyle(layer)}
                      className={cx(
                        'group flex h-full items-center gap-2 px-2 overflow-hidden no-underline text-ink',
                        'bg-surface border border-rule rounded-0 shadow-[inset_4px_0_0_var(--layer)]',
                        'transition-transform duration-[var(--dur-fast)] hover:-translate-y-[2px] focus-visible:-translate-y-[2px]',
                        'almanac:hover:shadow-[inset_4px_0_0_var(--layer),var(--shadow-pop)]',
                      )}
                    >
                      <span aria-hidden="true" className="display text-1 nums leading-none text-accent-ink pl-1">{n}</span>
                      <span aria-hidden="true" className="mono text-ink-2 truncate hidden xs:block group-hover:text-ink">
                        {item.org}
                      </span>
                      {present ? (
                        <span aria-hidden="true" className="ml-auto shrink-0 text-accent-ink"><Icon name="arrow" size={14} /></span>
                      ) : null}
                    </a>
                  </li>
                )
              })}
          </ol>
        ))}
      </div>
      <div aria-hidden="true" className="relative h-6 mt-2 mono text-ink-3 nums">
        <span className="absolute left-0">{formatPartialDate(earliest.entry.item.start)}</span>
        {ticks.map((y) => (
          <span key={y} className="absolute -translate-x-1/2" style={{ left: pct(y * 12) }}>{y}</span>
        ))}
        {hasPresent ? <span className="absolute right-0">Present</span> : null}
      </div>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* ledger entry                                                        */
/* ------------------------------------------------------------------ */

function MetaLine({ entry }: { entry: Entry }) {
  const { item, n } = entry
  const parts = [entry.range, duration(item), MODE[item.mode ?? ''] ?? '', item.location ?? '', `Layer ${n}`].filter(Boolean)
  return (
    <p className="mono text-ink-3 m-0 flex flex-wrap gap-x-2 gap-y-1">
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="inline-flex gap-2">
          {i > 0 ? <span aria-hidden="true">·</span> : null}
          <span className="nums">{p}</span>
        </span>
      ))}
    </p>
  )
}

function OrgLine({ item }: { item: ExperienceItem }) {
  const showProduct = item.product && !item.org.toLowerCase().includes(item.product.toLowerCase())
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ink-2 almanac:italic">
      {item.orgUrl ? (
        <a
          href={item.orgUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 min-h-tap text-ink-2 hover:text-ink underline decoration-1 underline-offset-4 decoration-accent-ink"
        >
          {item.org}
          <Icon name="external" size={14} />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span>{item.org}</span>
      )}
      {showProduct ? (
        <span className="not-italic inline-flex items-baseline gap-2">
          <span className="mono text-ink-3">Product</span>
          <span className="text-ink">{item.product}</span>
        </span>
      ) : null}
    </p>
  )
}

function Highlights({ item }: { item: ExperienceItem }) {
  if (!item.highlights.length) return null
  return (
    <div className="@container min-w-0">
    <ul className="list-none m-0 p-0 grid gap-s3">
      {item.highlights.map((h, i) => {
        const proof = proofFor(h.proofDemo)
        return (
          <li key={i} className="grid grid-cols-[0.875rem_1fr] gap-x-3">
            <span
              aria-hidden="true"
              className="mt-[0.55em] size-2 bg-[var(--layer)] almanac:rotate-45 strata:rounded-full"
            />
            <div className="grid gap-1 min-w-0 @xl:grid-cols-[1fr_minmax(1.5rem,5rem)_auto] @xl:items-end @xl:gap-x-3">
              <p className="m-0 text-ink measure">{h.text}</p>
              {proof ? (
                <>
                  <span aria-hidden="true" className="hidden @xl:block mb-[1.1rem] border-b-2 border-dotted border-rule-soft" />
                  <ProofLink slug={proof} className="@xl:self-end" />
                </>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
    </div>
  )
}

function Stack({ stack }: { stack: string[] }) {
  const items = stack.filter(Boolean)
  if (!items.length) return null
  return (
    <div className="grid gap-2">
      <p className="mono text-ink-3 m-0">Stack</p>
      <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
        {items.map((s) => <li key={s}><Tag>{s}</Tag></li>)}
      </ul>
    </div>
  )
}

function EntryBody({ entry, feature }: { entry: Entry; feature?: boolean }) {
  const { item } = entry
  const titleId = `${entry.anchor}-title`
  return (
    <article aria-labelledby={titleId} className="@container grid gap-s4 min-w-0">
      <div className={cx('grid gap-s4', feature && '@3xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @3xl:gap-s7')}>
        <div className="grid gap-s3 content-start min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <MetaLine entry={entry} />
            {feature && !item.end ? <Badge tone="accent">Current</Badge> : null}
          </div>
          <h3 id={titleId} className={cx(feature ? 'text-4' : 'text-3', 'leading-[1.02]')}>{item.role}</h3>
          <OrgLine item={item} />
          {item.summary ? <p className="m-0 text-ink-2 measure">{item.summary}</p> : null}
          {item.metric ? (
            <Metric from={item.metric.from} to={item.metric.to} label={item.metric.label} className="mt-s2" />
          ) : null}
          {feature ? <Stack stack={item.stack} /> : null}
        </div>
        <div className="grid gap-s4 content-start min-w-0">
          <Highlights item={item} />
          {feature ? null : <Stack stack={item.stack} />}
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* section                                                             */
/* ------------------------------------------------------------------ */

const TARGET = 'scroll-mt-24 target:outline-2 target:outline-offset-8 target:outline-accent target:outline-dashed'

/** Fallback heading when the admin leaves the section title empty. */
export const DEFAULT_TITLE = 'Experience'

/** The same test as this section's early `return null` (used by the nav and index). */
export const shouldRender = (): boolean => getExperience().length > 0

export default function Experience({ section, folio }: SectionProps) {
  const items = getExperience()
  if (!items.length) return null

  const entries: Entry[] = items.map((item, i) => ({
    item,
    n: i + 1,
    layer: toLayer(i),
    anchor: `experience-${item.id}`,
    range: formatRange(item.start, item.end),
  }))
  const current = entries.filter((e) => !e.item.end)
  const past = entries.filter((e) => e.item.end)

  return (
    <SectionShell id={section.id} folio={folio} title={section.title || DEFAULT_TITLE} note={section.note}>
      <Timeline entries={entries} />

      {current.length ? (
        <ol className="list-none m-0 p-0 grid gap-s6 mb-s7">
          {current.map((e) => (
            <li
              key={e.item.id}
              id={e.anchor}
              style={layerStyle(e.layer)}
              className={cx(
                TARGET,
                'bg-surface rounded-2 p-s5 md:p-s6',
                'almanac:border almanac:border-rule almanac:shadow-plate',
                'strata:shadow-plate strata:border-t-4 strata:border-t-[var(--layer)]',
              )}
            >
              <EntryBody entry={e} feature />
            </li>
          ))}
        </ol>
      ) : null}

      {past.length ? (
        <ol
          start={current.length + 1}
          className="list-none m-0 p-0 grid gap-s6 mid:grid-cols-3 mid:gap-x-0 strata:mid:gap-x-s4"
        >
          {past.map((e, i) => (
            <li
              key={e.item.id}
              id={e.anchor}
              style={layerStyle(e.layer)}
              className={cx(
                TARGET,
                'min-w-0',
                'almanac:border-t almanac:border-rule almanac:pt-s5',
                'almanac:mid:px-s5 almanac:mid:border-l almanac:mid:nth-[3n+1]:border-l-0 almanac:mid:nth-[3n+1]:pl-0',
                i === 0 && !current.length && 'almanac:border-t-0',
                'strata:bg-surface strata:rounded-2 strata:p-s5 strata:shadow-plate strata:border-t-4 strata:border-t-[var(--layer)]',
              )}
            >
              <EntryBody entry={e} />
            </li>
          ))}
        </ol>
      ) : null}
    </SectionShell>
  )
}
