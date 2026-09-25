/**
 * Achievements (DESIGN.md 6.5 stamp).
 *
 * - Items marked `stamp` print as a circular text stamp rotated -8°: solid
 *   --accent-2 ink in Almanac, a dashed lichen ring in Strata. The stamp has an
 *   aria-label and is decorative in role; the same facts are also printed as text.
 * - Every other item is a ledger row: kind slug (text, never colour only), date,
 *   title, detail, an optional external link and "Proof:" links.
 * - Disabled or unverified items never reach this component (getters filter them).
 *
 * All copy comes from content/achievements.json and the demo registry.
 */
import { Badge, Card, Icon, Mono, ProofRow, SectionShell, type IconName, type Tone } from '@/components/ui'
import { getAchievements, type Achievement } from '@/lib/content'
import { isDemoEnabled } from '@/lib/demos'
import { cx, formatPartialDate } from '@/lib/utils'
import type { SectionProps } from './types'

type Kind = Achievement['kind']

const KIND: Record<Kind, { label: string; icon: IconName; tone: Tone }> = {
  award: { label: 'Award', icon: 'register', tone: 'accent' },
  competition: { label: 'Competition', icon: 'saw', tone: 'ok' },
  talk: { label: 'Talk', icon: 'sine', tone: 'neutral' },
  leadership: { label: 'Leadership', icon: 'nodes', tone: 'neutral' },
  badge: { label: 'Badge', icon: 'github', tone: 'neutral' },
  other: { label: 'Note', icon: 'leaders', tone: 'neutral' },
}

const proofsOf = (a: Achievement) => (a.demoSlugs ?? []).filter((s) => isDemoEnabled(s))
const isExternal = (href: string | undefined): href is string => Boolean(href && /^https?:\/\//.test(href))

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/* ------------------------------------------------------------------ */
/* stamp                                                               */
/* ------------------------------------------------------------------ */

function Stamp({ a }: { a: Achievement }) {
  const pathId = `stamp-ring-${a.id}`
  const ring = `${a.title.toUpperCase()} · `
  // r = 76 on a 200 box; leave a small gap so the text doesn't collide with itself
  const circumference = 2 * Math.PI * 76
  // size the letters so one pass of the title fills the ring (mono ≈ 0.62em per glyph)
  const fontSize = Math.min(17, Math.max(9, circumference / (ring.length * 0.72)))
  return (
    <div
      role="img"
      aria-label={a.title}
      className={cx(
        'relative shrink-0 w-[min(15rem,70vw)] aspect-square text-accent-2 -rotate-[8deg]',
        'motion-safe:transition-transform motion-safe:duration-[var(--dur-med)] motion-safe:ease-[var(--ease-out)]',
        'motion-safe:group-hover:-rotate-[5deg]',
      )}
    >
      <svg viewBox="0 0 200 200" className="block w-full h-full overflow-visible" aria-hidden="true" focusable="false">
        <defs>
          <path id={pathId} d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" />
        </defs>
        {/* outer and inner rings: solid ink in Almanac, dashed in Strata */}
        <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="3" className="strata:[stroke-dasharray:7_5]" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1.5" className="strata:[stroke-dasharray:3_4]" />
        <text
          className="font-mono"
          fill="currentColor"
          fontSize={fontSize.toFixed(1)}
          style={{ textTransform: 'uppercase' }}
        >
          <textPath href={`#${pathId}`} textLength={circumference - 6} lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
        {/* centre: the register mark, the house glyph */}
        <g stroke="currentColor" strokeWidth="2" fill="none" transform="translate(100 100)">
          <circle r="22" />
          <path d="M0 -40 V40 M-40 0 H40" />
        </g>
      </svg>
      {/* overprint copy, slightly out of register (Almanac only, decorative) */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 w-full h-full hidden almanac:block mix-blend-multiply text-accent opacity-25 translate-x-[2px] translate-y-[1px]"
      >
        <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>
    </div>
  )
}

function StampFeature({ a }: { a: Achievement }) {
  const proofs = proofsOf(a)
  const k = KIND[a.kind]
  return (
    <Card
      as="article"
      feature
      layer={2}
      aria-labelledby={`ach-${a.id}`}
      className="group grid gap-s6 items-center md:grid-cols-[auto_minmax(0,1fr)] md:gap-s7"
    >
      <div className="justify-self-center py-s3">
        <Stamp a={a} />
      </div>
      <div className="grid gap-s4 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={k.tone}><Icon name={k.icon} size={14} />{k.label}</Badge>
          {a.date ? <Mono tone="ink-3" className="nums">{formatPartialDate(a.date)}</Mono> : null}
        </div>
        <h3 id={`ach-${a.id}`} className="display m-0 text-3 md:text-4 [overflow-wrap:anywhere]">{a.title}</h3>
        {a.detail ? <p className="m-0 measure text-1 text-ink-2">{a.detail}</p> : null}
        <Extras a={a} proofs={proofs} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* ledger rows                                                         */
/* ------------------------------------------------------------------ */

function Extras({ a, proofs }: { a: Achievement; proofs: string[] }) {
  const link = isExternal(a.url) ? a.url : ''
  if (!link && !proofs.length) return null
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mono inline-flex items-center gap-2 min-h-tap text-ink no-underline border-b border-current hover:text-accent-ink"
        >
          <span>{hostOf(link)}</span>
          <Icon name="arrow-up-right" size={14} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}
      {proofs.length ? <ProofRow slugs={proofs} /> : null}
    </div>
  )
}

function Row({ a }: { a: Achievement }) {
  const k = KIND[a.kind]
  const proofs = proofsOf(a)
  return (
    <li className="grid gap-s3 py-s5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-s6 border-t border-rule-soft first:border-t-0 almanac:first:border-t almanac:first:border-rule">
      <div className="flex flex-wrap items-center gap-3 md:flex-col md:items-start">
        <Badge tone={k.tone}><Icon name={k.icon} size={14} />{k.label}</Badge>
        {a.date ? <Mono tone="ink-3" className="nums">{formatPartialDate(a.date)}</Mono> : null}
      </div>
      <div className="grid gap-2 min-w-0">
        <h3 className="display m-0 text-2 [overflow-wrap:anywhere]">{a.title}</h3>
        {a.detail ? <p className="m-0 measure text-0 text-ink-2">{a.detail}</p> : null}
        <Extras a={a} proofs={proofs} />
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* section                                                             */
/* ------------------------------------------------------------------ */

export default function Achievements({ section, folio }: SectionProps) {
  const items = getAchievements()
  if (!items.length) return null
  const stamps = items.filter((a) => a.stamp)
  const rows = items.filter((a) => !a.stamp)

  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Achievements'} note={section.note}>
      <div className="grid gap-s7">
        {stamps.map((a) => <StampFeature key={a.id} a={a} />)}
        {rows.length ? <ul className="m-0 p-0 list-none">{rows.map((a) => <Row key={a.id} a={a} />)}</ul> : null}
      </div>
    </SectionShell>
  )
}
