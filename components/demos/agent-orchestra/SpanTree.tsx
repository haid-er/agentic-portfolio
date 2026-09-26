'use client'
/** Langfuse-style trace: nested spans with a live waterfall, timeout deadlines and backoff gaps. */
import { Badge } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'
import { flattenTree, type Span, type SpanStatus } from './engine'

const STATUS: Record<SpanStatus, { label: string; icon: IconName; tone: 'ok' | 'danger' | 'warn' | 'neutral' | 'accent' }> = {
  running: { label: 'running', icon: 'play', tone: 'accent' },
  ok: { label: 'ok', icon: 'check', tone: 'ok' },
  error: { label: 'error', icon: 'alert', tone: 'danger' },
  timeout: { label: 'timed out', icon: 'alert', tone: 'warn' },
  cancelled: { label: 'cancelled', icon: 'close', tone: 'neutral' },
}

export const fmtMs = (ms: number) => (ms < 1000 ? `${Math.max(0, Math.round(ms))} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`)

function barClass(s: Span): string {
  if (s.kind === 'backoff') return 'border border-dashed border-ink-3 bg-transparent'
  if (s.status === 'running') return 'bg-accent'
  if (s.status === 'error') return 'bg-danger'
  if (s.status === 'timeout') return 'bg-data-3 [background-image:repeating-linear-gradient(135deg,transparent_0_4px,var(--surface)_4px_6px)]'
  if (s.status === 'cancelled') return 'bg-ink-3'
  if (s.kind === 'workflow') return 'bg-data-4'
  if (s.kind === 'agent') return 'bg-data-2'
  return 'bg-data-1'
}

export function SpanTree({ spans, now, selected, onSelect }: {
  spans: Span[]
  now: number
  selected: string | null
  onSelect: (id: string) => void
}) {
  const rows = flattenTree(spans)
  const total = Math.max(1000, now, ...spans.map((s) => s.end ?? now), ...spans.filter((s) => s.status === 'running' && s.deadline).map((s) => s.deadline as number)) * 1.03
  const pct = (ms: number) => `${Math.min(100, (ms / total) * 100)}%`
  const ticks = [0.25, 0.5, 0.75]

  return (
    <div className="grid gap-1 min-w-0">
      <div className="hidden md:grid grid-cols-[minmax(0,16rem)_minmax(0,1fr)] gap-x-3" aria-hidden="true">
        <span className="mono text-ink-3">Span</span>
        <span className="relative h-5 font-mono text-00 text-ink-3 nums">
          <span className="absolute left-0">0</span>
          {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t * 100}%` }}>{fmtMs(total * t)}</span>)}
        </span>
      </div>
      <ol className="m-0 p-0 list-none grid gap-[2px]" aria-label="Span tree">
        {rows.map(({ span: s, depth }) => {
          const end = s.end ?? now
          const dur = end - s.start
          const st = STATUS[s.status]
          const on = selected === s.id
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-pressed={on}
                aria-label={`${s.name}, ${s.kind}, ${st.label}, ${fmtMs(dur)}`}
                className={cx(
                  'grid w-full min-h-tap grid-cols-1 items-center gap-x-3 gap-y-1 px-2 py-1 text-left rounded-0 border md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]',
                  on ? 'border-accent bg-bg-2' : 'border-transparent hover:bg-bg-2',
                )}
              >
                <span className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${Math.min(depth, 4) * 14}px` }}>
                  <Icon name={s.kind === 'workflow' ? 'nodes' : s.kind === 'backoff' ? 'pause' : st.icon} size={14} className={cx('shrink-0', s.status === 'error' ? 'text-danger' : s.status === 'timeout' ? 'text-warn' : 'text-ink-3')} />
                  <span className={cx('truncate text-0', s.kind === 'generation' || s.kind === 'backoff' ? 'font-mono text-00 text-ink-2' : 'font-semibold text-ink')}>{s.name}</span>
                  <span className="ml-auto shrink-0 nums font-mono text-00 text-ink-3">{fmtMs(dur)}</span>
                </span>
                <span className="relative block h-4 bg-bg-2 rounded-0 overflow-hidden" aria-hidden="true">
                  {ticks.map((t) => <span key={t} className="absolute inset-y-0 border-l border-rule-soft" style={{ left: `${t * 100}%` }} />)}
                  <span className={cx('absolute inset-y-[3px] rounded-0 min-w-[3px]', barClass(s))} style={{ left: pct(s.start), width: pct(Math.max(0, dur)) }} />
                  {s.status === 'running' && s.deadline ? (
                    <span className="absolute inset-y-0 border-l-2 border-dashed border-danger" style={{ left: pct(s.deadline) }} title="start-to-close timeout" />
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-00 text-ink-3" aria-hidden="true">
        <span><span className="inline-block w-3 h-2 bg-data-2 mr-1" />agent</span>
        <span><span className="inline-block w-3 h-2 bg-data-1 mr-1" />attempt</span>
        <span><span className="inline-block w-3 h-2 border border-dashed border-ink-3 mr-1" />backoff</span>
        <span><span className="inline-block w-3 h-2 bg-data-3 mr-1" />timed out</span>
        <span><span className="inline-block w-3 h-2 bg-danger mr-1" />failed</span>
        <span><span className="inline-block h-3 border-l-2 border-dashed border-danger mr-1 align-middle" />timeout deadline</span>
      </p>
    </div>
  )
}

export function SpanDetail({ span, now }: { span: Span; now: number }) {
  const st = STATUS[span.status]
  const attrs = Object.entries(span.attrs)
  return (
    <div className="grid gap-3 p-3 border border-rule-soft rounded-1 bg-bg-2 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold [overflow-wrap:anywhere]">{span.name}</span>
        <Badge tone={st.tone}>{st.label}</Badge>
        <span className="mono text-ink-3">{span.kind}</span>
      </div>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-00">
        <dt className="text-ink-3">start</dt><dd className="m-0 nums">+{fmtMs(span.start)}</dd>
        <dt className="text-ink-3">duration</dt><dd className="m-0 nums">{fmtMs((span.end ?? now) - span.start)}{span.end == null ? ' (running)' : ''}</dd>
        {attrs.map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-ink-3">{k}</dt><dd className="m-0 [overflow-wrap:anywhere]">{String(v)}</dd></div>
        ))}
      </dl>
      {span.error ? <p className="m-0 text-0 text-danger [overflow-wrap:anywhere]">{span.error}</p> : null}
      {span.input !== undefined ? <Json label="input" value={span.input} /> : null}
      {span.output !== undefined ? <Json label="output" value={span.output} /> : null}
    </div>
  )
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-1 min-w-0">
      <span className="mono text-ink-3">{label}</span>
      <pre className="m-0 max-h-56 overflow-auto whitespace-pre-wrap p-2 font-mono text-00 leading-[1.5] bg-surface border border-rule-soft rounded-0 [overflow-wrap:anywhere]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}
