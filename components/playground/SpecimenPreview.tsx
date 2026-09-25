/**
 * Specimen preview window (DESIGN.md 10): 16:10, drawn in the current world's
 * inks. Almanac: halftone ground (sprocket holes on live traces). Strata: a
 * --bg well with a faint graticule. The caption sits on a solid plate.
 */
import type { PosterKind } from './posters'
import { cx } from '@/lib/utils'
import { LiveTrace } from './LiveTrace'
import { PosterSvg } from './PosterSvg'
import { posterCaption } from './posters'

export function SpecimenPreview({ slug, glyph, live = false, tag, className }: {
  slug: string
  /** Mono tag in the top-right corner (catalogue number). */
  tag?: string
  glyph: PosterKind
  /** Scroll the trace (pulse posters only). 'manual' starts paused with a Play button. */
  live?: boolean | 'manual'
  className?: string
}) {
  const isLive = Boolean(live) && glyph === 'pulse'
  return (
    <div
      className={cx(
        'relative aspect-[16/10] w-full overflow-hidden isolate',
        'almanac:border almanac:border-rule almanac:bg-bg-2 strata:rounded-1 strata:bg-bg',
        className,
      )}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 strata:opacity-70" style={{ background: 'var(--pattern)' }} />
      {isLive ? (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 z-10 hidden w-3 almanac:block bg-surface border-r border-rule [background-image:radial-gradient(circle,var(--ink)_2.2px,transparent_2.6px)] [background-size:12px_16px] [background-position:center_4px]"
          />
          <LiveTrace slug={slug} glyph={glyph} autoplay={live !== 'manual'} className="absolute inset-0 almanac:left-3" />
        </>
      ) : (
        <PosterSvg slug={slug} glyph={glyph} className="absolute inset-0 block size-full" />
      )}
      <span className={cx('mono absolute bottom-2 left-2 z-10 bg-surface px-2 py-1 text-ink-3', isLive && 'almanac:left-5')}>
        {posterCaption(slug, glyph)}
      </span>
      {tag ? (
        <span aria-hidden="true" className="mono nums absolute top-2 right-2 z-10 border border-rule bg-surface px-2 py-1 text-ink strata:rounded-pill">
          {tag}
        </span>
      ) : null}
    </div>
  )
}
