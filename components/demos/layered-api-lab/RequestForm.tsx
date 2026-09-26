'use client'
/** Method + path + JSON body, with preset chips. Enter in the path field sends. */
import { type FormEvent } from 'react'
import { Button, Select, Textarea, Input } from '@/components/ui'
import { cx } from '@/lib/utils'
import { PRESETS, type Method, type Preset } from './presets'

const METHODS: readonly Method[] = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']

export interface Draft { method: Method; path: string; body: string }

export function RequestForm({ draft, onChange, onSend, onPreset, activePreset, busy }: {
  draft: Draft
  onChange: (d: Draft) => void
  onSend: () => void
  onPreset: (p: Preset) => void
  activePreset: string | null
  busy: boolean
}) {
  const hasBody = draft.method !== 'GET' && draft.method !== 'DELETE'
  const pathError = draft.path.startsWith('/') ? undefined : 'Paths start with /'
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!pathError) onSend()
  }
  return (
    <div className="grid gap-4 min-w-0">
      <div className="grid gap-1">
        <p className="m-0 mono text-ink-2" id="lab-presets">Presets</p>
        <ul className="m-0 p-0 list-none flex flex-wrap gap-2" aria-labelledby="lab-presets">
          {PRESETS.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPreset(p)}
                aria-pressed={activePreset === p.id}
                className={cx(
                  'min-h-tap px-3 py-1 border rounded-pill font-mono text-00 uppercase tracking-[.06em] text-left',
                  activePreset === p.id ? 'bg-ink text-bg border-ink' : 'bg-surface text-ink border-rule hover:bg-bg-2',
                )}
              >
                <span className={cx('mr-1', activePreset === p.id ? 'text-bg' : 'text-ink-3')}>{p.method}</span>{p.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={submit} className="grid gap-3 min-w-0" aria-label="Request">
        <div className="grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] gap-2 items-start">
          <Select label="Method" value={draft.method} onChange={(e) => onChange({ ...draft, method: e.target.value as Method })}>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Input
            label="Path (after /api/demos/lab)"
            value={draft.path}
            error={pathError}
            maxLength={200}
            spellCheck={false}
            autoCapitalize="off"
            className="font-mono text-0"
            onChange={(e) => onChange({ ...draft, path: e.target.value })}
          />
        </div>
        {hasBody ? (
          <Textarea
            label="JSON body"
            hint="Max 4 KB. Send broken JSON on purpose to see the body parser fail."
            rows={6}
            value={draft.body}
            maxLength={4096}
            spellCheck={false}
            className="font-mono text-00"
            onChange={(e) => onChange({ ...draft, body: e.target.value })}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" arrow disabled={busy || Boolean(pathError)}>{busy ? 'Sending' : 'Send request'}</Button>
          <code className="font-mono text-00 text-ink-3 [overflow-wrap:anywhere]">{draft.method} /api/demos/lab{draft.path}</code>
        </div>
      </form>
    </div>
  )
}
