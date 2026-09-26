'use client'
/** Verdict stamp, per-test strip and details for a judge run. */
import { Badge, EmptyState, ErrorState, Loading, type Tone } from '@/components/ui'
import { cx } from '@/lib/utils'
import { preview } from './problems'
import { VERDICT_TEXT, type JudgeState, type TestResult, type TestVerdict, type Verdict } from './useJudge'

const TONE: Record<Verdict, Tone> = { AC: 'ok', WA: 'danger', TLE: 'warn', RE: 'danger', CE: 'danger' }
const CELL: Record<TestVerdict, string> = {
  AC: 'border-ok text-ok',
  WA: 'border-danger text-danger',
  RE: 'border-danger text-danger',
  CE: 'border-danger text-danger',
  TLE: 'border-warn text-warn',
  pending: 'border-rule-soft text-ink-3 border-dashed',
  running: 'border-accent text-accent-ink',
  skipped: 'border-rule-soft text-ink-3 border-dashed',
}
const SHORT: Record<TestVerdict, string> = { AC: 'AC', WA: 'WA', RE: 'RE', CE: 'CE', TLE: 'TLE', pending: '·', running: '…', skipped: '–' }

function ms(v: number | undefined) {
  if (v === undefined) return ''
  return v < 1 ? '<1 ms' : `${Math.round(v)} ms`
}

function Stamp({ verdict, sub }: { verdict: Verdict; sub: string }) {
  const tone = TONE[verdict]
  return (
    <div
      className={cx(
        'inline-flex flex-col items-start gap-1 px-4 py-2 border-[3px] rounded-1 -rotate-2 motion-safe:animate-[settle_var(--dur-med)_var(--ease-out)_both] bg-surface',
        tone === 'ok' ? 'border-ok text-ok' : tone === 'warn' ? 'border-warn text-warn' : 'border-danger text-danger',
      )}
    >
      <span className="display text-3 leading-none uppercase">{VERDICT_TEXT[verdict]}</span>
      <span className="mono">{verdict} · {sub}</span>
    </div>
  )
}

function Detail({ r, limit }: { r: TestResult; limit: number }) {
  return (
    <div className="grid gap-2 p-3 border border-rule-soft rounded-1 bg-bg-2 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{r.label}</span>
        <Badge tone={r.verdict === 'AC' ? 'ok' : r.verdict === 'TLE' ? 'warn' : r.verdict === 'skipped' || r.verdict === 'pending' ? 'neutral' : 'danger'}>
          {r.verdict === 'AC' || r.verdict === 'WA' || r.verdict === 'TLE' || r.verdict === 'RE' ? VERDICT_TEXT[r.verdict] : r.verdict}
        </Badge>
        {r.ms !== undefined ? <span className="mono text-ink-3 nums">{ms(r.ms)} / {limit} ms</span> : null}
      </div>
      {r.kind === 'hidden' && r.verdict !== 'AC' && r.verdict !== 'skipped' ? (
        <p className="m-0 text-0 text-ink-2">Hidden test: the input is not shown, only what it exercises.</p>
      ) : null}
      {r.args ? <Code label="Input" text={r.args.map((a) => preview(a)).join(', ')} /> : null}
      {r.expected !== undefined && r.verdict === 'WA' ? <Code label="Expected" text={preview(r.expected)} /> : null}
      {r.got !== undefined || r.verdict === 'WA' ? <Code label="Your output" text={preview(r.got)} /> : null}
      {r.error ? <Code label="Error" text={r.error} tone="danger" /> : null}
      {r.logs && r.logs.length ? <Code label="console" text={r.logs.join('\n')} /> : null}
    </div>
  )
}

function Code({ label, text, tone }: { label: string; text: string; tone?: 'danger' }) {
  return (
    <div className="grid gap-0.5 min-w-0">
      <span className="mono text-ink-3">{label}</span>
      <pre className={cx('m-0 p-2 bg-surface border border-rule-soft rounded-0 font-mono text-00 whitespace-pre-wrap [overflow-wrap:anywhere]', tone === 'danger' ? 'text-danger' : 'text-ink')}>{text}</pre>
    </div>
  )
}

export function Results({ state, limit }: { state: JudgeState; limit: number }) {
  if (state.status === 'failed') {
    return (
      <ErrorState title="The judge could not start">
        <p className="m-0">{state.crash} Nothing was run.</p>
      </ErrorState>
    )
  }
  if (state.status === 'idle') {
    return (
      <EmptyState title="No run yet">
        Run the samples to see your output next to the expected one, then submit to face the hidden tests.
      </EmptyState>
    )
  }

  const passed = state.results.filter((r) => r.verdict === 'AC').length
  const total = state.results.length
  const firstFail = state.results.find((r) => r.verdict !== 'AC' && r.verdict !== 'skipped' && r.verdict !== 'pending' && r.verdict !== 'running')
  const shown = state.mode === 'samples' ? state.results : firstFail ? [firstFail] : []

  return (
    <div className="grid gap-4 min-w-0">
      <div aria-live="polite" className="min-h-[3.5rem]">
        {state.status === 'running' ? (
          <Loading label={`Judging, ${passed} of ${total} passed so far`} />
        ) : state.verdict ? (
          <Stamp
            verdict={state.verdict}
            sub={state.verdict === 'CE' ? 'nothing ran' : `${passed}/${total} tests · slowest ${ms(state.maxMs)}`}
          />
        ) : null}
      </div>

      {state.compileError ? (
        <pre className="m-0 p-3 bg-bg-2 border border-danger rounded-1 font-mono text-00 text-danger whitespace-pre-wrap [overflow-wrap:anywhere]">{state.compileError}</pre>
      ) : (
        <ol aria-label="Tests" className="m-0 p-0 list-none flex flex-wrap gap-1.5">
          {state.results.map((r, i) => (
            <li
              key={i}
              title={`${r.label}: ${r.verdict}${r.ms !== undefined ? `, ${ms(r.ms)}` : ''}`}
              className={cx('min-w-[3rem] px-1.5 py-1 border-2 rounded-0 text-center font-mono text-00 leading-tight', CELL[r.verdict], r.verdict === 'running' && 'motion-safe:animate-pulse')}
            >
              <span className="block text-ink-3">{r.kind === 'sample' ? `S${i + 1}` : `#${i + 1}`}</span>
              <span className="block font-semibold">{SHORT[r.verdict]}</span>
              <span className="sr-only">{r.label}: {r.verdict}</span>
            </li>
          ))}
        </ol>
      )}

      {state.status === 'done' ? shown.map((r, i) => <Detail key={i} r={r} limit={limit} />) : null}
    </div>
  )
}
