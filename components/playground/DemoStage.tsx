/**
 * The plate a live demo is printed on: a mono plate head ("Plate 07 · slug",
 * where it runs) over a solid surface, so demo UI never sits on halftone or
 * contour texture. The demo itself loads client-side (next/dynamic, ssr:false).
 */
import { Icon } from '@/components/ui'
import type { DemoSlug, GlyphId } from '@/lib/demos'
import { DemoRenderer } from '@/lib/demos/loaders'
import { DemoBoundary } from './DemoBoundary'
import { runsInLabel } from './slug'

export function DemoStage({ slug, title, no, glyph, runsIn, usesAI, data }: {
  slug: DemoSlug
  /** Server-resolved data passed through to the demo (DemoProps.data). */
  data?: unknown
  title: string
  no: number
  glyph: GlyphId
  runsIn: 'browser' | 'edge' | 'server' | 'browser + ai'
  usesAI: boolean
}) {
  return (
    <figure className="m-0 min-w-0 border border-rule bg-surface rounded-2 strata:border-0 strata:shadow-plate">
      <figcaption className="mono flex flex-wrap items-center justify-between gap-x-s4 gap-y-1 border-b border-rule px-s4 py-s2 text-ink-3 strata:border-rule-soft">
        <span className="inline-flex items-center gap-2">
          <Icon name={glyph} size={16} className="text-accent-ink" />
          <span className="nums">Plate {String(no).padStart(2, '0')}</span>
          <span aria-hidden="true">·</span>
          <span className="normal-case tracking-normal">{slug}</span>
        </span>
        <span>{runsInLabel(runsIn)}</span>
      </figcaption>
      <div className="min-w-0 p-s3 xs:p-s4 md:p-s5">
        <DemoBoundary title={title} localOnly={runsIn === 'browser' && !usesAI}>
          <DemoRenderer slug={slug} data={data} />
        </DemoBoundary>
      </div>
    </figure>
  )
}
