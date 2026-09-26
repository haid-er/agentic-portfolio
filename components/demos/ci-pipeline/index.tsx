'use client'
/**
 * CI/CD pipeline: lint -> test -> build -> docker -> deploy on a pool of simulated runners.
 * Parallel jobs, a cache store that survives between runs, injected faults, auto-retry with
 * backoff, manual re-runs and a production approval gate. Runs entirely in the browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, DemoPanel, DemoToolbar, ErrorState, Segmented, Select, Table, TableWrap, Td, Th, Toggle, Tr } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, useLocalStorage, usePageVisible } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { Board } from './Board'
import { LogPanel } from './LogPanel'
import { Timeline } from './Timeline'
import { Pipeline, fmt, type Branch, type Fault, type RunConfig, type RunResult, type Snapshot, type Target } from './engine'
import { toWorkflowYaml } from './workflow'

export { notes } from './notes'

type Speed = '1' | '3' | '10'
const SPEEDS = [{ value: '1', label: '1×' }, { value: '3', label: '3×' }, { value: '10', label: '10×' }] as const
const BRANCHES = [{ value: 'feature', label: 'feature/*' }, { value: 'main', label: 'main' }] as const
const TARGETS = [{ value: 'aws', label: 'AWS ECS' }, { value: 'vercel', label: 'Vercel' }] as const
const FAULTS: { value: Fault; label: string }[] = [
  { value: 'none', label: 'None: a clean commit' },
  { value: 'flaky-e2e', label: 'Flaky e2e test (fails once)' },
  { value: 'push-timeout', label: 'Registry push timeout (fails once)' },
  { value: 'lint-error', label: 'Real lint error (fails every time)' },
]
/** Simulated seconds per real second at 1×. Shown in the UI so the scale is never hidden. */
const RATE = 12
const TICK_MS = 100

interface HistoryRow { number: number; sha: string; branch: Branch; target: Target; result: RunResult; time: number; runner: number; hits: number; misses: number }

const toLock = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 1)
const toCacheKeys = (v: unknown): string[] => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : [])
const RESULTS: readonly string[] = ['success', 'failed', 'cancelled', 'running']
function isHistoryRow(v: unknown): v is HistoryRow {
  if (!v || typeof v !== 'object') return false
  const r = v as HistoryRow
  return [r.number, r.time, r.runner, r.hits, r.misses].every(Number.isFinite) &&
    typeof r.sha === 'string' && typeof r.branch === 'string' && typeof r.target === 'string' && RESULTS.includes(r.result)
}
const toHistory = (v: unknown): HistoryRow[] => (Array.isArray(v) ? v.filter(isHistoryRow) : [])

export default function Demo(_props: DemoProps) {
  const visible = usePageVisible()
  const [viewRef, inView] = useInView<HTMLDivElement>({ rootMargin: '160px' })
  const [branch, setBranch] = useState<Branch>('feature')
  const [target, setTarget] = useState<Target>('aws')
  const [fault, setFault] = useState<Fault>('none')
  const [runners, setRunners] = useState('3')
  const [autoRetry, setAutoRetry] = useState(true)
  const [speed, setSpeed] = useState<Speed>('3')
  // Stored values are checked before use: storage can hold an older schema or hand edits.
  const [storedLock, setLockVersion] = useLocalStorage<unknown>('ci-pipeline:lock', 1)
  const [storedCache, setCacheKeys] = useLocalStorage<unknown>('ci-pipeline:cache', [])
  const [storedHistory, setHistory] = useLocalStorage<unknown>('ci-pipeline:history', [])
  const lockVersion = toLock(storedLock)
  const cacheKeys = useMemo(() => toCacheKeys(storedCache), [storedCache])
  const history = useMemo(() => toHistory(storedHistory), [storedHistory])
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [selected, setSelected] = useState('lint')
  const [crash, setCrash] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const pipeRef = useRef<Pipeline | null>(null)
  const cacheRef = useRef<Set<string>>(new Set())
  const recorded = useRef<number>(0)

  // Keep the live cache store in sync with what was persisted (loaded after mount). The Set is
  // mutated in place, never replaced: a finished run keeps its reference and may be re-run.
  useEffect(() => {
    if (pipeRef.current?.result === 'running') return
    const cache = cacheRef.current
    cache.clear()
    cacheKeys.forEach((k) => cache.add(k))
  }, [cacheKeys])

  const cfg: RunConfig = useMemo(
    () => ({ branch, target, fault, runners: Number(runners), autoRetry, lockVersion }),
    [branch, target, fault, runners, autoRetry, lockVersion],
  )

  // Before the first run, show the pipeline these settings would produce.
  const preview = useMemo(() => new Pipeline(0, cfg, new Set()).snapshot(), [cfg])
  const view = snap ?? preview
  const idle = snap === null
  const running = snap?.result === 'running'
  const awaiting = snap?.jobs.find((j) => j.status === 'approval')

  const start = useCallback((overrides: Partial<RunConfig> = {}) => {
    try {
      const number = (history[0]?.number ?? 0) + 1
      const p = new Pipeline(number, { ...cfg, ...overrides }, cacheRef.current)
      pipeRef.current = p
      recorded.current = 0
      setSnap(p.snapshot())
      setSelected('lint')
      setCrash(null)
      setAnnounce(`Run ${number} started on ${p.cfg.branch === 'main' ? 'main' : 'a feature branch'}.`)
    } catch (e) {
      setCrash(e instanceof Error ? e.message : 'The run could not start.')
    }
  }, [cfg, history])

  // The clock. It pauses while the tab is hidden or the demo is scrolled away.
  useEffect(() => {
    if (!running || !visible || !inView || crash) return
    const id = window.setInterval(() => {
      const p = pipeRef.current
      if (!p) return
      try {
        let sim = (TICK_MS / 1000) * RATE * Number(speed)
        while (sim > 0) { const d = Math.min(0.5, sim); p.step(d); sim -= d }
        setSnap(p.snapshot())
      } catch (e) {
        setCrash(e instanceof Error ? e.message : 'The simulation stopped unexpectedly.')
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [running, visible, inView, speed, crash])

  // When a run ends: persist the cache store, add a history row, announce the result.
  useEffect(() => {
    if (!snap || snap.result === 'running' || recorded.current === snap.number) return
    recorded.current = snap.number
    setCacheKeys([...cacheRef.current])
    const row: HistoryRow = {
      number: snap.number, sha: snap.sha, branch: snap.cfg.branch, target: snap.cfg.target, result: snap.result,
      time: snap.time, runner: snap.runnerSeconds, hits: snap.cacheHits, misses: snap.cacheMisses,
    }
    setHistory((h: unknown) => [row, ...toHistory(h).filter((r) => r.number !== row.number)].slice(0, 8))
    setAnnounce(`Run ${snap.number} ${snap.result === 'success' ? 'passed' : snap.result} in ${fmt(snap.time)} of simulated time.`)
  }, [snap, setCacheKeys, setHistory])

  const act = (fn: (p: Pipeline) => void, say: string) => {
    const p = pipeRef.current
    if (!p) return
    fn(p)
    // A re-run of an already recorded run gets recorded again when it ends.
    if (p.result === 'running') recorded.current = 0
    setSnap(p.snapshot())
    setAnnounce(say)
  }

  const failedLint = snap?.result === 'failed' && snap.cfg.fault === 'lint-error'
  const selectedJob = view.jobs.find((j) => j.def.id === selected) ?? view.jobs[0]
  const parallelism = snap && snap.time > 0 ? snap.runnerSeconds / snap.time : 0

  return (
    <div ref={viewRef} className="grid gap-4">
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoPanel title="Trigger" meta={`time ×${RATE * Number(speed)} (simulated)`}>
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Segmented label="Branch" options={BRANCHES} value={branch} onChange={setBranch} />
            <Segmented label="Deploy target" options={TARGETS} value={target} onChange={setTarget} />
            <Select label="Inject a fault" value={fault} onChange={(e) => setFault(e.target.value as Fault)}>
              {FAULTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
            <Segmented
              label="Runners"
              options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '5', label: '5' }]}
              value={runners}
              onChange={setRunners}
            />
          </div>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <Toggle label="Auto-retry failed jobs once" checked={autoRetry} onChange={setAutoRetry} />
            <Segmented label="Speed" options={SPEEDS} value={speed} onChange={setSpeed} />
          </div>
          <DemoToolbar>
            {running ? (
              <Button variant="danger" icon="close" onClick={() => act((p) => p.cancel(), 'Run cancelled.')}>Cancel run</Button>
            ) : (
              <Button icon="play" onClick={() => start()}>{idle ? 'Run pipeline' : 'Run again'}</Button>
            )}
            {snap?.result === 'failed' && !failedLint ? (
              <Button variant="secondary" icon="refresh" onClick={() => act((p) => { p.rerunFailed() }, 'Re-running failed jobs.')}>Re-run failed jobs</Button>
            ) : null}
            {failedLint ? (
              <>
                <Button variant="secondary" icon="refresh" onClick={() => act((p) => { p.rerunFailed() }, 'Re-running failed jobs on the same commit.')}>Re-run failed jobs</Button>
                <Button variant="secondary" icon="upload" onClick={() => { setFault('none'); start({ fault: 'none' }) }}>Push a fix</Button>
              </>
            ) : null}
            {awaiting ? (
              <Button variant="secondary" icon="lock" onClick={() => act((p) => p.approve(awaiting.def.id), 'Production deploy approved.')}>
                Approve production deploy
              </Button>
            ) : null}
          </DemoToolbar>
          <DemoToolbar className="border-t border-rule-soft pt-3">
            <Button
              size="sm"
              variant="ghost"
              icon="doc"
              disabled={running}
              onClick={() => { setLockVersion((v: unknown) => toLock(v) + 1); setAnnounce('package-lock.json changed: every cache key is new, so the next run misses.') }}
            >
              Change package-lock.json
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="close"
              disabled={running || cacheKeys.length === 0}
              onClick={() => { cacheRef.current.clear(); setCacheKeys([]); setAnnounce('Caches cleared.') }}
            >
              Clear caches ({cacheKeys.length})
            </Button>
          </DemoToolbar>
        </div>
      </DemoPanel>

      {crash ? (
        <ErrorState title="The simulation stopped" action={<Button size="sm" variant="secondary" icon="refresh" onClick={() => start()}>Start a new run</Button>}>
          {crash}
        </ErrorState>
      ) : null}

      <DemoPanel
        title={idle ? 'Pipeline (preview)' : `Run #${view.number} · ${view.sha}`}
        meta={idle ? 'not started' : <RunBadge result={view.result} awaiting={Boolean(awaiting)} />}
      >
        <div className="grid gap-5">
          {!idle ? (
            <dl className="m-0 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Wall clock" value={fmt(view.time)} />
              <Stat label="Runner time" value={fmt(view.runnerSeconds)} />
              <Stat label="Parallelism" value={parallelism ? `×${parallelism.toFixed(1)}` : '—'} />
              <Stat label="Cache hit / miss" value={`${view.cacheHits} / ${view.cacheMisses}`} />
            </dl>
          ) : (
            <p className="m-0 text-0 text-ink-2">
              Seven jobs across five stages. Pick a branch, a target and maybe a fault, then run it. Runs share one cache store, so the second run is the interesting one.
            </p>
          )}
          <Board jobs={view.jobs} now={view.time} idle={idle} selected={selectedJob?.def.id ?? ''} onSelect={setSelected} />
          {!idle ? (
            <div className="grid gap-2">
              <p className="m-0 mono text-ink-2">Timeline</p>
              <Timeline jobs={view.jobs} now={view.time} />
            </div>
          ) : null}
        </div>
      </DemoPanel>

      <div className="grid gap-4 mid:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
        <LogPanel job={selectedJob} idle={idle} />
        <DemoPanel title="Run history" meta={history.length ? `${history.length} run${history.length === 1 ? '' : 's'}` : undefined}>
          {history.length ? (
            <div className="grid gap-3">
              <TableWrap label="Previous runs">
                <Table>
                  <thead>
                    <Tr><Th>Run</Th><Th>Result</Th><Th>Wall</Th><Th>Cache</Th></Tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <Tr key={r.number}>
                        <Td><span className="mono text-ink-2">#{r.number}</span> <span className="text-00 text-ink-3">{r.branch === 'main' ? 'main' : 'feat'} · {r.target}</span></Td>
                        <Td><RunBadge result={r.result} /></Td>
                        <Td className="nums whitespace-nowrap">{fmt(r.time)}</Td>
                        <Td className="nums whitespace-nowrap">{r.hits}/{r.hits + r.misses} hit</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              <Button size="sm" variant="ghost" icon="close" disabled={running} onClick={() => setHistory([])} className="justify-self-start">Clear history</Button>
            </div>
          ) : (
            <p className="m-0 text-0 text-ink-2">Finished runs land here, so you can compare a cold cache with a warm one.</p>
          )}
        </DemoPanel>
      </div>

      <DemoPanel title="Workflow file" meta=".github/workflows/ci.yml">
        <details className="group">
          <summary className="cursor-pointer min-h-tap flex items-center mono text-ink-2 hover:text-ink">
            <span className="group-open:hidden">Show the GitHub Actions YAML for these settings</span>
            <span className="hidden group-open:inline">Hide the YAML</span>
          </summary>
          <pre tabIndex={0} aria-label="GitHub Actions workflow" className="m-0 mt-2 max-h-[28rem] overflow-auto p-3 bg-bg border border-rule-soft rounded-1 font-mono text-00 leading-[1.6] text-ink whitespace-pre">
            <code>{toWorkflowYaml(cfg)}</code>
          </pre>
        </details>
      </DemoPanel>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 p-3 bg-bg-2 rounded-1 min-w-0">
      <dt className="mono text-ink-3">{label}</dt>
      <dd className="m-0 display text-3 nums leading-none">{value}</dd>
    </div>
  )
}

function RunBadge({ result, awaiting }: { result: RunResult; awaiting?: boolean }) {
  if (result === 'running') return <Badge tone={awaiting ? 'warn' : 'accent'}>{awaiting ? 'awaiting approval' : 'running'}</Badge>
  return (
    <Badge tone={result === 'success' ? 'ok' : result === 'failed' ? 'danger' : 'neutral'} className={cx(result === 'cancelled' && 'line-through')}>
      {result === 'success' ? 'passed' : result}
    </Badge>
  )
}
