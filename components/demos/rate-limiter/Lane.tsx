'use client'
/**
 * One limiter's strip: remaining capacity as a line, accepted requests as dots,
 * rejected ones as crosses (shape, not only colour). Sliding window shades its moving window;
 * fixed window draws its boundaries.
 */
import { Badge } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { AlgoKey } from './algorithms'
import { LANE_LABEL, type LaneState } from './sim'

const INK: Record<AlgoKey, { stroke: string; fill: string }> = {
  'token-bucket': { stroke: 'stroke-data-1', fill: 'fill-data-1' },
  'sliding-window': { stroke: 'stroke-data-3', fill: 'fill-data-3' },
  'fixed-window': { stroke: 'stroke-data-4', fill: 'fill-data-4' },
}

const H = 96
const TOP = 10
const LEVEL_H = 44
const OK_Y = 68
const NO_Y = 84

export function Lane({ lane, now, spanMs, windowMs, limit, width, remaining }: {
  lane: LaneState
  now: number
  spanMs: number
  windowMs: number
  limit: number
  width: number
  remaining: number
}) {
  const w = Math.max(200, width)
  const t0 = now - spanMs
  const x = (t: number) => ((t - t0) / spanMs) * w
  const y = (v: number) => TOP + LEVEL_H - (Math.max(0, Math.min(limit, v)) / limit) * LEVEL_H
  const ink = INK[lane.key]
  const pts = lane.levels.filter((l) => l.t >= t0 - 500).map((l) => `${x(l.t).toFixed(1)},${y(l.v).toFixed(1)}`).join(' ')
  const hits = lane.hits.filter((h) => h.t >= t0)
  const boundaries: number[] = []
  if (lane.key === 'fixed-window') for (let b = Math.ceil(t0 / windowMs) * windowMs; b <= now; b += windowMs) boundaries.push(b)
  const over = lane.worstBurst > limit

  return (
    <figure className="m-0 grid gap-1 min-w-0">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-0 uppercase tracking-[.08em] text-ink">{LANE_LABEL[lane.key]}</span>
        <span className="font-mono text-00 text-ink-2 nums">{lane.accepted} allowed · {lane.rejected} rejected</span>
        <span className="font-mono text-00 text-ink-3 nums">left now {Math.floor(remaining)}/{limit}</span>
        <Badge tone={over ? 'warn' : 'neutral'} className="nums">worst window {lane.worstBurst}/{limit}{over ? ' · over limit' : ''}</Badge>
      </figcaption>
      <svg width="100%" height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${LANE_LABEL[lane.key]}: ${lane.accepted} allowed, ${lane.rejected} rejected, ${Math.floor(remaining)} of ${limit} left`} className="block bg-bg-2 rounded-0">
        {lane.key === 'sliding-window' ? (
          <rect x={x(now - windowMs)} y={2} width={Math.max(0, x(now) - x(now - windowMs))} height={H - 4} className="fill-accent opacity-10" />
        ) : null}
        {boundaries.map((b) => (
          <line key={b} x1={x(b)} x2={x(b)} y1={2} y2={H - 2} className="stroke-ink-3" strokeDasharray="3 4" strokeWidth={1} />
        ))}
        <line x1={0} x2={w} y1={y(0)} y2={y(0)} className="stroke-rule-soft" strokeWidth={1} />
        <line x1={0} x2={w} y1={y(limit)} y2={y(limit)} className="stroke-rule-soft" strokeWidth={1} strokeDasharray="2 3" />
        {pts ? <polyline points={pts} className={cx('fill-none', ink.stroke)} strokeWidth={2} strokeLinejoin="round" /> : null}
        {hits.map((h, i) =>
          h.ok ? (
            <circle key={i} cx={x(h.t)} cy={OK_Y} r={3.5} className={ink.fill} />
          ) : (
            <g key={i} transform={`translate(${x(h.t)},${NO_Y})`} className="stroke-danger" strokeWidth={1.6}>
              <line x1={-3} y1={-3} x2={3} y2={3} />
              <line x1={-3} y1={3} x2={3} y2={-3} />
            </g>
          ),
        )}
        <line x1={w - 1} x2={w - 1} y1={2} y2={H - 2} className="stroke-ink" strokeWidth={1} />
      </svg>
    </figure>
  )
}
