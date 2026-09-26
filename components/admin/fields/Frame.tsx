'use client'
/**
 * Label + control + hint/error wiring for admin fields (DESIGN.md 6.7):
 * mono label always visible above, error in --danger with icon and text,
 * linked with aria-describedby. Adds an "edited" mark and an optional counter.
 */
import { useId, type ReactNode } from 'react'
import { Icon } from '@/components/ui'
import { cx } from '@/lib/utils'

export interface FrameIds { id: string; describedBy: string | undefined; invalid: boolean }

export function FieldFrame({ label, hint, error, changed, aside, className, as = 'div', children }: {
  label: string
  hint?: ReactNode
  error?: string
  changed?: boolean
  /** Right side of the label row (character counter, small action). */
  aside?: ReactNode
  className?: string
  /** 'fieldset' for groups of controls (radio rows, tag lists). */
  as?: 'div' | 'fieldset'
  children: (ids: FrameIds) => ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined
  const Tag = as
  const isGroup = as === 'fieldset'
  // A <legend> must be the fieldset's first child to name the group, so groups get an
  // sr-only legend and a visual-only label row; plain fields use a real <label>.
  const Label = isGroup ? 'span' : 'label'
  return (
    <Tag className={cx('flex flex-col gap-1 min-w-0 border-0 p-0 m-0', className)}>
      {isGroup ? <legend className="sr-only">{label}</legend> : null}
      <div className="flex items-end justify-between gap-2 min-w-0">
        <Label {...(isGroup ? { 'aria-hidden': true } : { htmlFor: id })} className="mono text-ink-2 flex items-center gap-2 p-0">
          {label}
          {changed ? (
            <span className="inline-flex items-center gap-1 text-accent-ink normal-case tracking-normal font-body text-00">
              <span aria-hidden="true" className="inline-block size-[6px] rounded-pill bg-accent-2" />
              edited
            </span>
          ) : null}
        </Label>
        {aside ? <div className="text-00 text-ink-3 nums flex-none">{aside}</div> : null}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errId} className="m-0 flex items-start gap-1 text-0 text-danger">
          <Icon name="alert" size={16} className="mt-[2px]" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? <p id={hintId} className="m-0 text-00 text-ink-3 leading-[1.5]">{hint}</p> : null}
    </Tag>
  )
}

/** "84 / 160" with a tone when outside the recommended band. */
export function Counter({ length, min, max }: { length: number; min?: number; max: number }) {
  const out = length > max || (min !== undefined && length > 0 && length < min)
  return (
    <span className={cx(out && 'text-warn')} aria-label={`${length} characters, recommended ${min ? `${min} to ` : 'up to '}${max}`}>
      {length} / {max}
    </span>
  )
}
