'use client'
/** Ownership graph drawn in SVG: parent on top, layers by ownership depth, edges labelled with equity and control. */
import { type KeyboardEvent } from 'react'
import { cx } from '@/lib/utils'
import {
  type Approach, type Consolidation, type Group, type Link,
  CONTROL_SHORT, fmtPct, fmtT, grantsFinancial, grantsOperational, layers, shareFor,
} from './model'

const W = 172
const H = 80
const GAP_X = 20
const GAP_Y = 76
const PAD = 16

function edgeCounts(l: Link, a: Approach): boolean {
  if (a === 'equity') return l.equityPct > 0
  if (a === 'financial') return grantsFinancial(l) || l.control === 'joint'
  return grantsOperational(l)
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function OwnershipGraph({ group, result, approach, selected, onSelect }: {
  group: Group
  result: Consolidation
  approach: Approach
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const rows = layers(group)
  const widest = Math.max(1, ...rows.map((r) => r.length))
  const vbW = PAD * 2 + widest * W + (widest - 1) * GAP_X
  const vbH = PAD * 2 + rows.length * H + (rows.length - 1) * GAP_Y

  const pos = new Map<string, { x: number; y: number }>()
  rows.forEach((row, ri) => {
    const rowW = row.length * W + (row.length - 1) * GAP_X
    const x0 = (vbW - rowW) / 2
    row.forEach((id, ci) => pos.set(id, { x: x0 + ci * (W + GAP_X), y: PAD + ri * (H + GAP_Y) }))
  })

  const key = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(selected === id ? null : id) }
    if (e.key === 'Escape') onSelect(null)
  }

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width="100%"
      style={{ minWidth: Math.min(vbW, 600), maxWidth: vbW, margin: '0 auto', display: 'block' }}
      role="group"
      aria-label={`Ownership graph, ${group.entities.length} entities. Shares shown for the ${approach} approach.`}
      className="font-mono"
    >
      <defs>
        <marker id="own-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: 'var(--ink-2)' }} />
        </marker>
        <marker id="own-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: 'var(--accent)' }} />
        </marker>
      </defs>

      {group.links.map((l) => {
        const a = pos.get(l.owner)
        const b = pos.get(l.owned)
        if (!a || !b) return null
        const x1 = a.x + W / 2
        const y1 = a.y + H
        const x2 = b.x + W / 2
        const y2 = b.y - 2
        const down = y2 > y1
        const my = down ? (y1 + y2) / 2 : Math.max(y1, y2) + GAP_Y / 2
        const d = down ? `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}` : `M${x1} ${y1} C${x1} ${my} ${x2} ${my - H * 2} ${x2} ${y2}`
        const counts = edgeCounts(l, approach)
        const hot = selected != null && (l.owned === selected || l.owner === selected)
        const label = `${Number(l.equityPct.toFixed(1))}% · ${CONTROL_SHORT[l.control]}`
        // Label sits 65% along the curve (nearer the child) so sibling labels do not collide.
        const t = 0.65
        const cy2 = down ? my : my - H * 2
        const bez = (a0: number, a1: number, a2: number, a3: number) => (1 - t) ** 3 * a0 + 3 * (1 - t) ** 2 * t * a1 + 3 * (1 - t) * t ** 2 * a2 + t ** 3 * a3
        const lx = bez(x1, x1, x2, x2)
        const ly = bez(y1, my, cy2, y2)
        const lw = label.length * 6.6 + 10
        return (
          <g key={l.id}>
            <path
              d={d}
              fill="none"
              markerEnd={hot ? 'url(#own-arrow-hot)' : 'url(#own-arrow)'}
              style={{
                stroke: hot ? 'var(--accent)' : 'var(--ink-2)',
                strokeWidth: counts ? 1.5 + (l.equityPct / 100) * 1.5 : 1.25,
                strokeDasharray: counts ? undefined : '5 4',
                opacity: counts || hot ? 1 : 0.7,
              }}
            />
            <rect x={lx - lw / 2} y={ly - 9} width={lw} height={18} rx={2} style={{ fill: 'var(--surface)', stroke: 'var(--rule-soft)' }} />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize={11} style={{ fill: hot ? 'var(--accent-ink)' : 'var(--ink-2)' }}>{label}</text>
          </g>
        )
      })}

      {group.entities.map((e) => {
        const p = pos.get(e.id)
        if (!p) return null
        const r = result.byId[e.id]
        const share = shareFor(r, approach)
        const isParent = e.id === group.parentId
        const outside = share === 0
        const on = selected === e.id
        const t = e.emissions == null ? 'no figure' : `${fmtT(e.emissions * share)} of ${fmtT(e.emissions)} t`
        return (
          <g
            key={e.id}
            transform={`translate(${p.x} ${p.y})`}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${e.name}${isParent ? ', reporting entity' : ''}. ${fmtPct(share)} consolidated. ${e.emissions == null ? 'No emissions figure.' : `${fmtT(e.emissions * share)} of ${fmtT(e.emissions)} tonnes CO2e.`}`}
            onClick={() => onSelect(on ? null : e.id)}
            onKeyDown={key(e.id)}
            className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:[stroke:var(--focus)] [&:focus-visible>rect:first-child]:[stroke-width:3]"
          >
            <title>{e.name}</title>
            <rect
              width={W}
              height={H}
              rx={4}
              style={{
                fill: 'var(--surface)',
                stroke: on ? 'var(--accent)' : isParent ? 'var(--ink)' : 'var(--rule)',
                strokeWidth: on || isParent ? 2 : 1,
                strokeDasharray: outside && !isParent ? '4 3' : undefined,
              }}
            />
            <text x={10} y={20} fontSize={12} fontWeight={600} style={{ fill: outside ? 'var(--ink-3)' : 'var(--ink)' }}>{clip(e.name, 23)}</text>
            <text x={10} y={40} fontSize={11} style={{ fill: 'var(--ink-2)' }}>
              {isParent ? 'REPORTING · ' : outside ? 'OUTSIDE · ' : ''}{fmtPct(share)}
            </text>
            <text x={10} y={56} fontSize={10} style={{ fill: 'var(--ink-3)' }}>{t}</text>
            <rect x={10} y={64} width={W - 20} height={6} style={{ fill: 'var(--rule-soft)' }} />
            <rect
              x={10}
              y={64}
              width={W - 20}
              height={6}
              className={cx('motion-safe:transition-transform motion-safe:duration-[var(--dur-med)]')}
              style={{ fill: isParent ? 'var(--accent)' : 'var(--data-1)', transform: `scaleX(${share})`, transformBox: 'fill-box', transformOrigin: 'left' }}
            />
          </g>
        )
      })}
    </svg>
  )
}
