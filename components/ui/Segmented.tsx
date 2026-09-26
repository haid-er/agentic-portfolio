'use client'
/** Segmented control (radio group) for demo modes: arrow keys move, 44px targets. */
import { useId, useRef, type KeyboardEvent } from 'react'
import { cx } from '@/lib/utils'

export interface SegmentedOption<T extends string> { value: T; label: string }

export function Segmented<T extends string>({ label, options, value, onChange, className }: {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  const id = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (idx + d + options.length) % options.length
    const next = options[n]
    if (next) { onChange(next.value); refs.current[n]?.focus() }
  }
  return (
    <div className={cx('flex flex-col gap-1 min-w-0', className)}>
      <span id={id} className="mono text-ink-2">{label}</span>
      <div role="radiogroup" aria-labelledby={id} onKeyDown={onKey} className="inline-flex flex-wrap max-w-full border border-rule rounded-pill overflow-hidden self-start">
        {options.map((o, i) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              ref={(el) => { refs.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cx(
                'min-h-tap px-4 font-mono text-00 uppercase tracking-[.08em] border-rule [&+&]:border-l',
                on ? 'bg-ink text-bg' : 'bg-surface text-ink hover:bg-bg-2',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
