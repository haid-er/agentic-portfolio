'use client'
/** One tool on the MCP server: enable, edit its description + JSON schema, or call it directly. */
import { useEffect, useState } from 'react'
import { Badge, Button, Textarea, Toggle } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'
import { checkSchema, type ToolConfig } from './mcp'
import type { ToolSpec } from './tools'

export interface TryState { busy: boolean; text?: string; isError?: boolean }

export function ToolCard({ spec, config, onChange, onTry, tryState, disabled }: {
  spec: ToolSpec
  config: ToolConfig
  onChange: (c: ToolConfig) => void
  onTry: () => void
  tryState?: TryState
  disabled: boolean
}) {
  const pretty = JSON.stringify(config.inputSchema, null, 2)
  const [draft, setDraft] = useState(pretty)
  const [error, setError] = useState<string | undefined>()
  useEffect(() => { setDraft(pretty); setError(undefined) }, [pretty])
  // Description edits stay local until blur, so one edit sends one list_changed notification.
  const [desc, setDesc] = useState(config.description)
  useEffect(() => { setDesc(config.description) }, [config.description])
  const commitDesc = () => { if (desc !== config.description) onChange({ ...config, description: desc }) }

  const edited = config.description !== spec.description || JSON.stringify(config.inputSchema) !== JSON.stringify(spec.inputSchema)
  const dirty = draft !== pretty

  const apply = () => {
    const r = checkSchema(draft)
    if (!r.ok) { setError(r.error); return }
    setError(undefined)
    onChange({ ...config, inputSchema: r.schema })
  }

  return (
    <li className={cx('grid gap-3 p-3 border rounded-1 bg-bg-2 min-w-0', config.enabled ? 'border-rule strata:border-rule-soft' : 'border-dashed border-rule-soft opacity-80')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Toggle label={spec.title} checked={config.enabled} onChange={(enabled) => onChange({ ...config, enabled })} disabled={disabled} />
        <span className="flex flex-wrap gap-1">
          {edited ? <Badge tone="accent">edited</Badge> : null}
          <Badge tone={spec.network ? 'warn' : 'ok'}>{spec.network ? 'network' : 'local'}</Badge>
        </span>
      </div>
      <p className="m-0 font-mono text-00 text-accent-ink [overflow-wrap:anywhere]">{spec.name}</p>

      <Textarea
        label="Description (the model reads this)"
        rows={3}
        value={desc}
        maxLength={600}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={commitDesc}
        disabled={disabled}
        className="text-0"
      />

      <details className="group">
        <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 mono text-ink-2 [&::-webkit-details-marker]:hidden">
          <Icon name="plus" size={14} className="transition-transform group-open:rotate-45 motion-reduce:transition-none" />
          Input schema (JSON Schema)
        </summary>
        <div className="grid gap-2 pt-1">
          <Textarea
            label="inputSchema"
            hideLabel
            rows={9}
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            error={error}
            hint="The server still validates arguments with its own zod schema, so a mismatch comes back as an isError result."
            className="font-mono text-00 leading-[1.45]"
            disabled={disabled}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon="check" onClick={apply} disabled={!dirty || disabled}>Apply schema</Button>
            <Button size="sm" variant="ghost" icon="refresh" disabled={!edited || disabled} onClick={() => onChange({ ...config, description: spec.description, inputSchema: spec.inputSchema })}>Reset tool</Button>
          </div>
        </div>
      </details>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon="play" onClick={onTry} disabled={!config.enabled || disabled || tryState?.busy}>
            {tryState?.busy ? 'Calling…' : 'Call directly'}
          </Button>
          <code className="font-mono text-00 text-ink-3 [overflow-wrap:anywhere]">{JSON.stringify(spec.example)}</code>
        </div>
        {tryState?.text ? (
          <pre className={cx('m-0 max-h-40 overflow-auto whitespace-pre-wrap p-2 font-mono text-00 border rounded-0 bg-surface', tryState.isError ? 'border-danger text-danger' : 'border-rule-soft text-ink-2')}>
            {tryState.text}
          </pre>
        ) : null}
      </div>
    </li>
  )
}
