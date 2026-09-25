'use client'
/**
 * Form primitives (DESIGN.md 6.7): 44px, 1px --rule border, --surface fill,
 * label always visible above in mono, errors in --danger with icon + text,
 * linked with aria-describedby.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from '@/lib/utils'
import { Icon } from './Icon'

export const controlClasses = cx(
  'w-full min-h-tap px-3 py-2 bg-surface text-ink border border-rule rounded-0',
  'placeholder:font-mono placeholder:text-0 placeholder:text-ink-3',
  'aria-[invalid=true]:border-danger disabled:opacity-60',
)

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  /** Visually hide the label (still announced). Prefer visible labels. */
  hideLabel?: boolean
  className?: string
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

/** Label + control + hint/error wiring. Use the concrete Input/Textarea/Select below. */
export function Field({ label, hint, error, hideLabel, className, children }: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cx('flex flex-col gap-1 min-w-0', className)}>
      <label htmlFor={id} className={cx('mono text-ink-2', hideLabel && 'sr-only')}>{label}</label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? <p id={hintId} className="m-0 text-00 text-ink-3">{hint}</p> : null}
      {error ? (
        <p id={errId} className="m-0 flex items-center gap-1 text-0 text-danger">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

type Base = { label: string; hint?: string; error?: string; hideLabel?: boolean; wrapperClassName?: string }

export function Input({ label, hint, error, hideLabel, wrapperClassName, className, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cx(controlClasses, className)} {...rest} />
      )}
    </Field>
  )
}

export function Textarea({ label, hint, error, hideLabel, wrapperClassName, className, rows = 5, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} rows={rows} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cx(controlClasses, 'leading-[1.5] resize-y', className)} {...rest} />
      )}
    </Field>
  )
}

export function Select({ label, hint, error, hideLabel, wrapperClassName, className, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={cx(controlClasses, 'pr-8', className)} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}

/** Checkbox styled as a switch-like slug. `role="switch"` semantics. */
export function Toggle({ label, checked, onChange, disabled, className }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cx('inline-flex items-center gap-3 min-h-tap cursor-pointer select-none', disabled && 'opacity-60 cursor-not-allowed', className)}>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative inline-block h-6 w-11 border border-rule rounded-pill bg-bg-2 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:top-[3px] after:left-[3px] after:size-4 after:rounded-pill after:bg-ink after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-on-accent"
      />
      <span className="text-0">{label}</span>
      <span className="mono text-ink-3" aria-hidden="true">{checked ? 'on' : 'off'}</span>
    </label>
  )
}
