'use client'
/** Labelled native range input with its value printed beside the label. */
import { useId } from 'react'

export function Range({ label, min, max, step, value, display, onChange, hint }: {
  label: string
  min: number
  max: number
  step: number
  value: number
  display: string
  onChange: (v: number) => void
  hint?: string
}) {
  const id = useId()
  return (
    <div className="grid gap-1 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="mono text-ink-2">{label}</label>
        <output htmlFor={id} className="nums font-semibold text-0">{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full min-h-tap accent-[var(--accent)] cursor-pointer"
      />
      {hint ? <p className="m-0 text-00 text-ink-3">{hint}</p> : null}
    </div>
  )
}
