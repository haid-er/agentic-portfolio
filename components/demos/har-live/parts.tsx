'use client'
/** Small presentational pieces for har-live: probability bars, the window tape, the loss sparkline. */
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'
import type { EpochLog } from './cnnLstm'
import { ACTIVITIES, ACTIVITY_LABEL, type Activity } from './signal'

export interface WindowResult {
  /** 1-based window number in this session. */
  n: number
  start: number
  truth: number
  baseline: number[]
  cnn?: number[]
}

export const argmax = (p: number[]) => p.reduce((b, v, i) => (v > p[b] ? i : b), 0)
export const pct = (v: number) => `${Math.round(v * 100)}%`

/** The prediction the chosen model makes (falls back to the baseline). */
export function pick(r: WindowResult, model: 'baseline' | 'cnn'): number[] {
  return model === 'cnn' && r.cnn ? r.cnn : r.baseline
}

export function ProbBars({ result }: { result: WindowResult }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 mono text-ink-3" aria-hidden="true">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-4 bg-data-4" />Baseline</span>
        {result.cnn ? <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 bg-data-1" />CNN-LSTM</span> : null}
      </div>
      <ul className="grid gap-2 m-0 p-0 list-none">
        {ACTIVITIES.map((a, i) => {
          const b = result.baseline[i] ?? 0
          const c = result.cnn?.[i]
          const truth = result.truth === i
          return (
            <li key={a} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 text-0">
              <span className={cx('truncate', truth && 'font-semibold')}>
                {ACTIVITY_LABEL[a]}
                {truth ? <span className="sr-only"> (replay script)</span> : null}
                {truth ? <Icon name="check" size={14} className="inline ml-1 text-ok align-[-2px]" /> : null}
              </span>
              <span className="grid gap-[3px]">
                <Bar value={b} className="h-1.5 bg-data-4" label={`Baseline ${pct(b)}`} />
                {c != null ? <Bar value={c} className="h-2.5 bg-data-1" label={`CNN-LSTM ${pct(c)}`} /> : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Bar({ value, className, label }: { value: number; className: string; label: string }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="relative flex-1 h-2.5 bg-bg-2 rounded-pill overflow-hidden" aria-hidden="true">
        <span
          className={cx('absolute left-0 top-1/2 rounded-pill origin-left transition-transform duration-[var(--dur-med)] ease-[var(--ease-out)] motion-reduce:transition-none w-full', className)}
          style={{ transform: `translateY(-50%) scaleX(${Math.max(0.01, value)})` }}
        />
      </span>
      <span className="mono nums text-ink-2 w-10 text-right">{pct(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function WindowTape({ results, model }: { results: WindowResult[]; model: 'baseline' | 'cnn' }) {
  if (!results.length) return null
  return (
    <ol className="flex flex-wrap gap-2 m-0 p-0 list-none" aria-label="Classified windows, newest last">
      {results.slice(-8).map((r) => {
        const p = pick(r, model)
        const k = argmax(p)
        const known = r.truth >= 0
        const ok = known && k === r.truth
        const a = ACTIVITIES[k] as Activity
        return (
          <li
            key={r.n}
            className={cx(
              'flex flex-col gap-0.5 min-w-[6.5rem] px-2 py-1.5 border rounded-1 bg-surface',
              known ? (ok ? 'border-ok' : 'border-danger') : 'border-rule',
            )}
          >
            <span className="mono text-ink-3 flex items-center justify-between gap-2">
              W{r.n}
              {known ? <Icon name={ok ? 'check' : 'close'} size={14} className={ok ? 'text-ok' : 'text-danger'} /> : null}
            </span>
            <span className="text-0 font-semibold leading-tight">{ACTIVITY_LABEL[a]}</span>
            <span className="mono nums text-ink-2">{pct(p[k])}</span>
            {known ? (
              <span className={cx('text-00', ok ? 'sr-only' : 'text-ink-3')}>
                {ok ? 'matches the script' : `script: ${ACTIVITY_LABEL[ACTIVITIES[r.truth] as Activity]}`}
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Loss per epoch (train solid, validation dashed), drawn in SVG. */
export function LossSpark({ log, epochs }: { log: EpochLog[]; epochs: number }) {
  const W = 240, H = 64
  const max = Math.max(0.1, ...log.map((l) => Math.max(l.loss, l.valLoss)))
  const pts = (key: 'loss' | 'valLoss') =>
    log.map((l, i) => `${(i / Math.max(1, epochs - 1)) * (W - 4) + 2},${H - 4 - (l[key] / max) * (H - 10)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-16 bg-bg rounded-1 border border-rule-soft" role="img" aria-label={`Loss curve over ${log.length} epochs`}>
      <line x1="2" x2={W - 2} y1={H - 4} y2={H - 4} className="stroke-rule-soft" vectorEffect="non-scaling-stroke" />
      {log.length > 1 ? <polyline points={pts('valLoss')} fill="none" className="stroke-data-2" strokeWidth="1.5" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" /> : null}
      {log.length > 1 ? <polyline points={pts('loss')} fill="none" className="stroke-data-1" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  )
}
