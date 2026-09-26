'use client'
/**
 * Labelled range slider: visible label, live mono read-out, 44px target, accent from
 * --accent, optional hint wired with aria-describedby. Shared primitive for demos.
 */
import { useId } from 'react'
import { cx } from '@/lib/utils'

export interface RangeProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  hint?: string
  disabled?: boolean
  className?: string
}

export function Range({ label, value, min, max, step = 1, format, onChange, hint, disabled, className }: RangeProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const shown = format ? format(value) : String(value)
  return (
    <div className={cx('flex flex-col gap-1 min-w-[9rem] flex-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="mono text-ink-2">{label}</label>
        <output htmlFor={id} className="mono text-ink nums">{shown}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={shown}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full min-h-tap accent-[var(--accent)] cursor-pointer disabled:cursor-not-allowed"
      />
      {hint ? <p id={hintId} className="m-0 text-00 text-ink-3">{hint}</p> : null}
    </div>
  )
}
