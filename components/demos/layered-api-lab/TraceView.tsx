'use client'
/**
 * The trace, drawn as a borehole log: each layer is a band, nested calls step inward,
 * the step that threw is marked, and the error handler closes the log.
 * Steps reveal one by one (instantly under reduced motion).
 */
import { useEffect, useState } from 'react'
import { Badge, EmptyState } from '@/components/ui'
import { useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { LAYERS, type Layer, type TraceStep } from './api/types'
import { LAYER_LABEL } from './sources'

/** Layer inks: tokens only. */
export const LAYER_INK: Record<Layer, string> = {
  router: 'var(--data-4)',
  middleware: 'var(--data-3)',
  controller: 'var(--data-1)',
  service: 'var(--data-2)',
  repository: 'var(--accent)',
  'error-handler': 'var(--danger)',
}

function layerState(trace: TraceStep[], layer: Layer): 'idle' | 'ok' | 'threw' | 'handled' {
  const steps = trace.filter((s) => s.layer === layer)
  if (!steps.length) return 'idle'
  if (steps.some((s) => s.outcome === 'handled')) return 'handled'
  // A layer "threw" only if the error started there (its deepest throwing step).
  const origin = [...trace].reverse().find((s) => s.outcome === 'threw')
  if (origin?.layer === layer) return 'threw'
  return 'ok'
}

export function TraceView({ trace, status, selected, onSelect, runKey }: {
  trace: TraceStep[]
  status: number | null
  selected: Layer
  onSelect: (l: Layer) => void
  runKey: number
}) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(trace.length)

  useEffect(() => {
    if (reduced) { setShown(trace.length); return }
    setShown(0)
    let n = 0
    const id = window.setInterval(() => {
      n += 1
      setShown(n)
      if (n >= trace.length) window.clearInterval(id)
    }, 110)
    return () => window.clearInterval(id)
  }, [runKey, trace.length, reduced])

  if (!trace.length) {
    return <EmptyState title="No request yet">Pick a preset or write your own request, then send it. Each layer it passes through appears here.</EmptyState>
  }

  const origin = [...trace].reverse().find((s) => s.outcome === 'threw')

  return (
    <div className="grid gap-3 min-w-0">
      <ol className="m-0 p-0 list-none grid grid-cols-3 xs:grid-cols-6 gap-1" aria-label="Layers touched">
        {LAYERS.map((l) => {
          const st = layerState(trace, l)
          return (
            <li key={l} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(l)}
                aria-pressed={selected === l}
                className={cx(
                  'w-full min-h-tap px-1 py-1 flex flex-col items-center justify-center gap-[2px] rounded-0 border text-center',
                  selected === l ? 'border-ink bg-bg-2' : 'border-rule-soft bg-surface hover:bg-bg-2',
                  st === 'idle' && 'border-dashed', // dimmed by the grey swatch and dashes, never by fading text
                )}
              >
                <span aria-hidden="true" className="block h-1 w-full rounded-pill" style={{ background: st === 'idle' ? 'var(--rule-soft)' : LAYER_INK[l] }} />
                <span className="font-mono text-00 uppercase tracking-[.04em] leading-tight [overflow-wrap:anywhere]">{LAYER_LABEL[l]}</span>
                <span className="font-mono text-00 text-ink-3">{st === 'idle' ? 'skipped' : st}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <ol className="m-0 p-0 list-none grid gap-1 min-w-0" aria-label="Request trace">
        {trace.slice(0, shown).map((s, i) => {
          const isOrigin = s === origin
          return (
            <li key={`${runKey}-${i}`} className="min-w-0 motion-safe:animate-[fade-in_var(--dur-med)_var(--ease-out)]" style={{ paddingLeft: `min(${s.depth * 14}px, 12vw)` }}>
              <button
                type="button"
                onClick={() => onSelect(s.layer)}
                className={cx(
                  'w-full min-h-tap text-left grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-2 border-l-4 rounded-0',
                  selected === s.layer ? 'bg-bg-2' : 'bg-surface hover:bg-bg-2',
                  'border border-rule-soft',
                )}
                style={{ borderLeftColor: LAYER_INK[s.layer] }}
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                  <span className="font-mono text-00 uppercase tracking-[.08em] text-ink-3">{LAYER_LABEL[s.layer]}</span>
                  <span className="font-mono text-0 text-ink [overflow-wrap:anywhere]">{s.label}</span>
                  {isOrigin ? <Badge tone="danger">threw here</Badge> : s.outcome === 'threw' ? <Badge tone="warn">propagated</Badge> : null}
                  {s.outcome === 'handled' ? <Badge tone="accent">handled</Badge> : null}
                </span>
                <span className="font-mono text-00 text-ink-3 nums self-start pt-[2px]">{s.ms.toFixed(3)} ms</span>
                {s.detail ? <span className="col-span-2 font-mono text-00 text-ink-2 [overflow-wrap:anywhere]">{s.detail}</span> : null}
              </button>
            </li>
          )
        })}
        {shown >= trace.length && status !== null ? (
          <li className="flex items-center gap-2 px-3 py-2 font-mono text-0" aria-live="polite">
            <span aria-hidden="true" className="text-ink-3">&larr;</span>
            <span>response</span>
            <Badge tone={status >= 500 ? 'danger' : status >= 400 ? 'warn' : 'ok'}>{status}</Badge>
          </li>
        ) : null}
      </ol>
    </div>
  )
}
