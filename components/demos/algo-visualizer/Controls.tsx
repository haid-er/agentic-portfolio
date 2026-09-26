'use client'
/** Transport for a recorded trace: play/pause, back, step, finish, reset and a scrubber. */
import { useId } from 'react'
import { Button, DemoToolbar, Segmented } from '@/components/ui'
import type { Playback } from './usePlayback'

export type Speed = 'slow' | 'normal' | 'fast'
export const SPEED_OPTIONS = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
] as const

export function Controls({ pb, speed, onSpeed, label }: {
  pb: Playback
  speed: Speed
  onSpeed: (s: Speed) => void
  /** What a step is, e.g. "expansion" or "operation". */
  label: string
}) {
  const id = useId()
  const atEnd = pb.step >= pb.total
  return (
    <div className="grid gap-3 min-w-0">
      <DemoToolbar>
        <Button variant="primary" icon={pb.playing ? 'pause' : 'play'} onClick={pb.toggle} disabled={pb.total === 0}>
          {pb.playing ? 'Pause' : atEnd && pb.total > 0 ? 'Replay' : 'Play'}
        </Button>
        <Button variant="secondary" size="sm" onClick={pb.back} disabled={pb.step === 0} aria-label={`Back one ${label}`}>
          Back
        </Button>
        <Button variant="secondary" size="sm" icon="step" onClick={pb.forward} disabled={atEnd} aria-label={`Forward one ${label}`}>
          Step
        </Button>
        <Button variant="ghost" size="sm" onClick={pb.finish} disabled={atEnd}>End</Button>
        <Button variant="ghost" size="sm" icon="refresh" onClick={pb.reset} disabled={pb.step === 0}>Reset</Button>
      </DemoToolbar>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-[12rem]">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={id} className="mono text-ink-2">Scrub</label>
            <output htmlFor={id} className="mono text-ink nums">{pb.step} / {pb.total}</output>
          </div>
          <input
            id={id}
            type="range"
            min={0}
            max={Math.max(1, pb.total)}
            value={pb.step}
            aria-valuetext={`${label} ${pb.step} of ${pb.total}`}
            onChange={(e) => pb.setStep(Number(e.target.value))}
            className="w-full min-h-tap accent-[var(--accent)] cursor-pointer"
          />
        </div>
        <Segmented<Speed> label="Speed" options={SPEED_OPTIONS} value={speed} onChange={onSpeed} />
      </div>
    </div>
  )
}

/** A small printed counter: mono label over a display-type number. */
export function Counter({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[5.5rem] border-l-2 border-rule pl-3 strata:border-rule-soft">
      <span className="mono text-ink-3">{label}</span>
      <span className="display nums text-3 leading-none">{value}</span>
      {note ? <span className="text-00 text-ink-3">{note}</span> : null}
    </div>
  )
}
