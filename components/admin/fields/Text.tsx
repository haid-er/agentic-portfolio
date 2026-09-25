'use client'
/** Text, textarea, number and partial-date fields bound to an editor path. */
import type { HTMLInputTypeAttribute, ReactNode } from 'react'
import { controlClasses } from '@/components/ui'
import { cx, formatPartialDate } from '@/lib/utils'
import { useField } from '../EditorContext'
import type { Path } from '../lib/path'
import { Counter, FieldFrame } from './Frame'

interface Common {
  path: Path
  label: string
  hint?: ReactNode
  placeholder?: string
  /** Empty value removes the key (for optional schema fields). */
  optional?: boolean
  className?: string
  /** Recommended length band: shows a counter (never blocks). */
  recommend?: { min?: number; max: number }
  mono?: boolean
}

export function TextField({ path, label, hint, placeholder, optional, className, recommend, mono, type = 'text', inputMode, list, autoComplete }: Common & {
  type?: HTMLInputTypeAttribute
  inputMode?: 'text' | 'url' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search'
  list?: string
  autoComplete?: string
}) {
  const f = useField<string | undefined>(path)
  const value = f.value ?? ''
  return (
    <FieldFrame
      label={label}
      hint={hint}
      error={f.error}
      changed={f.changed}
      className={className}
      aside={recommend ? <Counter length={value.length} {...recommend} /> : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          data-path={f.key}
          type={type}
          inputMode={inputMode}
          list={list}
          autoComplete={autoComplete ?? 'off'}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => f.set(optional && e.target.value === '' ? undefined : e.target.value)}
          className={cx(controlClasses, mono && 'font-mono text-0')}
        />
      )}
    </FieldFrame>
  )
}

export function TextAreaField({ path, label, hint, placeholder, optional, className, recommend, mono, rows = 3 }: Common & { rows?: number }) {
  const f = useField<string | undefined>(path)
  const value = f.value ?? ''
  return (
    <FieldFrame
      label={label}
      hint={hint}
      error={f.error}
      changed={f.changed}
      className={className}
      aside={recommend ? <Counter length={value.length} {...recommend} /> : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          data-path={f.key}
          rows={rows}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => f.set(optional && e.target.value === '' ? undefined : e.target.value)}
          className={cx(controlClasses, 'leading-[1.5] resize-y [field-sizing:content] min-h-[5.5rem]', mono && 'font-mono text-00')}
        />
      )}
    </FieldFrame>
  )
}

export function NumberField({ path, label, hint, optional, className, min, max, step = 1, unit, slider }: Omit<Common, 'recommend' | 'mono' | 'placeholder'> & {
  min?: number
  max?: number
  step?: number
  unit?: string
  /** Also show a range slider (needs min and max). */
  slider?: boolean
}) {
  const f = useField<number | undefined>(path)
  const commit = (raw: string) => {
    if (raw === '') return f.set(optional ? undefined : (Number.NaN as number))
    const n = Number(raw)
    f.set(Number.isFinite(n) ? n : (Number.NaN as number))
  }
  const shown = f.value === undefined || Number.isNaN(f.value) ? '' : String(f.value)
  return (
    <FieldFrame label={label} hint={hint} error={f.error} changed={f.changed} className={className}
      aside={min !== undefined && max !== undefined ? `${min}–${max}${unit ? ` ${unit}` : ''}` : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-none w-[9.5rem]">
            <input
              id={id}
              data-path={f.key}
              type="number"
              inputMode={step < 1 ? 'decimal' : 'numeric'}
              value={shown}
              min={min}
              max={max}
              step={step}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={(e) => commit(e.target.value)}
              className={cx(controlClasses, 'nums font-mono text-0', unit && 'pr-14')}
            />
            {unit ? <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 mono text-ink-3 pointer-events-none">{unit}</span> : null}
          </div>
          {slider && min !== undefined && max !== undefined ? (
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={Number.isFinite(f.value) ? f.value : min}
              aria-label={`${label} slider`}
              onChange={(e) => commit(e.target.value)}
              className="flex-1 min-w-0 min-h-tap accent-[var(--accent)]"
            />
          ) : null}
        </div>
      )}
    </FieldFrame>
  )
}

/** YYYY / YYYY-MM / YYYY-MM-DD with a human read-back; `present` adds an "ongoing" switch (empty = present). */
export function DateField({ path, label, hint, optional, className, present }: Omit<Common, 'recommend' | 'mono' | 'placeholder'> & { present?: boolean }) {
  const f = useField<string | undefined>(path)
  const value = f.value ?? ''
  const isPresent = present && value === ''
  const readBack = value ? formatPartialDate(value) : isPresent ? 'Present' : ''
  return (
    <FieldFrame label={label} hint={hint ?? 'YYYY, YYYY-MM or YYYY-MM-DD'} error={f.error} changed={f.changed} className={className}
      aside={readBack && /^\d{4}/.test(value) ? readBack : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={id}
            data-path={f.key}
            value={value}
            inputMode="numeric"
            placeholder={isPresent ? 'Present' : '2025-09'}
            pattern="\d{4}(-\d{2}(-\d{2})?)?"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={(e) => f.set(optional && e.target.value === '' ? undefined : e.target.value.trim())}
            className={cx(controlClasses, 'font-mono text-0 nums w-[10rem] flex-none')}
          />
          {present ? (
            <label className="inline-flex items-center gap-2 min-h-tap text-0 cursor-pointer">
              <input
                type="checkbox"
                checked={isPresent}
                onChange={(e) => f.set(e.target.checked ? '' : new Date().toISOString().slice(0, 7))}
                className="size-5 accent-[var(--accent)]"
              />
              Ongoing (present)
            </label>
          ) : null}
        </div>
      )}
    </FieldFrame>
  )
}
