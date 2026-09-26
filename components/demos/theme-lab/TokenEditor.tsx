'use client'
/** Colour token fields: a native picker plus a hex field, grouped like DESIGN.md 2. */
import { useEffect, useState } from 'react'
import type { ColorToken } from '@/lib/theme'
import { cx } from '@/lib/utils'
import { normalize } from './color'
import { GROUPS, type Edits, type Palette } from './tokens'

function TokenField({ name, label, value, edited, onChange }: {
  name: ColorToken
  label: string
  value: string
  edited: boolean
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const hex = normalize(value) ?? '#000000'
  const invalid = normalize(draft) === null
  const id = `tl-${name.slice(2)}`
  return (
    <div className="grid gap-1 min-w-0">
      <label htmlFor={id} className="mono text-ink-2 flex items-center gap-2">
        <span>{label}</span>
        {edited ? <span className="text-accent-ink">· edited</span> : null}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          type="color"
          value={hex.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} (${name}) colour picker`}
          className="h-[44px] w-[44px] shrink-0 cursor-pointer border border-rule bg-surface p-1 rounded-0"
        />
        <input
          id={id}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = normalize(e.target.value)
            if (n) onChange(n)
          }}
          onBlur={() => setDraft(value)}
          className={cx('min-w-0 flex-1 min-h-tap px-3 bg-surface text-ink border border-rule rounded-0 font-mono text-0 uppercase', invalid && 'border-danger')}
        />
      </div>
      <p className="m-0 font-mono text-00 text-ink-3">{name}</p>
      {invalid ? <p id={`${id}-err`} className="m-0 text-00 text-danger">Use #RGB, #RRGGBB or rgb().</p> : null}
    </div>
  )
}

export function TokenEditor({ palette, edits, onChange }: {
  palette: Palette
  edits: Edits
  onChange: (token: ColorToken, value: string) => void
}) {
  return (
    <div className="grid gap-5">
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="m-0 p-0 border-0 grid gap-3 min-w-0">
          <legend className="mono text-ink-3 mb-2">{g.title}</legend>
          <div className="grid gap-4 xs:grid-cols-2">
            {g.tokens.map((t) => (
              <TokenField key={t.name} name={t.name} label={t.label} value={palette[t.name]} edited={t.name in edits} onChange={(v) => onChange(t.name, v)} />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
