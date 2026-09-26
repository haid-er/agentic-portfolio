/**
 * Specimen-sheet demo card (DESIGN.md 10). Presentational only (no hooks), so it
 * renders on the server (homepage, demo page) and inside the client gallery.
 * The "proves" chip row is a slot: filter buttons in the gallery, links elsewhere.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Badge, ButtonLink, Card, Icon } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { DemoCardModel } from './model'
import { catalogueNo, runsInLabel } from './slug'
import { SpecimenPreview } from './SpecimenPreview'

export interface SpecimenCardProps {
  card: DemoCardModel
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** Chip row under the mirrors inset. */
  proves?: ReactNode
  /** Extra action next to "Open demo". */
  secondary?: ReactNode
  /** Wide = preview left, text right at >= 900px (homepage featured). */
  wide?: boolean
  feature?: boolean
  /** Scroll the trace on pulse posters ('manual' = starts paused). */
  live?: boolean | 'manual'
  /** Hide the mirrors inset (compact related cards). */
  compact?: boolean
  className?: string
}

export function SpecimenCard({
  card, headingLevel: H = 'h3', proves, secondary, wide, feature, live, compact, className,
}: SpecimenCardProps) {
  const titleId = `specimen-${card.slug}`
  const href = `/playground/${card.slug}`
  return (
    <Card
      as="article"
      aria-labelledby={titleId}
      layer={card.layer}
      feature={feature}
      padded={false}
      className={cx(
        'group flex h-full flex-col',
        'transition-[box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        !feature && 'almanac:hover:shadow-press almanac:focus-within:shadow-press',
        'strata:motion-safe:hover:-translate-y-0.5',
        wide && 'mid:grid mid:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]',
        className,
      )}
    >
      <div className={cx('p-s3 pb-0', wide && 'mid:p-s5 mid:pr-0')}>
        <SpecimenPreview slug={card.slug} glyph={card.poster} live={live} tag={catalogueNo(card.no)} />
      </div>

      <div className={cx('flex flex-1 flex-col gap-s3 p-s4', wide && 'mid:p-s5')}>
        <p className="mono m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-3">
          <Icon name={card.glyph} size={16} className="text-accent-ink" />
          <span>{card.pillarLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{runsInLabel(card.runsIn)}</span>
        </p>

        <H id={titleId} className={cx('display', wide ? 'text-4' : 'text-3')}>
          <Link href={href} className="no-underline hover:underline decoration-accent-2 decoration-2">
            {card.title}
          </Link>
        </H>

        <p className="m-0 text-ink-2">{card.summary}</p>

        {!compact && card.mirrors ? (
          <div className="border-l-4 border-accent-2 bg-bg-2 px-s3 py-s2 strata:rounded-r-1">
            <p className="mono m-0 text-ink-3">Mirrors</p>
            <p className="m-0 text-0 text-ink">{card.mirrors}</p>
          </div>
        ) : null}

        {proves}

        <div className="mt-auto flex flex-wrap items-center gap-s2 pt-s2">
          <ButtonLink href={href} size="sm" aria-label={`Open demo: ${card.title}`}>Open demo</ButtonLink>
          {secondary}
          {card.usesAI ? <Badge tone="accent">Uses AI</Badge> : null}
        </div>

        <PhoneNote mobile={card.mobile} />
      </div>
    </Card>
  )
}

/** "Works on phone" or an honest "Best on desktop: {reason}" (always present). */
export function PhoneNote({ mobile, className }: { mobile: DemoCardModel['mobile']; className?: string }) {
  return (
    <p className={cx('mono m-0 flex items-start gap-2 text-ink-3', className)}>
      <Icon name={mobile.ok ? 'check' : 'info'} size={14} className="mt-[1px]" />
      <span>{mobile.ok ? 'Works on phone' : `Best on desktop: ${mobile.reason}`}</span>
    </p>
  )
}
