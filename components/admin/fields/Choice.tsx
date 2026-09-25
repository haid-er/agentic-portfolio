'use client'
/** Select, toggle and segmented choices bound to an editor path. */
import type { ReactNode } from 'react'
import { Segmented, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { useField } from '../EditorContext'
import type { Path } from '../lib/path'
import { FieldFrame } from './Frame'

export interface Option { value: string; label: string; group?: string }

export function SelectField({ path, label, hint, options, empty, className }: {
  path: Path
  label: string
  hint?: ReactNode
  options: readonly Option[]
  /** Label of an empty choice; picking it removes the key (optional fields). */
  empty?: string
  className?: string
}) {
  const f = useField<string | undefined>(path)
  const groups = [...new Set(options.map((o) => o.group ?? ''))]
  const renderOpts = (xs: readonly Option[]) => xs.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
  return (
    <FieldFrame label={label} hint={hint} error={f.error} changed={f.changed} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          data-path={f.key}
          value={f.value ?? ''}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => f.set(e.target.value === '' && empty !== undefined ? undefined : e.target.value)}
          className={cx(controlClasses, 'pr-8')}
        >
          {empty !== undefined ? <option value="">{empty}</option> : null}
          {groups.length > 1
            ? groups.map((g) => <optgroup key={g} label={g || 'Other'}>{renderOpts(options.filter((o) => (o.group ?? '') === g))}</optgroup>)
            : renderOpts(options)}
        </select>
      )}
    </FieldFrame>
  )
}

/** Switch with an optional description line. Unset optional booleans read as `false`. */
export function ToggleField({ path, label, hint, className, removeWhenOff }: {
  path: Path
  label: string
  hint?: ReactNode
  className?: string
  /** Store `false` as "key absent" (e.g. `stamp`). */
  removeWhenOff?: boolean
}) {
  const f = useField<boolean | undefined>(path)
  const on = Boolean(f.value)
  return (
    <div className={cx('flex flex-col gap-[2px]', className)}>
      <label className="inline-flex items-center gap-3 min-h-tap cursor-pointer select-none self-start">
        <input
          type="checkbox"
          role="switch"
          data-path={f.key}
          className="peer sr-only"
          checked={on}
          onChange={(e) => f.set(e.target.checked ? true : removeWhenOff ? undefined : false)}
        />
        <span
          aria-hidden="true"
          className="relative inline-block h-6 w-11 flex-none border border-rule rounded-pill bg-bg-2 motion-safe:transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:top-[3px] after:left-[3px] after:size-4 after:rounded-pill after:bg-ink motion-safe:after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-on-accent"
        />
        <span className="text-0 font-semibold">{label}</span>
        <span className="mono text-ink-3" aria-hidden="true">{on ? 'on' : 'off'}</span>
        {f.changed ? <span aria-hidden="true" className="inline-block size-[6px] rounded-pill bg-accent-2" /> : null}
      </label>
      {hint ? <p className="m-0 text-00 text-ink-3 pl-14 leading-[1.5]">{hint}</p> : null}
    </div>
  )
}

export function SegmentedField<T extends string>({ path, label, options, className }: {
  path: Path
  label: string
  options: readonly { value: T; label: string }[]
  className?: string
}) {
  const f = useField<T>(path)
  return <Segmented label={label} options={options} value={f.value} onChange={(v) => f.set(v)} className={className} />
}
