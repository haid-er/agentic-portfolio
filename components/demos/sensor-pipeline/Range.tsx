'use client'
/** Labelled range slider with a live value readout (44px tall hit area). */
import { useId } from 'react'

export function Range({ label, value, min, max, step, unit, onChange, hint }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
  hint?: string
}) {
  const id = useId()
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="mono text-ink-2">{label}</label>
        <output htmlFor={id} className="mono nums text-ink">{value}{unit}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full min-h-tap accent-[var(--accent)] cursor-pointer"
      />
      {hint ? <p id={`${id}-hint`} className="m-0 text-00 text-ink-3">{hint}</p> : null}
    </div>
  )
}
