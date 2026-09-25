/** Generation mix: one 100% stacked strip (ink + pattern per group) and a readable list. */
import type { CSSProperties } from 'react'
import type { MixEntry } from './api'

interface Group { id: string; label: string; fuels: string[]; style: CSSProperties }

const GROUPS: readonly Group[] = [
  { id: 'renew', label: 'Wind, solar, hydro', fuels: ['wind', 'solar', 'hydro'], style: { background: 'var(--data-1)' } },
  { id: 'nuclear', label: 'Nuclear', fuels: ['nuclear'], style: { background: 'repeating-linear-gradient(90deg, var(--data-4) 0 3px, color-mix(in srgb, var(--data-4) 40%, transparent) 3px 6px)' } },
  { id: 'biomass', label: 'Biomass', fuels: ['biomass'], style: { background: 'radial-gradient(circle at 2px 2px, var(--data-3) 1.6px, transparent 2px) 0 0/5px 5px, color-mix(in srgb, var(--data-3) 40%, transparent)' } },
  { id: 'fossil', label: 'Gas and coal', fuels: ['gas', 'coal'], style: { background: 'repeating-linear-gradient(135deg, var(--data-2) 0 6px, color-mix(in srgb, var(--data-2) 45%, transparent) 6px 9px)' } },
  { id: 'other', label: 'Imports and other', fuels: ['imports', 'other'], style: { background: 'var(--bg-2)' } },
]

const pct = (v: number) => `${v.toFixed(1)}%`

export function MixStrip({ mix }: { mix: MixEntry[] }) {
  const by = new Map(mix.map((m) => [m.fuel, m.perc]))
  const groups = GROUPS.map((g) => ({ ...g, total: g.fuels.reduce((a, f) => a + (by.get(f) ?? 0), 0) }))
  const sum = groups.reduce((a, g) => a + g.total, 0) || 1
  const zeroCarbon = (by.get('wind') ?? 0) + (by.get('solar') ?? 0) + (by.get('hydro') ?? 0) + (by.get('nuclear') ?? 0)
  return (
    <div className="grid gap-3">
      <p className="m-0 nums">
        <span className="font-display text-4 text-ink">{Math.round(zeroCarbon)}%</span>{' '}
        <span className="mono text-ink-3">zero-carbon at the point of generation</span>
      </p>
      <div aria-hidden="true" className="flex h-8 w-full border border-rule overflow-hidden">
        {groups.map((g) => g.total > 0 ? (
          <span key={g.id} title={`${g.label}: ${pct(g.total)}`} className="h-full border-r border-surface last:border-r-0" style={{ ...g.style, width: `${(g.total / sum) * 100}%` }} />
        ) : null)}
      </div>
      <ul className="m-0 p-0 list-none grid gap-2 xs:grid-cols-2">
        {groups.map((g) => (
          <li key={g.id} className="grid gap-0.5 min-w-0">
            <span className="flex items-center gap-2 text-0">
              <span aria-hidden="true" className="inline-block size-3.5 shrink-0 border border-rule" style={g.style} />
              <span className="text-ink">{g.label}</span>
              <span className="ml-auto mono nums text-ink">{pct(g.total)}</span>
            </span>
            {g.fuels.length > 1 ? (
              <span className="pl-5.5 text-00 text-ink-3 nums">
                {g.fuels.map((f) => `${f} ${pct(by.get(f) ?? 0)}`).join(' · ')}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
