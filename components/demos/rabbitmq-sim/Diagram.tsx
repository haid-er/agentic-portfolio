'use client'
/**
 * The broker drawn as an SVG schematic. Messages in flight are dots that travel between
 * node centres; nodes are drawn after the dots so messages "enter" and "leave" boxes.
 * Shape carries meaning as well as ink: poison messages are squares, redeliveries are ringed.
 */
import { cx } from '@/lib/utils'
import { bindingMatches, DLX, EXCHANGE, validateBinding, type ConsumerView, type Snapshot, type Transit } from './engine'
import { fitLabel, type Box, type Layout } from './layout'

const INK_FILL = ['', 'fill-data-1', 'fill-data-2', 'fill-data-3', 'fill-data-4'] as const

export function inkFill(n: number) { return INK_FILL[n] ?? 'fill-data-1' }

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export function Diagram({ snap, layout }: { snap: Snapshot; layout: Layout }) {
  const { nodes, width, height } = layout
  const tall = layout.orientation === 'tall'
  const summary = `Broker diagram. ${snap.queues.map((q) => `${q.name}: ${q.depth} ready`).join(', ')}. ${snap.dlq.depth} in ${snap.dlq.name}. ${snap.transits.length} messages in flight.`
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={summary}
      className={cx('block w-full h-auto font-mono select-none', tall && 'max-w-[440px] mx-auto')}
    >
      <Edges snap={snap} layout={layout} />
      <g aria-hidden="true">
        {snap.transits.map((tr) => <Dot key={tr.key} tr={tr} layout={layout} />)}
      </g>
      <g aria-hidden="true">
        {snap.producers.map((p) => {
          const b = nodes[p.id] as Box
          const [device, sensor] = p.label.split(' · ')
          return (
            <g key={p.id} opacity={p.on ? 1 : 0.5}>
              <Plate b={b} />
              <circle cx={b.x - b.w / 2 + 12} cy={b.y - b.h / 2 + 12} r={4.5} className={inkFill(p.ink)} />
              <text x={b.x - b.w / 2 + 22} y={b.y - b.h / 2 + 16} fontSize={layout.small} className="fill-ink-3">{tall ? device : 'producer'}</text>
              <text x={b.x} y={b.y + (tall ? 6 : 4)} fontSize={layout.font} textAnchor="middle" className="fill-ink">{tall ? sensor : p.label}</text>
              <text x={b.x} y={b.y + b.h / 2 - 7} fontSize={layout.small} textAnchor="middle" className={p.on ? 'fill-accent-ink' : 'fill-ink-3'}>{p.on ? 'publishing' : 'off'}</text>
            </g>
          )
        })}
        <ExchangeNode b={nodes.x as Box} snap={snap} layout={layout} />
        {snap.queues.map((q) => {
          const b = nodes[q.id] as Box
          const fill = q.depth / Math.max(1, q.maxLength)
          const unacked = snap.consumers.filter((c) => c.queueId === q.id).reduce((n, c) => n + c.unacked, 0)
          return (
            <g key={q.id}>
              <Plate b={b} strong />
              <text x={b.x} y={b.y - b.h / 2 + 17} fontSize={layout.font} textAnchor="middle" className="fill-ink">{q.name}</text>
              <rect x={b.x - b.w / 2 + 8} y={b.y - 2} width={b.w - 16} height={8} className="fill-bg-2 stroke-rule" strokeWidth={0.75} />
              <rect x={b.x - b.w / 2 + 8} y={b.y - 2} width={(b.w - 16) * Math.min(1, fill)} height={8} className={fill >= 0.8 ? 'fill-warn' : 'fill-accent'} />
              <text x={b.x} y={b.y + b.h / 2 - 8} fontSize={layout.small} textAnchor="middle" className={fill >= 0.8 ? 'fill-warn' : 'fill-ink-2'}>
                {tall ? `${q.depth}/${q.maxLength}` : `${q.depth}/${q.maxLength} · ${unacked} unacked`}
              </text>
            </g>
          )
        })}
        <DlqNode b={nodes.dlq as Box} snap={snap} layout={layout} />
        {snap.consumers.map((c) => <ConsumerNode key={c.id} c={c} b={nodes[c.id] as Box} layout={layout} />)}
      </g>
    </svg>
  )
}

function Plate({ b, strong, dashed }: { b: Box; strong?: boolean; dashed?: boolean }) {
  return (
    <rect
      x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h}
      rx={4}
      className={cx('fill-surface', dashed ? 'stroke-danger' : 'stroke-rule')}
      strokeWidth={strong ? 1.5 : 1}
      strokeDasharray={dashed ? '5 4' : undefined}
    />
  )
}

function Edges({ snap, layout }: { snap: Snapshot; layout: Layout }) {
  const { nodes } = layout
  const x = nodes.x as Box
  const d = nodes.dlq as Box
  const line = (a: Box, b: Box, cls: string, dash?: string, key?: string) => (
    <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={cls} strokeWidth={1.25} strokeDasharray={dash} />
  )
  return (
    <g aria-hidden="true" fill="none">
      {snap.producers.map((p) => line(nodes[p.id] as Box, x, p.on ? 'stroke-rule' : 'stroke-rule-soft', undefined, p.id))}
      {snap.queues.map((q) => {
        const live = snap.producers.some((p) => bindingMatches(snap.exchange, q.binding, p.key))
        const invalid = validateBinding(snap.exchange, q.binding) !== null
        const b = nodes[q.id] as Box
        const mx = (x.x + b.x) / 2
        const my = (x.y + b.y) / 2
        return (
          <g key={q.id}>
            {line(x, b, live ? 'stroke-accent' : 'stroke-rule-soft', live ? undefined : '4 4')}
            {layout.orientation === 'wide' && snap.exchange !== 'fanout' ? (
              <g>
                <rect x={mx - 58} y={my - layout.small / 2 - 5} width={116} height={layout.small + 8} rx={2} className={cx('fill-bg-2', invalid ? 'stroke-danger' : 'stroke-rule-soft')} strokeWidth={1} />
                <text x={mx} y={my + layout.small * 0.35} fontSize={layout.small} textAnchor="middle" className={invalid ? 'fill-danger' : 'fill-ink-2'}>{fitLabel(q.binding || '(empty)', 108, layout.small)}</text>
              </g>
            ) : null}
          </g>
        )
      })}
      {snap.consumers.map((c) => line(nodes[c.queueId] as Box, nodes[c.id] as Box, c.alive ? 'stroke-rule' : 'stroke-rule-soft', c.alive ? undefined : '3 5', c.id))}
      {snap.dlx ? snap.queues.map((q) => line(nodes[q.id] as Box, d, 'stroke-danger', '2 6', `dl-${q.id}`)) : null}
    </g>
  )
}

function Dot({ tr, layout }: { tr: Transit; layout: Layout }) {
  const a = layout.nodes[tr.from]
  const b = layout.nodes[tr.to]
  if (!a || !b) return null
  const t = ease(Math.min(1, Math.max(0, tr.t)))
  const cx0 = a.x + (b.x - a.x) * t
  const cy0 = a.y + (b.y - a.y) * t
  const r = layout.dot
  if (tr.msg.poison) {
    return <rect x={cx0 - r} y={cy0 - r} width={r * 2} height={r * 2} className="fill-danger stroke-ink" strokeWidth={1} />
  }
  return (
    <g>
      <circle cx={cx0} cy={cy0} r={r} className={inkFill(tr.msg.producer)} />
      {tr.msg.redelivered ? <circle cx={cx0} cy={cy0} r={r + 2.5} fill="none" className="stroke-ink" strokeWidth={1.25} /> : null}
    </g>
  )
}

function ExchangeNode({ b, snap, layout }: { b: Box; snap: Snapshot; layout: Layout }) {
  const l = b.x - b.w / 2
  const r = b.x + b.w / 2
  const t = b.y - b.h / 2
  const bo = b.y + b.h / 2
  const k = 12
  return (
    <g>
      <polygon points={`${l + k},${t} ${r - k},${t} ${r},${b.y} ${r - k},${bo} ${l + k},${bo} ${l},${b.y}`} className="fill-bg-2 stroke-ink" strokeWidth={1.5} />
      <text x={b.x} y={b.y - 4} fontSize={layout.font} textAnchor="middle" className="fill-ink">{EXCHANGE}</text>
      <text x={b.x} y={b.y + 13} fontSize={layout.small} textAnchor="middle" className="fill-accent-ink">{snap.exchange} exchange</text>
    </g>
  )
}

function DlqNode({ b, snap, layout }: { b: Box; snap: Snapshot; layout: Layout }) {
  const n = snap.dlq.depth
  const total = snap.dlx ? snap.stats.deadLettered : snap.stats.dropped
  const title = snap.dlx ? `${DLX} → ${snap.dlq.name}` : 'no dead-letter exchange'
  const detail = n
    ? `${n} held · ${total} ${snap.dlx ? 'total' : 'discarded'}`
    : `${total} ${snap.dlx ? 'dead-lettered' : 'discarded'}`
  return (
    <g opacity={snap.dlx ? 1 : 0.55}>
      <Plate b={b} dashed />
      <text x={b.x} y={b.y - 4} fontSize={layout.font} textAnchor="middle" className="fill-danger">{fitLabel(title, b.w - 12, layout.font)}</text>
      <text x={b.x} y={b.y + 13} fontSize={layout.small} textAnchor="middle" className="fill-ink-2">{fitLabel(detail, b.w - 12, layout.small)}</text>
    </g>
  )
}

function ConsumerNode({ c, b, layout }: { c: ConsumerView; b: Box; layout: Layout }) {
  const tall = layout.orientation === 'tall'
  const unacked = c.unacked
  const l = b.x - b.w / 2
  const slots = Math.min(c.prefetch, tall ? 6 : 10)
  const gap = tall ? 10 : 12
  const sx = b.x - ((slots - 1) * gap) / 2
  const state = !c.alive ? 'down' : c.current ? 'busy' : 'idle'
  const progress = c.current ? 1 - c.current.left / c.current.total : 0
  return (
    <g opacity={c.alive ? 1 : 0.7}>
      <rect x={l} y={b.y - b.h / 2} width={b.w} height={b.h} rx={4} className={cx('fill-surface', c.alive ? 'stroke-rule' : 'stroke-danger')} strokeWidth={c.alive ? 1 : 1.5} strokeDasharray={c.alive ? undefined : '4 3'} />
      <text x={b.x} y={b.y - b.h / 2 + 15} fontSize={layout.font} textAnchor="middle" className="fill-ink">{c.label}</text>
      {c.autoAck ? (
        <text x={b.x} y={b.y + 4} fontSize={layout.small} textAnchor="middle" className="fill-warn">auto-ack · {unacked} held</text>
      ) : (
        <g>
          {Array.from({ length: slots }, (_, i) => (
            <circle key={i} cx={sx + i * gap} cy={b.y + 1} r={tall ? 3.5 : 4} className={i < unacked ? 'fill-accent stroke-accent' : 'fill-surface stroke-rule'} strokeWidth={1} />
          ))}
          {c.prefetch > slots ? <text x={sx + slots * gap - 2} y={b.y + 4} fontSize={layout.small} className="fill-ink-3">+</text> : null}
        </g>
      )}
      <text x={b.x} y={b.y + b.h / 2 - (tall ? 14 : 12)} fontSize={layout.small} textAnchor="middle" className={state === 'down' ? 'fill-danger' : 'fill-ink-3'}>
        {tall ? state : `${state} · ${unacked}/${c.autoAck ? '∞' : c.prefetch} unacked`}
      </text>
      <rect x={l + 6} y={b.y + b.h / 2 - 7} width={b.w - 12} height={3} className="fill-bg-2" />
      <rect x={l + 6} y={b.y + b.h / 2 - 7} width={(b.w - 12) * progress} height={3} className="fill-data-1" />
    </g>
  )
}
