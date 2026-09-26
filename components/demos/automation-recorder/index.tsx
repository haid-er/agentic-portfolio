'use client'
/**
 * Automation recorder (fb-automation homage): record real DOM events on a sandboxed mock
 * marketplace form, replay them by dispatching real DOM events back, and export the
 * recording as a Puppeteer script. Nothing leaves the browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, DemoToolbar, ErrorState, Loading, Segmented, Toggle } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { EMPTY_SITE, MockSite, validate, type Build, type SiteState } from './site'
import { STRATEGIES, find, labelFor, sampleSteps, selectorOf, setNativeValue, stepId, targetsFor, toStrategy, toSteps, type Step, type Strategy } from './recorder'
import { StepList, type StepStatus } from './StepList'
import { ScriptPanel } from './ScriptPanel'

export { notes } from './notes'

type Speed = '1' | '2' | '4'
const SPEEDS = [{ value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '4', label: '4×' }] as const
type Phase = 'idle' | 'replaying' | 'done' | 'failed'

interface Failure { index: number; selector: string; message: string }
interface Cursor { x: number; y: number; shown: boolean; press: boolean }

/** How long replay polls for a missing selector before failing (scaled by speed), like waitForSelector. */
const SELECTOR_TIMEOUT = 1500

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  // Stored values are checked before use: storage can hold an older schema or hand edits.
  const [storedSteps, setStoredSteps] = useLocalStorage<unknown>('automation-recorder:steps', [])
  const [storedStrategy, setStrategy] = useLocalStorage<unknown>('automation-recorder:strategy', 'testid')
  const steps = useMemo(() => toSteps(storedSteps), [storedSteps])
  const strategy = toStrategy(storedStrategy)
  const setSteps = useCallback((v: Step[] | ((prev: Step[]) => Step[])) => {
    setStoredSteps((prev: unknown) => (typeof v === 'function' ? v(toSteps(prev)) : v))
  }, [setStoredSteps])
  const [site, setSite] = useState<SiteState>(EMPTY_SITE)
  const [build, setBuild] = useState<Build>('a1')
  const [recording, setRecording] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState<Record<string, StepStatus>>({})
  const [failure, setFailure] = useState<Failure | null>(null)
  const [cursor, setCursor] = useState<Cursor>({ x: 24, y: 24, shown: false, press: false })
  const [speed, setSpeed] = useState<Speed>('1')
  const [announce, setAnnounce] = useState('')
  const [progress, setProgress] = useState(0)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const runRef = useRef(0)

  const replaying = phase === 'replaying'

  // ---- the mock site's own behaviour -------------------------------------------------------
  const onChange = useCallback((patch: Partial<SiteState>) => {
    setSite((s) => {
      const next = { ...s, ...patch }
      // Clear an error as soon as its field is fixed.
      const errors = { ...next.errors }
      for (const k of Object.keys(patch) as (keyof SiteState['errors'])[]) delete errors[k]
      return { ...next, errors }
    })
  }, [])
  const onPublish = useCallback(() => {
    setSite((s) => {
      const errors = validate(s)
      return Object.keys(errors).length ? { ...s, errors } : { ...s, errors: {}, published: true }
    })
  }, [])
  const resetSite = useCallback(() => setSite(EMPTY_SITE), [])

  // ---- recording: listen to trusted DOM events on the sandbox ------------------------------
  useEffect(() => {
    const root = frameRef.current
    if (!root || !recording) return
    const push = (step: Omit<Step, 'id'>) => setSteps((prev) => [...prev, { ...step, id: stepId() }])

    const onInput = (e: Event) => {
      if (!e.isTrusted) return
      const el = e.target
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
      const targets = targetsFor(el)
      const label = labelFor(el)
      // Read after React has applied its controlled value (the price field strips letters).
      window.setTimeout(() => {
        const value = el.value
        setSteps((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.kind === 'type' && last.targets?.testid === targets.testid) {
            return [...prev.slice(0, -1), { ...last, value }]
          }
          return [...prev, { id: stepId(), kind: 'type', label, targets, value }]
        })
      }, 0)
    }
    const onSelect = (e: Event) => {
      if (!e.isTrusted || !(e.target instanceof HTMLSelectElement)) return
      const el = e.target
      const targets = targetsFor(el)
      // Arrow keys fire one change per option; keep only the final choice.
      setSteps((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.kind === 'select' && last.targets?.testid === targets.testid) {
          return [...prev.slice(0, -1), { ...last, value: el.value }]
        }
        return [...prev, { id: stepId(), kind: 'select', label: labelFor(el), targets, value: el.value }]
      })
    }
    const onClick = (e: Event) => {
      if (!e.isTrusted || !(e.target instanceof Element)) return
      const btn = e.target.closest('button')
      if (!btn || btn.disabled || !root.contains(btn)) return
      push({ kind: 'click', label: labelFor(btn), targets: targetsFor(btn) })
    }
    root.addEventListener('input', onInput, true)
    root.addEventListener('change', onSelect, true)
    root.addEventListener('click', onClick, true)
    return () => {
      root.removeEventListener('input', onInput, true)
      root.removeEventListener('change', onSelect, true)
      root.removeEventListener('click', onClick, true)
    }
  }, [recording, setSteps])

  // ---- replay ------------------------------------------------------------------------------
  const stop = useCallback(() => {
    runRef.current++
    setPhase('idle')
    setStatus({})
    setCursor((c) => ({ ...c, shown: false }))
    setAnnounce('Replay stopped.')
  }, [])

  // Stop a running replay if the demo unmounts.
  useEffect(() => () => { runRef.current++ }, [])

  const replay = useCallback(async () => {
    const root = frameRef.current
    if (!root || steps.length === 0) return
    const run = ++runRef.current
    const factor = Number(speed)
    const alive = () => runRef.current === run
    const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, reduced ? Math.min(ms, 40) : ms / factor))

    setRecording(false)
    setFailure(null)
    setSite(EMPTY_SITE) // page.goto(): every replay starts from a fresh page
    setStatus(Object.fromEntries(steps.map((s) => [s.id, 'pending' as StepStatus])))
    setPhase('replaying')
    setProgress(0)
    setAnnounce(`Replaying ${steps.length} steps.`)
    await sleep(350)

    const moveTo = async (el: HTMLElement) => {
      el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
      const r = el.getBoundingClientRect()
      const f = root.getBoundingClientRect()
      setCursor({ x: r.left - f.left + Math.min(28, r.width / 2), y: r.top - f.top + Math.min(r.height / 2, 22), shown: true, press: false })
      await sleep(460)
    }

    for (let i = 0; i < steps.length; i++) {
      if (!alive()) return
      const step = steps[i]
      const mark = (st: StepStatus) => setStatus((m) => ({ ...m, [step.id]: st }))
      mark('running')
      try {
        if (step.kind === 'wait') {
          await sleep(step.ms ?? 500)
        } else {
          const sel = selectorOf(step, strategy)
          let el = find(root, sel)
          if (!el) {
            mark('waiting')
            const until = performance.now() + (reduced ? 300 : SELECTOR_TIMEOUT / factor)
            while (!el && performance.now() < until) {
              await sleep(100)
              if (!alive()) return
              el = find(root, sel)
            }
            if (!el) throw Object.assign(new Error(`Waiting for selector \`${sel}\` failed: timeout exceeded`), { selector: sel })
            mark('running')
          }
          await moveTo(el)
          if (!alive()) return
          el.focus({ preventScroll: true })
          if (step.kind === 'click') {
            setCursor((c) => ({ ...c, press: true }))
            await sleep(120)
            el.click()
            setCursor((c) => ({ ...c, press: false }))
          } else if (step.kind === 'select') {
            setNativeValue(el, step.value ?? '', 'change')
          } else {
            const value = step.value ?? ''
            setNativeValue(el, '', 'input')
            if (reduced) {
              setNativeValue(el, value, 'input')
            } else {
              for (let c = 1; c <= value.length; c++) {
                if (!alive()) return
                setNativeValue(el, value.slice(0, c), 'input')
                await sleep(38)
              }
            }
          }
        }
        mark('ok')
        setProgress(i + 1)
        await sleep(220)
      } catch (e) {
        if (!alive()) return
        mark('failed')
        const selector = (e as { selector?: string }).selector ?? selectorOf(step, strategy)
        setFailure({ index: i, selector, message: e instanceof Error ? e.message : 'The step could not run.' })
        setPhase('failed')
        setCursor((c) => ({ ...c, shown: false }))
        setAnnounce(`Replay failed at step ${i + 1}.`)
        return
      }
    }
    if (!alive()) return
    setPhase('done')
    setCursor((c) => ({ ...c, shown: false }))
    await sleep(80)
    const published = Boolean(find(root, '[data-testid="listing-published"]'))
    setAnnounce(published ? 'Replay finished. The listing was published.' : 'Replay finished, but the listing was not published.')
  }, [steps, speed, reduced, strategy])

  // ---- step editing ------------------------------------------------------------------------
  const move = (i: number, dir: -1 | 1) => setSteps((prev) => {
    const j = i + dir
    if (j < 0 || j >= prev.length) return prev
    const next = [...prev]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const del = (i: number) => setSteps((prev) => prev.filter((_, k) => k !== i))
  const addWait = () => setSteps((prev) => [...prev, { id: stepId(), kind: 'wait', label: 'Pause', ms: 500 }])

  const toggleRecord = () => {
    if (recording) {
      setRecording(false)
      setAnnounce('Recording stopped.')
      return
    }
    if (site.published) resetSite()
    setStatus({})
    setFailure(null)
    setPhase('idle')
    setRecording(true)
    setAnnounce('Recording. Actions in the sandbox become steps.')
  }

  const published = site.published
  const hint = failure ? failureHint(strategy, build) : ''

  return (
    <div className="grid gap-4">
      <p className="sr-only" aria-live="polite">{announce}</p>
      <DemoGrid
        aside={
          <DemoPanel
            title="Recorder"
            meta={recording ? <Badge tone="danger">rec</Badge> : `${steps.length} step${steps.length === 1 ? '' : 's'}`}
          >
            <div className="grid gap-4">
              <DemoToolbar>
                <Button
                  variant={recording ? 'danger' : 'primary'}
                  icon={recording ? 'square' : 'register'}
                  onClick={toggleRecord}
                  disabled={replaying}
                  aria-pressed={recording}
                >
                  {recording ? 'Stop recording' : 'Record'}
                </Button>
                {replaying ? (
                  <Button variant="secondary" icon="pause" onClick={stop}>Stop replay</Button>
                ) : (
                  <Button variant="secondary" icon="play" onClick={replay} disabled={steps.length === 0 || recording}>Replay</Button>
                )}
              </DemoToolbar>
              <DemoToolbar>
                <Button variant="ghost" size="sm" icon="refresh" disabled={replaying || recording} onClick={() => { setSteps(sampleSteps()); setStatus({}); setFailure(null); setAnnounce('Sample recording loaded.') }}>
                  Load sample
                </Button>
                <Button variant="ghost" size="sm" icon="close" disabled={replaying || steps.length === 0} onClick={() => { setSteps([]); setStatus({}); setFailure(null); setPhase('idle') }}>
                  Clear steps
                </Button>
              </DemoToolbar>

              <Segmented label="Selector strategy" options={STRATEGIES} value={strategy} onChange={setStrategy} />
              <div className="grid gap-1">
                <Toggle
                  label="Ship a site update"
                  checked={build === 'b7'}
                  disabled={replaying}
                  onChange={(on) => { setBuild(on ? 'b7' : 'a1'); setAnnounce(on ? 'Site build b7 shipped: ids and some labels changed.' : 'Back on site build a1.') }}
                />
                <p className="m-0 text-00 text-ink-3">
                  Build b7 regenerates every hashed id and rewords two labels, like a real site redeploy.
                </p>
              </div>
              <Segmented label="Replay speed" options={SPEEDS} value={speed} onChange={setSpeed} />

              {replaying ? <Loading label={`Replaying step ${Math.min(progress + 1, steps.length)} of ${steps.length}`} /> : null}
              {phase === 'done' ? (
                <p className={cx('m-0 text-0', published ? 'text-ok' : 'text-warn')} role="status">
                  {published
                    ? 'Replay finished: every step ran and the listing was published.'
                    : 'Replay finished, but the listing is not published. Check the form for validation errors.'}
                </p>
              ) : null}
              {failure ? (
                <ErrorState
                  title={`Step ${failure.index + 1} failed`}
                  action={<Button size="sm" variant="secondary" icon="refresh" onClick={replay}>Replay again</Button>}
                >
                  <p className="m-0 font-mono text-00 [overflow-wrap:anywhere]">TimeoutError: {failure.message}</p>
                  <p className="m-0 mt-2">{hint}</p>
                </ErrorState>
              ) : null}

              <StepList
                steps={steps}
                strategy={strategy}
                status={status}
                locked={replaying}
                recording={recording}
                onMove={move}
                onDelete={del}
                onAddWait={addWait}
              />
            </div>
          </DemoPanel>
        }
      >
        <DemoPanel
          title="Sandbox"
          meta={<span className="inline-flex items-center gap-2">build {build}{recording ? <Badge tone="danger">recording</Badge> : null}</span>}
          bodyClassName="p-0"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-rule-soft bg-bg-2">
            <span className="mono text-ink-3 shrink-0">url</span>
            <span className="font-mono text-00 text-ink-2 truncate min-w-0">marketplace.example/listing/new</span>
          </div>
          <div
            ref={frameRef}
            className={cx(
              'relative p-4 overflow-hidden',
              recording && 'outline-2 outline-dashed outline-offset-[-6px] outline-danger',
              replaying && 'pointer-events-none select-none',
            )}
            aria-busy={replaying || undefined}
          >
            <MockSite build={build} state={site} onChange={onChange} onPublish={onPublish} onReset={resetSite} />
            <GhostCursor cursor={cursor} reduced={reduced} />
          </div>
        </DemoPanel>
      </DemoGrid>

      <ScriptPanel steps={steps} strategy={strategy} />
    </div>
  )
}

function GhostCursor({ cursor, reduced }: { cursor: Cursor; reduced: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'pointer-events-none absolute left-0 top-0 z-10',
        !reduced && 'transition-[transform,opacity] duration-[var(--dur-med)] ease-[var(--ease-out)]',
        cursor.shown ? 'opacity-100' : 'opacity-0',
      )}
      style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
    >
      <svg width="22" height="26" viewBox="0 0 22 26" className={cx('origin-top-left', cursor.press && 'scale-90')}>
        <path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.6 15 L18 15 Z" fill="var(--ink)" stroke="var(--surface)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {cursor.press ? <span className="absolute -left-2 -top-2 size-5 rounded-pill border-2 border-accent-2" /> : null}
    </div>
  )
}

function failureHint(strategy: Strategy, build: Build): string {
  if (strategy === 'css') return `Hashed ids are regenerated on every deploy, and this page is build ${build}. CSS id selectors recorded on another build cannot match. Switch to data-testid and replay.`
  if (strategy === 'aria') return 'A label was reworded between builds, so the aria-label selector no longer matches. data-testid survives copy changes.'
  return 'Even data-testid could not find it: the element really is gone from this page. Re-record this step or delete it.'
}
