/**
 * Certifications as printed "verification slips".
 *
 * - Newest first; undated items keep their content order at the end.
 * - Each slip: date (mono), course name (display), issuer, credential id, and a
 *   "Verify" link to the issuer's own page (host shown, so the reader knows where it goes).
 * - No verify link in content means no button: nothing is implied.
 * - Every slip ends in "Proof:" links to visible demos.
 *
 * All copy comes from content/certifications.json and the demo registry.
 */
import { ButtonLink, Card, CopyButton, Mono, ProofRow, SectionShell, type Layer } from '@/components/ui'
import { getCertifications, type Certification } from '@/lib/content'
import { isDemoEnabled } from '@/lib/demos'
import { formatPartialDate } from '@/lib/utils'
import type { SectionProps } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2024-11-09" -> "9 Nov 2024"; shorter partial dates use the shared formatter. */
function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  if (y && m && day) return `${Number(day)} ${MONTHS[Number(m) - 1] ?? ''} ${y}`
  return formatPartialDate(d)
}

/** Newest first, undated last (stable). */
function byDateDesc(items: Certification[]): Certification[] {
  return items
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      if (!a.c.date && !b.c.date) return a.i - b.i
      if (!a.c.date) return 1
      if (!b.c.date) return -1
      return b.c.date.localeCompare(a.c.date) || a.i - b.i
    })
    .map(({ c }) => c)
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function Slip({ c, n }: { c: Certification; n: number }) {
  const proofs = (c.demoSlugs ?? []).filter((s) => isDemoEnabled(s))
  const date = c.date ? formatDate(c.date) : ''
  const verify = c.url && /^https?:\/\//.test(c.url) ? c.url : ''
  const host = verify ? hostOf(verify) : ''
  const layer = (((n - 1) % 6) + 1) as Layer
  const headingId = `cert-${c.id}`

  return (
    <Card as="article" aria-labelledby={headingId} layer={layer} className="grid gap-s4 content-start overflow-hidden">
      {/* perforated stub edge (decorative) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-3 left-0 w-0 border-l-2 border-dotted border-rule-soft"
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Mono tone="accent" className="nums">{date ? <time dateTime={c.date}>{date}</time> : 'Certificate'}</Mono>
        <Mono tone="ink-3" aria-hidden="true" className="nums">{`No. ${String(n).padStart(2, '0')}`}</Mono>
      </div>

      <div className="grid gap-2">
        <h3 id={headingId} className="display m-0 text-2 md:text-3 [overflow-wrap:anywhere]">{c.name}</h3>
        {c.issuer ? <p className="m-0 text-0 text-ink-2 almanac:italic">{c.issuer}</p> : null}
      </div>

      {c.credentialId || verify ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-s3 border-t border-dashed border-rule-soft">
          {c.credentialId ? (
            <dl className="m-0 grid gap-1 min-w-0">
              <dt className="mono text-ink-3">Credential ID</dt>
              <dd className="m-0 font-mono text-0 text-ink nums [overflow-wrap:anywhere] select-all">{c.credentialId}</dd>
            </dl>
          ) : <span />}
          {c.credentialId ? <CopyButton text={c.credentialId} label="Copy ID" variant="ghost" /> : null}
          {verify ? (
            <ButtonLink
              href={verify}
              variant="secondary"
              size="sm"
              icon="check"
              aria-label={`Verify ${c.name}${host ? ` on ${host}` : ''} (opens in a new tab)`}
            >
              {host ? `Verify on ${host}` : 'Verify'}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      {proofs.length ? <ProofRow slugs={proofs} /> : null}
    </Card>
  )
}

/** Fallback heading when the admin leaves the section title empty. */
export const DEFAULT_TITLE = 'Certifications'

/** The same test as this section's early `return null` (used by the nav and index). */
export const shouldRender = (): boolean => getCertifications().length > 0

export default function Certifications({ section, folio }: SectionProps) {
  const items = byDateDesc(getCertifications())
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || DEFAULT_TITLE} note={section.note}>
      <ol className="m-0 p-0 list-none grid gap-s5 md:grid-cols-2">
        {items.map((c, i) => (
          <li key={c.id} className="grid min-w-0">
            <Slip c={c} n={i + 1} />
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}
