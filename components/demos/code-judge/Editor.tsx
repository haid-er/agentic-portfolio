'use client'
/**
 * A small code editor: a textarea with a line-number gutter. Tab indents (two spaces);
 * press Esc first to let Tab move focus instead. Ctrl/Cmd+Enter submits.
 */
import { useId, useRef, type KeyboardEvent } from 'react'

export function Editor({ value, onChange, onSubmit, label }: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  label: string
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const area = useRef<HTMLTextAreaElement | null>(null)
  const gutter = useRef<HTMLDivElement | null>(null)
  const tabEscapes = useRef(false)
  const lines = value.split('\n').length

  const replaceSelection = (el: HTMLTextAreaElement, text: string, selStart: number, selEnd: number, caret: number) => {
    // execCommand keeps the browser's undo stack; fall back to a controlled update.
    el.setSelectionRange(selStart, selEnd)
    let done = false
    try { done = document.execCommand(text ? 'insertText' : 'delete', false, text) } catch { done = false }
    if (done) { el.selectionStart = el.selectionEnd = caret; return }
    const next = el.value.slice(0, selStart) + text + el.value.slice(selEnd)
    onChange(next)
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = caret })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onSubmit(); return }
    if (e.key === 'Escape') { tabEscapes.current = true; return }
    if (e.key === 'Tab' && !tabEscapes.current) {
      e.preventDefault()
      const { selectionStart: s, selectionEnd: t, value: v } = el
      if (e.shiftKey) {
        const lineStart = v.lastIndexOf('\n', s - 1) + 1
        if (v.slice(lineStart, lineStart + 2) === '  ') replaceSelection(el, '', lineStart, lineStart + 2, Math.max(lineStart, s - 2))
        return
      }
      replaceSelection(el, '  ', s, t, s + 2)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // Keep the current line's indentation, plus one level after an opening brace.
      const { selectionStart: s, selectionEnd: t, value: v } = el
      const lineStart = v.lastIndexOf('\n', s - 1) + 1
      const indent = /^[ \t]*/.exec(v.slice(lineStart, s))?.[0] ?? ''
      const extra = /[{[(]\s*$/.test(v.slice(lineStart, s)) ? '  ' : ''
      e.preventDefault()
      replaceSelection(el, `\n${indent}${extra}`, s, t, s + 1 + indent.length + extra.length)
      return
    }
    tabEscapes.current = false
  }

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="mono text-ink-2">{label}</label>
      <div className="relative flex border border-rule rounded-0 bg-surface min-w-0 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <div
          ref={gutter}
          aria-hidden="true"
          className="select-none overflow-hidden py-3 pl-2 pr-2 text-right font-mono text-00 leading-[1.6] text-ink-3 bg-bg-2 border-r border-rule-soft nums"
        >
          {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <textarea
          id={id}
          ref={area}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop }}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-describedby={hintId}
          rows={16}
          wrap="off"
          className="flex-1 min-w-0 resize-y py-3 px-3 bg-transparent text-ink font-mono text-00 leading-[1.6] outline-none [tab-size:2] min-h-[16rem]"
        />
      </div>
      <p id={hintId} className="m-0 text-00 text-ink-3">
        Tab indents. Press Esc, then Tab, to leave the editor. Ctrl/⌘ + Enter submits.
      </p>
    </div>
  )
}
