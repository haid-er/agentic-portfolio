'use client'
/**
 * Short string lists (stack, keywords, interests) as removable chips.
 * Enter or comma adds; pasting "a, b, c" adds all; Backspace on an empty
 * input takes the last chip back into the input for editing.
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { useField } from '../EditorContext'
import type { Path } from '../lib/path'
import { FieldFrame } from './Frame'

export function TagsField({ path, label, hint, placeholder = 'Type and press Enter', optional, suggestions, className }: {
  path: Path
  label: string
  hint?: ReactNode
  placeholder?: string
  /** Empty list removes the key (optional arrays). */
  optional?: boolean
  /** Autocomplete values (datalist). */
  suggestions?: readonly string[]
  className?: string
}) {
  const f = useField<string[] | undefined>(path)
  const tags = f.value ?? []
  const [draft, setDraft] = useState('')
  const listId = `${f.key}-suggest`

  const commit = (next: string[]) => f.set(optional && next.length === 0 ? undefined : next)
  const addMany = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    const fresh = parts.filter((p, i) => !tags.includes(p) && parts.indexOf(p) === i)
    if (fresh.length) commit([...tags, ...fresh])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault()
      addMany(draft)
    } else if (e.key === 'Enter') {
      e.preventDefault()
    } else if (e.key === 'Backspace' && draft === '' && tags.length) {
      e.preventDefault()
      setDraft(tags[tags.length - 1]!)
      commit(tags.slice(0, -1))
    }
  }

  return (
    <FieldFrame label={label} hint={hint ?? 'Enter or comma adds; Backspace edits the last one.'} error={f.error} changed={f.changed} className={className}
      aside={tags.length ? `${tags.length}` : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <div className={cx(controlClasses, 'flex flex-wrap items-center gap-1 h-auto py-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus')}>
          {tags.map((t, i) => (
            <span key={`${t}-${i}`} className="inline-flex items-center gap-1 max-w-full pl-2 bg-bg-2 border border-rule rounded-pill text-0">
              <span className="[overflow-wrap:anywhere]">{t}</span>
              <button
                type="button"
                onClick={() => commit(tags.filter((_, j) => j !== i))}
                aria-label={`Remove ${t}`}
                className="grid place-items-center size-[32px] text-ink-3 hover:text-danger"
              >
                <X aria-hidden="true" size={14} strokeWidth={1.5} />
              </button>
            </span>
          ))}
          <input
            id={id}
            data-path={f.key}
            value={draft}
            list={suggestions ? listId : undefined}
            placeholder={tags.length ? '' : placeholder}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={() => draft.trim() && addMany(draft)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (/[,\n]/.test(text)) { e.preventDefault(); addMany(text) }
            }}
            className="flex-1 min-w-[8rem] min-h-[36px] bg-transparent border-0 outline-none p-1 placeholder:font-mono placeholder:text-0 placeholder:text-ink-3"
          />
          {suggestions ? (
            <datalist id={listId}>{suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
          ) : null}
        </div>
      )}
    </FieldFrame>
  )
}
