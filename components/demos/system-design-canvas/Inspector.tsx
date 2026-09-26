'use client'
/** Details and controls for the selected component: replicas, cache hit rate, live numbers, wiring. */
import { useState } from 'react'
import { Badge, Button, EmptyState, Icon } from '@/components/ui'
import { SPEC, canConnect, fmtMs, fmtRate, type Cloud, type Design, type NodeT, type SimResult } from './model'
import { Range } from './Range'

export function Inspector({ design, node, sim, cloud, connecting, onPatch, onConnect, onDisconnect, onStartConnect, onDelete }: {
  design: Design
  node: NodeT | null
  sim: SimResult | null
  cloud: Cloud
  connecting: boolean
  onPatch: (id: string, patch: Partial<NodeT>) => void
  onConnect: (from: string, to: string) => void
  onDisconnect: (from: string, to: string) => void
  onStartConnect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [target, setTarget] = useState('')
  if (!node) {
    return (
      <EmptyState title="Nothing selected">
        Tap or Tab to a component to scale it and wire it up. Drag components to arrange the board.
      </EmptyState>
    )
  }
  const spec = SPEC[node.kind]
  const s = sim?.nodes[node.id]
  const outgoing = design.edges.filter((e) => e.from === node.id)
  const incoming = design.edges.filter((e) => e.to === node.id)
  const label = (id: string) => {
    const n = design.nodes.find((x) => x.id === id)
    return n ? `${SPEC[n.kind].label}${sameKindCount(design, n) > 1 ? ` (${n.id})` : ''}` : id
  }
  const candidates = design.nodes.filter((n) => canConnect(design, node.id, n.id) === null)
  const util = s?.util ?? 0
  const tone = util >= 1 ? 'danger' : util >= 0.7 ? 'warn' : 'ok'

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <span className="display text-2">{spec.label}</span>
          {node.kind !== 'client' && s ? (
            <Badge tone={tone}>{util >= 1 ? 'overloaded' : util >= 0.7 ? 'hot' : 'healthy'}</Badge>
          ) : null}
          {sim?.bottleneck === node.id ? <Badge tone="danger">bottleneck</Badge> : null}
        </p>
        <p className="m-0 mono text-ink-3">{spec.names[cloud]}</p>
        <p className="m-0 text-0 text-ink-2">{spec.blurb}</p>
      </div>

      {node.kind !== 'client' ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="mono text-ink-2" id={`rep-${node.id}`}>{node.kind === 'db' ? 'Nodes (1 primary + read replicas)' : 'Replicas'}</span>
            <div className="inline-flex items-center border border-rule rounded-pill" role="group" aria-labelledby={`rep-${node.id}`}>
              <button type="button" aria-label="Remove a replica" disabled={node.replicas <= 1} onClick={() => onPatch(node.id, { replicas: node.replicas - 1 })} className="size-tap inline-flex items-center justify-center disabled:opacity-40 hover:bg-bg-2 rounded-pill">
                <Icon name="minus" size={16} />
              </button>
              <output className="min-w-8 text-center nums font-semibold" aria-live="polite">{node.replicas}</output>
              <button type="button" aria-label="Add a replica" disabled={node.replicas >= spec.maxReplicas} onClick={() => onPatch(node.id, { replicas: node.replicas + 1 })} className="size-tap inline-flex items-center justify-center disabled:opacity-40 hover:bg-bg-2 rounded-pill">
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
          <p className="m-0 text-00 text-ink-3 nums">
            {Number.isFinite(spec.cap) ? `${fmtRate(spec.cap)} req/s per ${node.kind === 'db' ? 'node (writes only on the primary)' : 'replica'} · ${spec.base} ms idle` : ''}
          </p>
          {node.kind === 'cache' ? (
            <Range
              label="Hit rate"
              min={50}
              max={99}
              step={1}
              value={Math.round((node.hitRate ?? 0.85) * 100)}
              display={`${Math.round((node.hitRate ?? 0.85) * 100)}%`}
              onChange={(v) => onPatch(node.id, { hitRate: v / 100 })}
            />
          ) : null}
        </div>
      ) : null}

      {s ? (
        <dl className="m-0 grid grid-cols-2 gap-2 text-0">
          <Fact label="In" value={`${fmtRate(s.in)}/s`} />
          <Fact label="Served" value={`${fmtRate(s.served)}/s`} />
          {node.kind !== 'client' ? <Fact label="Busy" value={Number.isFinite(util) ? `${Math.round(util * 100)}%` : 'no consumer'} /> : null}
          {node.kind !== 'client' ? <Fact label="Latency" value={fmtMs(s.lat)} /> : null}
          {s.dropped > 0.5 ? <Fact label="Failing" value={`${fmtRate(s.dropped)}/s`} danger /> : null}
          {node.kind === 'queue' ? <Fact label="Backlog" value={fmtRate(s.backlog ?? 0)} /> : null}
          {s.note ? <p className="col-span-2 m-0 flex items-center gap-1 text-warn"><Icon name="info" size={14} />{s.note}</p> : null}
        </dl>
      ) : null}

      <div className="grid gap-2">
        <p className="m-0 mono text-ink-2">Sends traffic to</p>
        {outgoing.length ? (
          <ul className="m-0 p-0 list-none grid gap-1">
            {outgoing.map((e) => (
              <li key={e.to} className="flex items-center justify-between gap-2 text-0 border-b border-rule-soft">
                <span>{label(e.to)}</span>
                <button type="button" onClick={() => onDisconnect(e.from, e.to)} aria-label={`Disconnect from ${label(e.to)}`} className="size-tap inline-flex items-center justify-center text-ink-2 hover:text-danger">
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="m-0 text-0 text-ink-3">{node.kind === 'db' ? 'A database is the end of the line.' : 'Nothing yet.'}</p>}
        {incoming.length ? <p className="m-0 text-00 text-ink-3">Receives from: {incoming.map((e) => label(e.from)).join(', ')}</p> : null}
        {candidates.length ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 min-w-0 flex-1">
              <span className="mono text-ink-2">Connect to</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="min-h-tap px-3 bg-surface text-ink border border-rule rounded-0">
                <option value="">Choose…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{label(c.id)}</option>)}
              </select>
            </label>
            <Button size="sm" variant="secondary" disabled={!target} onClick={() => { onConnect(node.id, target); setTarget('') }}>Connect</Button>
          </div>
        ) : null}
        {candidates.length ? (
          <Button size="sm" variant="ghost" icon="nodes" onClick={() => onStartConnect(node.id)} aria-pressed={connecting} className="justify-self-start">
            {connecting ? 'Now tap a highlighted component' : 'Connect on the board'}
          </Button>
        ) : null}
      </div>

      {node.kind !== 'client' ? (
        <Button size="sm" variant="danger" icon="close" onClick={() => onDelete(node.id)} className="justify-self-start">Remove component</Button>
      ) : null}
    </div>
  )
}

function sameKindCount(d: Design, n: NodeT) {
  return d.nodes.filter((x) => x.kind === n.kind).length
}

function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="grid gap-[2px] p-2 bg-bg-2 rounded-1">
      <dt className="mono text-ink-3">{label}</dt>
      <dd className={`m-0 nums font-semibold ${danger ? 'text-danger' : ''}`}>{value}</dd>
    </div>
  )
}
