'use client'
/** SQL textarea: mono, Tab indents (Esc then Tab leaves), Ctrl/Cmd+Enter runs. */
import { useId, useRef, type KeyboardEvent } from 'react'

export function SqlEditor({ value, onChange, onRun, label, rows = 8 }: {
  value: string
  onChange: (v: string) => void
  onRun: () => void
  label: string
  rows?: number
}) {
  const id = useId()
  const escaped = useRef(false)

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); return }
    if (e.key === 'Escape') { escaped.current = true; return }
    if (e.key === 'Tab' && !e.shiftKey && !escaped.current) {
      e.preventDefault()
      const el = e.currentTarget
      const { selectionStart: s, selectionEnd: t } = el
      let ok = false
      try { ok = document.execCommand('insertText', false, '  ') } catch { ok = false }
      if (!ok) {
        onChange(el.value.slice(0, s) + '  ' + el.value.slice(t))
        requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2 })
      }
      return
    }
    escaped.current = false
  }

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="mono text-ink-2">{label}</label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-describedby={`${id}-hint`}
        className="w-full min-h-[9rem] resize-y p-3 bg-surface text-ink border border-rule rounded-0 font-mono text-00 leading-[1.6] [tab-size:2]"
      />
      <p id={`${id}-hint`} className="m-0 text-00 text-ink-3">Ctrl/⌘ + Enter runs. Tab indents; Esc, then Tab, leaves the editor.</p>
    </div>
  )
}
