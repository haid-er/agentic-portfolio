'use client'
/**
 * Inline-marks field: the site renders `*word*` as <em> (italic green in the
 * Almanac, upright accent in Strata). The preview below uses the same rule,
 * so what you see is exactly what the public page prints.
 */
import type { ReactNode } from 'react'
import { controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { useField } from '../EditorContext'
import type { Path } from '../lib/path'
import { FieldFrame } from './Frame'

export function Emphasis({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, i) =>
        part.length > 2 && part.startsWith('*') && part.endsWith('*')
          ? <em key={i} className="almanac:italic strata:not-italic text-accent">{part.slice(1, -1)}</em>
          : <span key={i}>{part}</span>,
      )}
    </>
  )
}

export function MarkdownField({ path, label, hint, rows = 2, display, className }: {
  path: Path
  label: string
  hint?: ReactNode
  rows?: number
  /** Preview in display type (headings, role lines). */
  display?: boolean
  className?: string
}) {
  const f = useField<string>(path)
  const value = f.value ?? ''
  const unbalanced = (value.match(/\*/g)?.length ?? 0) % 2 === 1
  const insert = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    if (a === b) return
    f.set(`${value.slice(0, a)}*${value.slice(a, b)}*${value.slice(b)}`)
  }
  return (
    <FieldFrame
      label={label}
      error={f.error}
      changed={f.changed}
      className={className}
      hint={<>{hint ? <>{hint} </> : null}Wrap words in <code className="font-mono">*asterisks*</code> to set them in the accent italic. Select text and press <kbd className="font-mono">Ctrl+I</kbd>.</>}
    >
      {({ id, describedBy, invalid }) => (
        <div className="grid gap-2">
          <textarea
            id={id}
            data-path={f.key}
            rows={rows}
            value={value}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={(e) => f.set(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); insert(e.currentTarget) }
            }}
            className={cx(controlClasses, 'leading-[1.5] resize-y')}
          />
          <Preview display={display} warn={unbalanced ? 'An asterisk is unpaired; it prints as a literal *.' : undefined}>
            {value ? <Emphasis text={value} /> : <span className="text-ink-3">Nothing to preview</span>}
          </Preview>
        </div>
      )}
    </FieldFrame>
  )
}

function Preview({ children, display, warn }: { children: ReactNode; display?: boolean; warn?: string }) {
  return (
    <div className="border border-dashed border-rule rounded-1 bg-bg px-s3 py-s2 grid gap-1" aria-live="polite">
      <span className="mono text-ink-3">Preview</span>
      <p className={cx('m-0 [overflow-wrap:anywhere]', display ? 'display text-3' : 'text-1')}>{children}</p>
      {warn ? <p className="m-0 text-00 text-warn">{warn}</p> : null}
    </div>
  )
}
