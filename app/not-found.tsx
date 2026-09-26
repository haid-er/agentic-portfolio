/**
 * 404: a core sample with an empty bed where the page should be.
 * Server component; the only client piece is the "search the index" button.
 * Nearby layers come from the enabled sections (content/site.json).
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { OpenIndexButton } from '@/components/layout/IndexButton'
import { getNavModel } from '@/components/layout/nav'
import { getSection } from '@/lib/content'
import { seeded } from '@/lib/utils'

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } }

const W = 150
const TOP = 26
const BED = 34
const BEDS = 6
const VOID = 3 // the empty bed, counted from the top

/** Seeded sine-noise top edge for one bed, as an SVG path closed to the next bed. */
function bedPath(i: number): string {
  const rnd = seeded(404 + i * 17)
  const y0 = TOP + i * BED
  const pts: string[] = []
  for (let x = 0; x <= W; x += 10) {
    const y = y0 + Math.sin((x / W) * Math.PI * 2 + i) * 2.2 + (rnd() - 0.5) * 2.4
    pts.push(`${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`)
  }
  return `${pts.join(' ')} L${W} ${y0 + BED + 3} L0 ${y0 + BED + 3} Z`
}

function CoreSample() {
  const h = TOP + BEDS * BED + 12
  const voidY = TOP + VOID * BED
  return (
    <svg viewBox={`-8 0 ${W + 16} ${h}`} className="h-auto w-full max-w-[220px]" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="nf-core"><rect x="0" y={TOP - 6} width={W} height={BEDS * BED + 12} rx="14" /></clipPath>
        <pattern id="nf-dots" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.1" fill="var(--halftone)" />
        </pattern>
      </defs>
      <g clipPath="url(#nf-core)">
        <rect x="0" y="0" width={W} height={h} fill="var(--surface)" />
        {Array.from({ length: BEDS }, (_, i) =>
          i === VOID ? null : (
            <g key={i}>
              <path d={bedPath(i)} fill={`var(--layer-${(i % 6) + 1})`} opacity={0.22 + (i % 3) * 0.08} />
              <path d={bedPath(i)} fill="url(#nf-dots)" opacity={i % 2 ? 0.5 : 0.8} />
              <path d={bedPath(i).split(' L' + W)[0]} fill="none" stroke="var(--rule)" strokeWidth="1" />
            </g>
          ),
        )}
        <rect x="10" y={voidY + 6} width={W - 20} height={BED - 8} fill="var(--bg)" stroke="var(--rule)" strokeDasharray="4 4" />
      </g>
      <rect x="0" y={TOP - 6} width={W} height={BEDS * BED + 12} rx="14" fill="none" stroke="var(--rule)" strokeWidth="1.5" />
      <text x={W / 2} y={voidY + BED / 2 + 5} textAnchor="middle" fill="var(--accent-ink)" style={{ font: '600 15px var(--font-mono)', letterSpacing: '.12em' }}>
        404
      </text>
      {/* the drill stops at the empty bed */}
      <line
        x1={W / 2} y1="2" x2={W / 2} y2={voidY + 6}
        stroke="var(--ink)" strokeWidth="1.5" strokeDasharray={voidY + 6}
        style={{ '--drill-len': voidY + 6, animation: 'drill 900ms var(--ease-out) both' } as CSSProperties}
      />
      <path d={`M${W / 2 - 6} 2h12`} stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  )
}

export default function NotFound() {
  const nearby = getNavModel().sections.slice(0, 6)
  const playground = getSection('playground')
  const playgroundLabel = playground?.navLabel || playground?.title || 'Playground'

  return (
    <div className="wrap py-s8 md:py-s9">
      <div className="grid items-center gap-s7 md:grid-cols-[1fr_auto] md:gap-s8">
        <div className="grid gap-s5">
          <p className="mono m-0 flex items-center gap-2 text-ink-3">
            <Icon name="register" size={16} className="text-accent-2" />
            Sample 404 · nothing recorded at this depth
          </p>
          <h1 className="text-[clamp(2.8rem,9vw,5.5rem)]">No layer here.</h1>
          <p className="measure m-0 text-1 text-ink-2">
            The page you drilled for is not in this core. It may have moved, or the link was mistyped.
            Every other layer still leads to a working proof.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/">Back to the front page</ButtonLink>
            <ButtonLink href="/playground" variant="secondary">Open the {playgroundLabel.toLowerCase()}</ButtonLink>
            <OpenIndexButton>Search the index</OpenIndexButton>
          </div>
        </div>
        <div className="justify-self-center md:justify-self-end">
          <CoreSample />
        </div>
      </div>

      {nearby.length ? (
        <nav aria-label="Nearby layers" className="mt-s8 max-w-[640px]">
          <p className="mono m-0 mb-s3 text-ink-3">Nearby layers</p>
          <ol className="m-0 list-none border-t border-rule p-0">
            {nearby.map((s) => (
              <li key={s.id} className="border-b border-rule-soft">
                <Link href={s.href} className="group flex min-h-[52px] items-center gap-3 no-underline text-ink-2 hover:text-ink">
                  <Icon name={s.icon} size={18} className="text-ink-3 group-hover:text-accent" />
                  <span className="text-1">{s.label}</span>
                  <span aria-hidden="true" className="shell-leaders" />
                  <span className="mono nums text-accent-ink">{s.folio}</span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </div>
  )
}
