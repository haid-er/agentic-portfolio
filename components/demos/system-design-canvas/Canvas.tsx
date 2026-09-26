'use client'
/**
 * The board: an SVG with draggable component nodes and flow-weighted edges.
 * Pointer: drag to move, tap to select (or to finish a connection).
 * Keyboard: Tab to a node, Enter selects or connects, arrows move it (Shift = faster), Delete removes it.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { SPEC, canConnect, edgeKey, fmtRate, type Cloud, type Design, type NodeT, type SimResult } from './model'

export const BOARD_W = 960
export const BOARD_H = 540
export const NODE_W = 150
export const NODE_H = 76

const clampX = (x: number) => Math.max(4, Math.min(BOARD_W - NODE_W - 4, x))
const clampY = (y: number) => Math.max(4, Math.min(BOARD_H - NODE_H - 4, y))

export function Canvas({ design, sim, selected, connectFrom, cloud, animate, onActivate, onMove, onDelete, onCancel }: {
  design: Design
  sim: SimResult | null
  selected: string | null
  connectFrom: string | null
  cloud: Cloud
  animate: boolean
  onActivate: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onDelete: (id: string) => void
  onCancel: () => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{ id: string; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null)
  const byId = new Map(design.nodes.map((n) => [n.id, n]))

  const toSvg = (e: PointerEvent) => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!svg || !m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  const down = (e: PointerEvent<SVGGElement>, n: NodeT) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toSvg(e)
    drag.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y, sx: p.x, sy: p.y, moved: false }
  }
  const move = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current
    if (!d) return
    const p = toSvg(e)
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) < 4) return
    d.moved = true
    onMove(d.id, clampX(p.x - d.dx), clampY(p.y - d.dy))
  }
  const up = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (d && !d.moved) onActivate(d.id)
  }

  const key = (e: KeyboardEvent<SVGGElement>, n: NodeT) => {
    const step = e.shiftKey ? 40 : 10
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[e.key]) {
      e.preventDefault()
      const [dx, dy] = moves[e.key]
      onMove(n.id, clampX(n.x + dx), clampY(n.y + dy))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate(n.id)
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && n.kind !== 'client') {
      e.preventDefault()
      onDelete(n.id)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      className="block w-full h-auto select-none"
      role="group"
      aria-label="System design board"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onActivate(null) }}
    >
      <defs>
        <pattern id="sdc-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill="var(--rule-soft)" />
        </pattern>
        <marker id="sdc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" />
        </marker>
        <marker id="sdc-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--danger)" />
        </marker>
      </defs>
      <rect x="0" y="0" width={BOARD_W} height={BOARD_H} fill="url(#sdc-dots)" pointerEvents="none" />

      {design.edges.map((e) => {
        const a = byId.get(e.from)
        const b = byId.get(e.to)
        if (!a || !b) return null
        const f = sim?.flows[edgeKey(e.from, e.to)] ?? 0
        const hot = (sim?.nodes[b.id]?.util ?? 0) >= 1
        const x1 = a.x + NODE_W
        const y1 = a.y + NODE_H / 2
        const x2 = b.x
        const y2 = b.y + NODE_H / 2
        const dx = Math.max(50, Math.abs(x2 - x1) / 2)
        const d = `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
        const w = 1.5 + Math.min(4, Math.log10(f + 1) * 0.9)
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const label = f > 0 ? `${fmtRate(f)}/s` : ''
        return (
          <g key={`${e.from}>${e.to}`} pointerEvents="none">
            <path d={d} fill="none" stroke="var(--rule-soft)" strokeWidth={w + 3} />
            <path
              d={d}
              fill="none"
              stroke={hot ? 'var(--danger)' : f > 0 ? 'var(--data-1)' : 'var(--ink-3)'}
              strokeWidth={w}
              strokeDasharray={f > 0 ? '7 7' : '3 5'}
              markerEnd={hot ? 'url(#sdc-arrow-hot)' : 'url(#sdc-arrow)'}
            >
              {animate && f > 0 ? (
                <animate attributeName="stroke-dashoffset" from="28" to="0" dur={`${Math.max(0.35, 2.4 / Math.log10(f + 10)).toFixed(2)}s`} repeatCount="indefinite" />
              ) : null}
            </path>
            {label ? (
              <g transform={`translate(${mx} ${my})`}>
                <rect x={-label.length * 4 - 6} y="-10" width={label.length * 8 + 12} height="20" rx="3" fill="var(--surface)" stroke="var(--rule-soft)" />
                <text textAnchor="middle" dy="4" fontSize="12" fill={hot ? 'var(--danger)' : 'var(--ink-2)'} style={{ fontFamily: 'var(--font-mono)' }}>{label}</text>
              </g>
            ) : null}
          </g>
        )
      })}

      {design.nodes.map((n) => {
        const s = sim?.nodes[n.id]
        const util = s?.util ?? 0
        const over = util >= 1
        const warm = util >= 0.7 && !over
        const isSel = selected === n.id
        const isBn = sim?.bottleneck === n.id
        const connecting = connectFrom !== null
        const valid = connecting && connectFrom !== n.id && canConnect(design, connectFrom, n.id) === null
        const dim = connecting && connectFrom !== n.id && !valid
        const spec = SPEC[n.kind]
        const name = spec.names[cloud]
        const shortName = name.length > 21 ? `${name.slice(0, 20)}…` : name
        const pct = Number.isFinite(util) ? Math.round(util * 100) : Infinity
        const reading = n.kind === 'client'
          ? `${fmtRate(sim?.offered ?? 0)} req/s`
          : n.kind === 'queue' && (s?.backlog ?? 0) >= 1
            ? `${fmtRate(s?.backlog ?? 0)} queued`
            : Number.isFinite(pct) ? `${over ? 'OVER ' : ''}${pct}%` : 'NO CONSUMER'
        const status = n.kind === 'client' ? '' : over ? 'overloaded' : warm ? 'running hot' : 'healthy'
        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
            tabIndex={0}
            role="button"
            aria-pressed={isSel}
            aria-label={`${spec.label}${n.replicas > 1 ? `, ${n.replicas} replicas` : ''}. ${n.kind === 'client' ? reading : `${reading}, ${status}`}${isBn ? ', bottleneck' : ''}${valid ? '. Press Enter to connect here' : ''}`}
            className="cursor-grab active:cursor-grabbing outline-none [&:focus-visible>rect:first-child]:stroke-[var(--focus)] [&:focus-visible>rect:first-child]:[stroke-width:3]"
            style={{ touchAction: 'none', opacity: dim ? 0.45 : 1 }}
            onPointerDown={(e) => down(e, n)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => { drag.current = null }}
            onKeyDown={(e) => key(e, n)}
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx="5"
              fill="var(--surface)"
              stroke={isSel ? 'var(--focus)' : isBn ? 'var(--danger)' : valid ? 'var(--accent)' : 'var(--rule)'}
              strokeWidth={isSel || isBn || valid ? 2.5 : 1.25}
              strokeDasharray={isBn && !isSel ? '6 4' : valid ? '4 3' : undefined}
            />
            {connectFrom === n.id ? <rect x="-5" y="-5" width={NODE_W + 10} height={NODE_H + 10} rx="8" fill="none" stroke="var(--accent)" strokeDasharray="4 4" /> : null}
            <text x="10" y="18" fontSize="11" fill="var(--ink-2)" letterSpacing="1.2" style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{spec.short}</text>
            {n.replicas > 1 ? (
              <text x={NODE_W - 10} y="18" fontSize="12" textAnchor="end" fill="var(--accent-ink)" style={{ fontFamily: 'var(--font-mono)' }}>×{n.replicas}</text>
            ) : null}
            <text x="10" y="39" fontSize="13.5" fontWeight="600" fill="var(--ink)" style={{ fontFamily: 'var(--font-body)' }}>{shortName}</text>
            <text
              x={NODE_W - 10}
              y="57"
              fontSize="11"
              textAnchor="end"
              fill={over ? 'var(--danger)' : warm ? 'var(--warn)' : 'var(--ink-3)'}
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {reading}
            </text>
            {n.kind !== 'client' ? (
              <>
                <rect x="10" y={NODE_H - 13} width={NODE_W - 20} height="5" rx="2" fill="var(--bg-2)" />
                <rect
                  x="10"
                  y={NODE_H - 13}
                  width={(NODE_W - 20) * Math.min(1, Number.isFinite(util) ? util : 1)}
                  height="5"
                  rx="2"
                  fill={over ? 'var(--danger)' : warm ? 'var(--data-3)' : 'var(--data-1)'}
                />
                {s?.note ? <title>{s.note}</title> : null}
              </>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
