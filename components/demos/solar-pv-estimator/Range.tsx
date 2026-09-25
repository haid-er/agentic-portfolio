'use client'
/** Labelled range slider with a live mono read-out (44px target, visible label). */
import { useId } from 'react'
import { cx } from '@/lib/utils'

export function Range({ label, value, min, max, step = 1, format, onChange, className, hint }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  className?: string
  hint?: string
}) {
  const id = useId()
  const shown = format ? format(value) : String(value)
  return (
    <div className={cx('flex flex-col gap-1 min-w-0', className)}>
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
        aria-valuetext={shown}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full min-h-tap accent-[var(--accent)] cursor-pointer"
      />
      {hint ? <p id={`${id}-hint`} className="m-0 text-00 text-ink-3">{hint}</p> : null}
    </div>
  )
}
