/**
 * Stacked breakdown drawn with plain CSS boxes (no chart library).
 * Each category gets a data ink AND a fill pattern, so colour is never the only signal.
 * The legend under every bar carries the real numbers for screen readers.
 */
import type { CSSProperties } from 'react'
import { cx } from '@/lib/utils'
import { APPROACHES, categoriesIn, fmtT, type Approach, type Scope, type Totals } from './model'

const PATTERNS: readonly CSSProperties[] = [
  { background: 'var(--data-1)' },
  { background: 'repeating-linear-gradient(135deg, var(--data-2) 0 6px, color-mix(in srgb, var(--data-2) 45%, transparent) 6px 9px)' },
  { background: 'radial-gradient(circle at 2px 2px, var(--data-3) 1.6px, transparent 2px) 0 0/5px 5px, color-mix(in srgb, var(--data-3) 40%, transparent)' },
  { background: 'repeating-linear-gradient(90deg, var(--data-4) 0 3px, color-mix(in srgb, var(--data-4) 35%, transparent) 3px 6px)' },
]
export const patternFor = (i: number): CSSProperties => PATTERNS[i % PATTERNS.length] as CSSProperties

function Swatch({ i }: { i: number }) {
  return <span aria-hidden="true" className="inline-block size-3.5 shrink-0 border border-rule" style={patternFor(i)} />
}

const share = (v: number, total: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : '0%')

export function ScopeBreakdown({ totals }: { totals: Totals }) {
  const scopes: Scope[] = [1, 2, 3]
  const max = Math.max(...scopes.map((s) => totals.byScope[s]), 1)
  return (
    <div className="grid gap-5">
      {scopes.map((s) => {
        const cats = categoriesIn(s)
        const scopeKg = totals.byScope[s]
        return (
          <figure key={s} className="m-0 grid gap-2">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="mono text-ink">Scope {s}</span>
              <span className="nums">
                <span className="font-display text-2 text-ink">{fmtT(scopeKg)}</span>{' '}
                <span className="mono text-ink-3">tCO₂e · {share(scopeKg, totals.totalKg)}</span>
              </span>
            </figcaption>
            <div aria-hidden="true" className="flex h-7 w-full bg-bg-2 border border-rule rounded-0 overflow-hidden">
              {cats.map((c, i) => {
                const v = totals.byCategory[c.id]
                if (v <= 0) return null
                return (
                  <span
                    key={c.id}
                    title={`${c.label}: ${fmtT(v)} tCO₂e`}
                    className="h-full border-r border-surface last:border-r-0"
                    style={{ ...patternFor(i), width: `${(v / max) * 100}%` }}
                  />
                )
              })}
            </div>
            <ul className="m-0 p-0 list-none grid gap-1 xs:grid-cols-2">
              {cats.map((c, i) => (
                <li key={c.id} className={cx('flex items-center gap-2 text-0 min-w-0', totals.byCategory[c.id] <= 0 && 'text-ink-3')}>
                  <Swatch i={i} />
                  <span className="min-w-0 truncate" title={c.label}>{c.label}</span>
                  <span className="ml-auto mono nums text-ink-2 whitespace-nowrap">{fmtT(totals.byCategory[c.id])} t</span>
                </li>
              ))}
            </ul>
          </figure>
        )
      })}
    </div>
  )
}

/** Same inventory, three boundaries: the clearest way to see why the choice matters. */
export function ApproachCompare({ byApproach, current, onPick }: {
  byApproach: Record<Approach, Totals>
  current: Approach
  onPick: (a: Approach) => void
}) {
  const max = Math.max(...APPROACHES.map((a) => byApproach[a.value].totalKg), 1)
  return (
    <ul className="m-0 p-0 list-none grid gap-2">
      {APPROACHES.map((a) => {
        const t = byApproach[a.value]
        const on = a.value === current
        return (
          <li key={a.value}>
            <button
              type="button"
              onClick={() => onPick(a.value)}
              aria-pressed={on}
              className={cx(
                'w-full min-h-tap grid gap-1 p-2 text-left border rounded-1 transition-colors',
                on ? 'border-accent bg-bg-2' : 'border-rule-soft hover:border-rule',
              )}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="mono text-ink">{a.label}{on ? ' · shown' : ''}</span>
                <span className="mono nums text-ink-2">{fmtT(t.totalKg)} tCO₂e</span>
              </span>
              <span aria-hidden="true" className="flex h-2.5 w-full bg-bg-2 overflow-hidden">
                {([1, 2, 3] as const).map((s) => (
                  <span key={s} className="h-full" style={{ ...patternFor(s - 1), width: `${(t.byScope[s] / max) * 100}%` }} />
                ))}
              </span>
            </button>
          </li>
        )
      })}
      <li className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-00 text-ink-3" aria-hidden="true">
        {([1, 2, 3] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1"><Swatch i={s - 1} /> Scope {s}</span>
        ))}
      </li>
    </ul>
  )
}
