'use client'
/**
 * Web perf lab: toggle four optimisations and watch a simulated field-service dashboard
 * load. The waterfall replays on every change, on the baseline's time scale, so the win is
 * visible as empty space. The reported production result comes from content, resolved on the
 * server and passed in as `reported` (see ./reported.ts), so this chunk never bundles lib/content.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Badge, Button, DemoGrid, DemoPanel, DemoToolbar, ErrorState, Metric, Segmented, Toggle,
} from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { ALL_OFF, ALL_ON, kb, NETWORKS, seconds, simulate, type NetId, type Opts } from './model'
import { SNIPPETS, TOGGLES } from './snippets'
import type { ReportedMetric } from './reported'
import { Waterfall } from './Waterfall'

export { notes } from './notes'

const NET_OPTIONS = (Object.keys(NETWORKS) as NetId[]).map((id) => ({ value: id, label: NETWORKS[id].label }))
const PLAY_MS = 1800

function safeOpts(raw: unknown): Opts {
  const r = (typeof raw === 'object' && raw ? raw : {}) as Partial<Opts>
  return { split: Boolean(r.split), lazy: Boolean(r.lazy), compress: Boolean(r.compress), dedupe: Boolean(r.dedupe) }
}

export default function Demo({ data }: DemoProps) {
  const reported = (data as { reported?: ReportedMetric | null } | undefined)?.reported ?? null
  const reduced = useReducedMotion()
  const [rawOpts, setRawOpts] = useLocalStorage<Opts>('web-perf-lab:opts', ALL_OFF)
  const [netRaw, setNet] = useLocalStorage<NetId>('web-perf-lab:net', '3g')
  const opts = useMemo(() => safeOpts(rawOpts), [rawOpts])
  const net = NETWORKS[netRaw] ? netRaw : '3g'
  const [focus, setFocus] = useState<keyof Opts>('split')
  const [run, setRun] = useState(0)

  const result = useMemo(() => simulate(opts, NETWORKS[net]), [opts, net])
  const baseline = useMemo(() => simulate(ALL_OFF, NETWORKS[net]), [net])
  const scale = Math.max(baseline.loaded, result.loaded) * 1.02

  // replay the waterfall from 0 whenever the inputs change
  const [head, setHead] = useState(Infinity)
  useEffect(() => {
    if (reduced) { setHead(Infinity); return }
    let raf = 0
    const t0 = performance.now()
    const end = result.loaded
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / PLAY_MS)
      setHead(p >= 1 ? Infinity : end * (1 - (1 - p) ** 2))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [result, reduced, run])

  const set = (k: keyof Opts, v: boolean) => { setRawOpts({ ...opts, [k]: v }); setFocus(k) }
  const failed = result.ready < 0
  const shown = (ms: number) => (head >= ms ? seconds(ms) : '…')
  const saved = baseline.ready - result.ready
  const onCount = Object.values(opts).filter(Boolean).length

  const stats = [
    { label: 'First paint', value: shown(result.fcp), base: seconds(baseline.fcp) },
    { label: 'Transferred', value: kb(result.transferKb), base: kb(baseline.transferKb) },
    { label: 'Requests before ready', value: String(result.requestsBeforeReady), base: String(baseline.requestsBeforeReady) },
    { label: 'Main-thread JS', value: `${Math.round(result.mainThreadMs)} ms`, base: `${Math.round(baseline.mainThreadMs)} ms` },
  ]

  return (
    <div className="grid gap-4 min-w-0">
      <DemoGrid
        aside={
          <>
            <DemoPanel title="Optimisations" meta={`${onCount} of 4 on`}>
              <div className="grid gap-1">
                {TOGGLES.map((t) => (
                  <div key={t.key} className="grid gap-0 border-b border-rule-soft pb-2 last:border-b-0">
                    <Toggle label={t.label} checked={opts[t.key]} onChange={(v) => set(t.key, v)} />
                    <p className="m-0 text-00 text-ink-3">{t.hint}</p>
                  </div>
                ))}
              </div>
              <DemoToolbar className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => setRawOpts(ALL_OFF)}>Before</Button>
                <Button size="sm" variant="primary" onClick={() => setRawOpts(ALL_ON)}>After</Button>
                <Button size="sm" variant="ghost" icon="refresh" onClick={() => setRun((n) => n + 1)} disabled={reduced}>Replay</Button>
              </DemoToolbar>
            </DemoPanel>

            <DemoPanel title="The change" meta={TOGGLES.find((t) => t.key === focus)?.label}>
              <pre tabIndex={0} aria-label="Code snippet" className="m-0 p-3 bg-bg-2 border border-rule-soft rounded-1 overflow-x-auto text-00 font-mono leading-[1.55]"><code>{SNIPPETS[focus]}</code></pre>
              <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Show the code for">
                {TOGGLES.map((t) => (
                  <Button key={t.key} size="sm" variant={t.key === focus ? 'secondary' : 'ghost'} aria-pressed={t.key === focus} onClick={() => setFocus(t.key)}>
                    {t.short}
                  </Button>
                ))}
              </div>
              {result.removed.length ? (
                <ul className="m-0 mt-3 pl-5 text-0 text-ink-2 grid gap-1">
                  {result.removed.map((r) => <li key={r}>{r}</li>)}
                </ul>
              ) : null}
            </DemoPanel>

            {reported ? (
              <DemoPanel title="Reported in production" meta={[reported.org, reported.product].filter(Boolean).join(' · ')}>
                <Metric from={reported.from} to={reported.to} label={reported.label} />
                <p className="m-0 mt-2 text-00 text-ink-3">From the working record. The lab above is a model, tuned so its default profile lands near this result.</p>
              </DemoPanel>
            ) : null}
          </>
        }
      >
        <DemoPanel title="Dashboard load" meta="simulated · HTTP/1.1 · 6 connections">
          <div className="grid gap-4">
            <Segmented label="Network" options={NET_OPTIONS} value={net} onChange={setNet} />

            {failed ? (
              <ErrorState title="The simulation did not finish">Nothing is estimated. Try another combination.</ErrorState>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2" aria-live="polite" aria-atomic="true">
                  <div>
                    <p className="m-0 mono text-ink-3">Dashboard ready</p>
                    <p className={cx('m-0 display text-5 nums leading-none', head >= result.ready ? 'text-accent' : 'text-ink-3')}>
                      {shown(result.ready)}
                    </p>
                  </div>
                  <div className="pb-1">
                    {head >= result.ready ? (
                      saved > 50
                        ? <Badge tone="ok">−{seconds(saved)} vs baseline {seconds(baseline.ready)}</Badge>
                        : <Badge>baseline</Badge>
                    ) : <Badge tone="warn">loading</Badge>}
                  </div>
                </div>

                <dl className="m-0 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stats.map((s) => (
                    <div key={s.label} className="border-t border-rule pt-2 min-w-0">
                      <dt className="mono text-ink-3">{s.label}</dt>
                      <dd className="m-0 display text-3 nums">{s.value}</dd>
                      <dd className="m-0 text-00 text-ink-3 nums">baseline {s.base}</dd>
                    </div>
                  ))}
                </dl>

                <Waterfall result={result} scale={scale} head={head} baselineReady={baseline.ready} />
              </>
            )}
          </div>
        </DemoPanel>
      </DemoGrid>
    </div>
  )
}
