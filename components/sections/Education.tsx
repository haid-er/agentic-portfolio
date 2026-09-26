/**
 * Education: each programme prints as a ledger card (DESIGN.md 6.4 / 6.7).
 *
 * - Meta line in mono: dates · location (missing dates are hidden, never guessed).
 * - Degree + field in display type, institution beneath (italic in Almanac).
 * - Grade shows as a bordered slug only when content holds one.
 * - Notes as a short list; the card ends in "Proof:" links to visible demos.
 * - The newest programme is the feature card; older ones sit beside it.
 *
 * All copy comes from content/education.json and the demo registry.
 */
import { Badge, Card, Mono, ProofRow, SectionShell, type Layer } from '@/components/ui'
import { getEducation, type EducationItem } from '@/lib/content'
import { isDemoEnabled } from '@/lib/demos'
import { cx, formatPartialDate } from '@/lib/utils'
import type { SectionProps } from './types'

/** Dates only when content holds them: "Dec 2021 – May 2025", "Dec 2021 – Present", "May 2025". */
function dateLine(e: EducationItem): string {
  const s = formatPartialDate(e.start)
  const t = formatPartialDate(e.end)
  if (s && t) return `${s} – ${t}`
  if (s) return `${s} – Present`
  return t
}

function Entry({ e, n, feature, span }: { e: EducationItem; n: number; feature: boolean; span: 1 | 2 | 3 }) {
  const proofs = (e.demoSlugs ?? []).filter((s) => isDemoEnabled(s))
  const meta = [dateLine(e), e.location ?? ''].filter(Boolean)
  const layer = (((n - 1) % 6) + 1) as Layer
  const headingId = `edu-${e.id}`

  return (
    <Card
      as="article"
      aria-labelledby={headingId}
      feature={feature}
      layer={layer}
      className={cx('grid gap-s4 content-start', span === 2 && 'mid:col-span-2', span === 3 && 'mid:col-span-3')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Mono tone="ink-3" className="flex flex-wrap gap-x-2 nums">
          {meta.map((m, i) => (
            <span key={m} className="inline-flex gap-2">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              {m}
            </span>
          ))}
        </Mono>
        <span aria-hidden="true" className="display text-2 text-accent-ink almanac:font-light strata:text-accent-2 nums">
          {`E${n}`}
        </span>
      </div>

      <div className="grid gap-2">
        <h3 id={headingId} className={cx('display m-0 [overflow-wrap:anywhere]', feature ? 'text-3 md:text-4' : 'text-3')}>
          {e.degree}
          {e.field ? <span className="block mt-1 text-2 text-ink-2">{e.field}</span> : null}
        </h3>
        <p className="m-0 text-1 text-ink-2 almanac:italic">{e.institution}</p>
      </div>

      {e.grade ? (
        <div>
          <Badge tone="accent" className="nums">{e.grade}</Badge>
        </div>
      ) : null}

      {e.notes.length ? (
        <ul className={cx('m-0 p-0 list-none grid gap-2 measure', feature && 'md:grid-cols-2 md:gap-x-s6 md:max-w-none')}>
          {e.notes.map((note) => (
            <li key={note} className="relative pl-5 text-0 text-ink">
              <span aria-hidden="true" className="absolute left-0 top-[.6em] w-3 border-t-2 border-accent-2" />
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      {proofs.length ? <ProofRow slugs={proofs} className="mt-auto pt-s3 border-t border-rule-soft" /> : null}
    </Card>
  )
}

/** Fallback heading when the admin leaves the section title empty. */
export const DEFAULT_TITLE = 'Education'

/** The same test as this section's early `return null` (used by the nav and index). */
export const shouldRender = (): boolean => getEducation().length > 0

export default function Education({ section, folio }: SectionProps) {
  const items = getEducation()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || DEFAULT_TITLE} note={section.note}>
      <div className="grid gap-s5 mid:grid-cols-3 mid:items-stretch">
        {items.map((e, i) => (
          <Entry key={e.id} e={e} n={i + 1} feature={i === 0} span={i > 0 ? 1 : items.length === 1 ? 3 : 2} />
        ))}
      </div>
    </SectionShell>
  )
}
