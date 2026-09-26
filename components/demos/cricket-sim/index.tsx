'use client'
/**
 * Cricket sim: a playable limited-overs match against the CPU, with a timing
 * mechanic (hit the ball as it reaches the zone), ball-by-ball commentary, a full
 * scorecard, a Manhattan chart and an optional terminal mode. The engine is a
 * pure C-style update function over serialisable state (see engine.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, DemoToolbar, Segmented, Toggle } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, usePageVisible, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { Commentary } from './Commentary'
import { CSketch } from './CSketch'
import { current, DELIVERIES, newMatch, SHOTS, step, target, userBatting, type Action, type Config, type Match, type Shot, type Timing } from './engine'
import { Field, PITCH, ZONE } from './Field'
import { Scoreboard } from './Scoreboard'
import { Scorecard } from './Scorecard'
import { Setup } from './Setup'
import { Terminal } from './Terminal'

export { notes } from './notes'

type View = 'field' | 'terminal'

const DEFAULT_CONFIG: Config = { overs: 2, wickets: 5, level: 'county', seed: 2022, teams: ['Home XI', 'Away XI'] }
const FLIGHT_MS = { gentle: 1300, county: 1050, test: 850 } as const
const TIMING_LABEL: Record<Timing, string> = { perfect: 'Perfect timing', good: 'Good timing', early: 'Early', late: 'Late', none: '' }

const isMatch = (x: unknown): x is Match =>
  !!x && typeof x === 'object' && (x as Match).v === 1 && Array.isArray((x as Match).innings) && Array.isArray((x as Match).console) && !!(x as Match).config

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const [saved, setSaved] = useLocalStorage<Match | null>('cricket-sim:match', null)
  const [config, setConfig] = useLocalStorage<Config>('cricket-sim:config', DEFAULT_CONFIG)
  const [view, setView] = useLocalStorage<View>('cricket-sim:view', 'field')
  const [timingPref, setTimingPref] = useLocalStorage<boolean | null>('cricket-sim:timing', null)
  const [setup, setSetup] = useState(false)
  const [flying, setFlying] = useState(false)
  const [lastTiming, setLastTiming] = useState<Timing>('none')

  const m = !setup && isMatch(saved) ? saved : null
  const timingOn = timingPref ?? !reduced
  const inn = m ? current(m) : null
  const batting = m ? userBatting(m) : false

  const ballRef = useRef<SVGCircleElement | null>(null)
  const flight = useRef<{ start: number; raf: number } | null>(null)

  const dispatch = useCallback((a: Action) => {
    setSaved((prev) => (isMatch(prev) ? step(prev, a) : prev))
  }, [setSaved])

  const start = (c: Config) => {
    setConfig(c)
    setSaved(newMatch(c))
    setSetup(false)
    setLastTiming('none')
  }
  const rematch = (sameSeed: boolean) => {
    const c = sameSeed || !m ? (m?.config ?? config) : { ...m.config, seed: 1 + Math.floor(Math.random() * 99999) }
    start(c)
  }

  /* ---- the delivery in flight (timing mode) ---------------------- */
  const stopFlight = useCallback(() => {
    if (flight.current) cancelAnimationFrame(flight.current.raf)
    flight.current = null
    setFlying(false)
  }, [])

  const resolve = useCallback((shot: Shot, timing: Timing) => {
    stopFlight()
    setLastTiming(shot === 'leave' ? 'none' : timing)
    dispatch({ type: 'bat', shot, timing })
  }, [dispatch, stopFlight])

  const duration = FLIGHT_MS[m?.config.level ?? 'county']
  const face = useCallback(() => {
    if (flight.current) return
    setFlying(true)
    setLastTiming('none')
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = (now - t0) / duration
      ballRef.current?.setAttribute('cy', (PITCH.top + (PITCH.bottom - PITCH.top) * Math.min(p, 1.15)).toFixed(2))
      if (p > 1.15) { resolve('leave', 'none'); return } // no shot offered: it is a leave
      if (flight.current) flight.current.raf = requestAnimationFrame(tick)
    }
    flight.current = { start: t0, raf: requestAnimationFrame(tick) }
  }, [duration, resolve])

  const play = (shot: Shot) => {
    if (!m || m.phase !== 'innings' || !batting) return
    if (!timingOn) { setLastTiming('none'); dispatch({ type: 'bat', shot, timing: 'none' }); return }
    const f = flight.current
    if (!f) return
    const d = (performance.now() - f.start) / duration - (ZONE.from + ZONE.to) / 2
    const timing: Timing = Math.abs(d) <= 0.03 ? 'perfect' : Math.abs(d) <= 0.07 ? 'good' : d < 0 ? 'early' : 'late'
    resolve(shot, timing)
  }

  // Never leave a ball hanging: hidden tab, view switch, phase change or unmount cancels it.
  useEffect(() => { if (!visible) stopFlight() }, [visible, stopFlight])
  useEffect(() => { stopFlight() }, [view, setup, m?.phase, stopFlight])
  useEffect(() => stopFlight, [stopFlight])

  /* ---- keyboard ---------------------------------------------------- */
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e: KeyboardEvent) => {
    if (!m || view !== 'field' || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
    if (e.key === ' ' && !t?.closest('button, a, [role="radio"]')) {
      if (m.phase === 'innings' && batting && timingOn && !flying) { e.preventDefault(); face() }
      else if (m.phase === 'break') { e.preventDefault(); dispatch({ type: 'next' }) }
      return
    }
    const n = Number(e.key)
    if (!Number.isInteger(n) || n < 1 || m.phase !== 'innings') return
    if (batting) { const s = SHOTS[n - 1]; if (s) { e.preventDefault(); play(s.value) } }
    else { const d = DELIVERIES[n - 1]; if (d) { e.preventDefault(); dispatch({ type: 'bowl', delivery: d.value }) } }
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  /* ---- render ------------------------------------------------------ */
  if (!m) {
    return (
      <div className="grid gap-4">
        <Setup initial={isMatch(saved) ? saved.config : config} onStart={start} hasSaved={isMatch(saved) && saved.phase !== 'done'} onResume={() => setSetup(false)} />
        <CSketch />
      </div>
    )
  }

  const toolbar = (
    <DemoToolbar className="justify-between">
      <Segmented label="View" value={view} onChange={setView} options={[{ value: 'field', label: 'Field' }, { value: 'terminal', label: 'Terminal' }]} />
      <div className="flex flex-wrap items-center gap-3">
        {view === 'field' ? <Toggle label="Timing (hit zone)" checked={timingOn} onChange={setTimingPref} /> : null}
        <Button size="sm" variant="secondary" onClick={() => setSetup(true)}>New match</Button>
      </div>
    </DemoToolbar>
  )

  if (view === 'terminal') {
    return (
      <div className="grid gap-4">
        {toolbar}
        <DemoGrid aside={<DemoPanel title="Scorecard"><Scorecard m={m} /></DemoPanel>}>
          <DemoPanel title="Terminal" meta={`seed ${m.config.seed}`}>
            <Terminal m={m} dispatch={dispatch} onNew={() => rematch(false)} />
          </DemoPanel>
          <CSketch />
        </DemoGrid>
      </div>
    )
  }

  const t = target(m)
  return (
    <div className="grid gap-4">
      {toolbar}
      <DemoGrid
        aside={
          <>
            <DemoPanel title="Scorecard"><Scorecard m={m} /></DemoPanel>
            <CSketch />
          </>
        }
      >
        <DemoPanel
          title="The middle"
          meta={<span className="nums">{m.config.overs} ov · {m.config.wickets} wkts · seed {m.config.seed}</span>}
        >
          <div className="grid gap-4">
            {inn ? <Scoreboard m={m} /> : (
              <p className="m-0 text-1">{m.config.teams[0]} vs {m.config.teams[1]}, {m.config.overs} over{m.config.overs === 1 ? '' : 's'} a side.</p>
            )}

            <div className="relative">
              <Field
                balls={inn?.balls ?? []}
                ballRef={ballRef}
                flying={flying}
                showZone={timingOn && batting && m.phase === 'innings'}
                label={inn ? `Field view with a wagon wheel of ${m.config.teams[inn.team]}'s scoring shots` : 'Field view'}
              />
              {lastTiming !== 'none' && !flying && batting && m.phase === 'innings' ? (
                <div className="absolute left-2 top-2" aria-live="polite">
                  <Badge tone={lastTiming === 'perfect' ? 'ok' : lastTiming === 'good' ? 'accent' : 'warn'}>{TIMING_LABEL[lastTiming]}</Badge>
                </div>
              ) : null}
            </div>

            <PhaseControls
              m={m}
              batting={batting}
              timingOn={timingOn}
              flying={flying}
              target={t}
              onFace={face}
              onPlay={play}
              dispatch={dispatch}
              onRematch={rematch}
              onSetup={() => setSetup(true)}
            />
          </div>
        </DemoPanel>

        <DemoPanel title="Commentary"><Commentary m={m} /></DemoPanel>
      </DemoGrid>
    </div>
  )
}

function PhaseControls({ m, batting, timingOn, flying, target: tgt, onFace, onPlay, dispatch, onRematch, onSetup }: {
  m: Match
  batting: boolean
  timingOn: boolean
  flying: boolean
  target: number | null
  onFace: () => void
  onPlay: (s: Shot) => void
  dispatch: (a: Action) => void
  onRematch: (sameSeed: boolean) => void
  onSetup: () => void
}) {
  switch (m.phase) {
    case 'toss':
      return (
        <div className="grid gap-2">
          <p className="m-0 text-1">The captains meet in the middle. Call it.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => dispatch({ type: 'toss', call: 'heads' })}>Heads</Button>
            <Button variant="secondary" onClick={() => dispatch({ type: 'toss', call: 'tails' })}>Tails</Button>
          </div>
        </div>
      )
    case 'choose':
      return (
        <div className="grid gap-2">
          <p className="m-0 text-1">You won the toss.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => dispatch({ type: 'choose', bat: true })}>Bat first</Button>
            <Button variant="secondary" onClick={() => dispatch({ type: 'choose', bat: false })}>Bowl first</Button>
          </div>
        </div>
      )
    case 'break':
      return (
        <div className="grid gap-2">
          <p className="m-0 text-1">Innings break. Target: <strong className="font-mono nums">{(m.innings[0]?.runs ?? 0) + 1}</strong>.</p>
          <div><Button arrow onClick={() => dispatch({ type: 'next' })}>Start the chase</Button></div>
        </div>
      )
    case 'done':
      return (
        <div className="grid gap-3 p-4 border border-rule rounded-1 bg-bg-2" role="status">
          <p className="m-0 mono text-ink-3">Result</p>
          <p className="display m-0 text-3">{m.result}</p>
          <p className="m-0 text-0 text-ink-2">{m.winner === 0 ? 'Well played.' : m.winner === 1 ? 'The CPU takes this one.' : 'Honours even.'}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onRematch(false)}>Rematch, new seed</Button>
            <Button variant="secondary" onClick={() => onRematch(true)}>Replay seed {m.config.seed}</Button>
            <Button variant="ghost" onClick={onSetup}>Change setup</Button>
          </div>
        </div>
      )
    case 'innings':
      if (batting) {
        return (
          <div className="grid gap-3">
            {timingOn ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={onFace} disabled={flying} icon="play">{flying ? 'Ball on its way…' : 'Face up'}</Button>
                <span className="text-0 text-ink-2">{flying ? 'Pick a shot as the ball reaches the hit zone.' : 'Space or tap to face the next ball.'}</span>
              </div>
            ) : (
              <p className="m-0 text-0 text-ink-2">Pick a shot: the bowler&apos;s delivery is revealed as you play it.</p>
            )}
            <div role="group" aria-label="Shots" className="grid grid-cols-2 xs:grid-cols-3 gap-2">
              {SHOTS.map((s) => (
                <ChoiceButton key={s.value} k={s.key} label={s.label} hint={s.hint} disabled={timingOn && !flying} onClick={() => onPlay(s.value)} hot={flying} />
              ))}
            </div>
          </div>
        )
      }
      return (
        <div className="grid gap-3">
          <p className="m-0 text-0 text-ink-2">
            You are bowling{tgt !== null ? ', defending ' + (tgt - 1) : ''}. Choose the delivery; the CPU batter reads it and picks a shot.
          </p>
          <div role="group" aria-label="Deliveries" className="grid grid-cols-2 xs:grid-cols-3 gap-2">
            {DELIVERIES.map((d) => (
              <ChoiceButton key={d.value} k={d.key} label={d.label} hint={d.hint} onClick={() => dispatch({ type: 'bowl', delivery: d.value })} />
            ))}
          </div>
        </div>
      )
  }
}

function ChoiceButton({ k, label, hint, onClick, disabled, hot }: { k: string; label: string; hint: string; onClick: () => void; disabled?: boolean; hot?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-keyshortcuts={k}
      className={cx(
        'grid gap-1 text-left min-h-tap px-3 py-2 border border-rule rounded-1 bg-surface text-ink',
        'transition-[transform,background-color] duration-[var(--dur-fast)] hover:bg-bg-2 active:translate-y-[1px]',
        'disabled:opacity-55 disabled:cursor-not-allowed',
        hot && 'border-accent bg-bg-2',
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <kbd className="font-mono text-00 text-ink-3 border border-rule-soft px-1 rounded-0">{k}</kbd>
      </span>
      <span className="text-00 text-ink-2 leading-snug hidden xs:block">{hint}</span>
    </button>
  )
}
