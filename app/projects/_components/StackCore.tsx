/**
 * The project's stack drawn as a small core sample (DESIGN.md 1, 6.1 device):
 * one wavy sediment band per technology, in the world's layer inks, with the
 * label on a solid plate beside it so text never sits on halftone.
 *
 * Server rendered. Layers print in (Almanac) or settle (Strata) once on load,
 * top first; reduced motion shows them immediately.
 */
import type { CSSProperties } from 'react'
import type { Layer } from '@/components/ui'
import { cx, seeded } from '@/lib/utils'

const W = 88
const H = 34

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A band whose top edge is a seeded, gentle sine-noise line. */
function bandPath(seed: number): string {
  const rnd = seeded(seed)
  const amp = 2 + rnd() * 3
  const phase = rnd() * Math.PI * 2
  const freq = 1 + rnd() * 1.5
  const pts: string[] = []
  const steps = 8
  for (let i = 0; i <= steps; i++) {
    const x = (W / steps) * i
    const y = 7 + Math.sin(phase + (i / steps) * Math.PI * 2 * freq) * amp + (rnd() - 0.5) * 1.5
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return `${pts.join(' ')} L${W} ${H} L0 ${H} Z`
}

export function StackCore({ id, items, startLayer }: { id: string; items: string[]; startLayer: Layer }) {
  if (!items.length) return null
  const pattern = `${id}-ht`
  return (
    <div className="grid gap-s3">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <pattern id={pattern} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1" fill="var(--surface)" opacity=".35" />
          </pattern>
        </defs>
      </svg>
      <ol className="m-0 p-0 list-none grid" aria-label="Stack">
        {items.map((name, i) => {
          const layer = (((startLayer - 1 + i) % 6) + 1) as Layer
          const d = bandPath(hash(`${id}:${name}:${i}`))
          return (
            <li
              key={`${name}-${i}`}
              className={cx(
                'flex items-stretch gap-3 min-h-[36px] border-b border-rule-soft last:border-b-0',
                'motion-safe:almanac:animate-[print-in_var(--dur-med)_var(--ease-out)_both]',
                'motion-safe:strata:animate-[settle_var(--dur-med)_var(--ease-out)_both]',
              )}
              style={{ animationDelay: `${i * 60}ms`, color: `var(--layer-${layer})` } as CSSProperties}
            >
              <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" preserveAspectRatio="none" className="shrink-0 self-end block">
                <path d={d} fill="currentColor" opacity=".9" />
                <path d={d} fill={`url(#${pattern})`} />
              </svg>
              <span className="mono self-center text-ink py-1 [overflow-wrap:anywhere]">
                <span className="text-ink-3 nums mr-2" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                {name}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
