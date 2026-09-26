'use client'
/**
 * "Edit as JSON": the escape hatch for anything the form does not cover.
 * Applying replaces the form state (still validated, still needs Save).
 * JSON that passes the schema is applied as is; JSON that does not is applied
 * only if it keeps the shape the form reads (same objects, lists and text
 * fields), so the form can show the problems instead of crashing.
 */
import { useState } from 'react'
import { Button, Icon, useToast } from '@/components/ui'
import { controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { SCHEMAS, type CollectionName } from '@/lib/content/schema'
import { useEditor } from './EditorContext'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** First place where `next` breaks the structure of `current`, or null if it keeps it. */
function shapeBreak(current: unknown, next: unknown, at = ''): string | null {
  if (Array.isArray(current)) return Array.isArray(next) ? null : `${at || 'the top level'} must be a list`
  if (typeof current === 'string') return typeof next === 'string' ? null : `${at} must be text`
  if (!isObject(current)) return null
  if (!isObject(next)) return `${at || 'the top level'} must be an object`
  for (const [k, v] of Object.entries(current)) {
    if (v === undefined || (!isObject(v) && !Array.isArray(v) && typeof v !== 'string')) continue
    const path = at ? `${at}.${k}` : k
    if (!(k in next)) return `${path} is missing`
    const hit = shapeBreak(v, next[k], path)
    if (hit) return hit
  }
  return null
}

export function RawJson({ name }: { name: CollectionName }) {
  const ed = useEditor()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const current = JSON.stringify(ed.data, null, 2)

  const onToggle = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) { setText(current); setError(null) }
  }

  const apply = () => {
    try {
      const next: unknown = JSON.parse(text)
      const res = SCHEMAS[name].safeParse(next)
      const broken = res.success ? null : shapeBreak(ed.data, next)
      if (broken && !res.success) {
        const issues = res.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        setError(`Not applied: ${broken}, which the form needs. ${issues.join(' · ')}`)
        return
      }
      ed.set([], next)
      setError(null)
      toast(res.success ? 'JSON applied to the form. Review, then save.' : 'JSON applied with problems; the form marks them.', { tone: res.success ? 'ok' : 'warn' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not valid JSON')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current)
      toast('Copied the current form as JSON.')
    } catch {
      toast('The clipboard is not available here; select the text and copy it.', { tone: 'warn' })
    }
  }

  return (
    <details
      className="group border border-rule rounded-1 bg-bg-2"
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="min-h-tap px-s4 flex items-center gap-2 cursor-pointer mono text-ink-2 list-none [&::-webkit-details-marker]:hidden">
        <Icon name="doc" size={16} />
        Edit as JSON
        <span className="ml-auto text-ink-3 normal-case tracking-normal font-body text-0 hidden xs:inline">for anything the form does not cover</span>
        <Icon name="plus" size={16} className="group-open:rotate-45 motion-safe:transition-transform" />
      </summary>
      {open ? (
        <div className="grid gap-s3 p-s4 pt-0">
          <label className="sr-only" htmlFor="raw-json">Collection JSON</label>
          <textarea
            id="raw-json"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={16}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'raw-json-err' : undefined}
            className={cx(controlClasses, 'font-mono text-00 leading-[1.5] resize-y')}
          />
          {error ? (
            <p id="raw-json-err" className="m-0 flex items-center gap-1 text-0 text-danger"><Icon name="alert" size={16} />{error}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon="check" onClick={apply} disabled={text === current}>Apply to form</Button>
            <Button size="sm" variant="ghost" icon="refresh" onClick={() => { setText(current); setError(null) }}>Reset to form</Button>
            <Button size="sm" variant="ghost" icon="copy" onClick={copy}>Copy</Button>
          </div>
        </div>
      ) : null}
    </details>
  )
}
