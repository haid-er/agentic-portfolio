'use client'
/** The wire log: every JSON-RPC message between host and server, plus host <-> model turns. */
import { useState } from 'react'
import { Button, EmptyState, Segmented, useToast } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { LogEntry, Party } from './mcp'

type Filter = 'all' | 'mcp' | 'model'

const NAMES: Record<Party, string> = { host: 'Host', server: 'Server', model: 'Model', router: 'Router' }

const KIND_CLASS: Record<LogEntry['kind'], string> = {
  request: 'border-data-1 text-ink',
  response: 'border-data-4 text-ink-2',
  notification: 'border-data-3 text-ink-2',
  error: 'border-danger text-danger',
}

const isMcp = (e: LogEntry) => e.from === 'server' || e.to === 'server'

export function LogView({ entries, onClear }: { entries: LogEntry[]; onClear: () => void }) {
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const shown = entries.filter((e) => filter === 'all' || (filter === 'mcp' ? isMcp(e) : !isMcp(e)))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entries.map(({ seq, t, from, to, kind, method, payload }) => ({ seq, t, from, to, kind, method, payload })), null, 2))
      toast('Log copied as JSON.', { tone: 'ok' })
    } catch {
      toast('Could not copy (clipboard blocked).', { tone: 'danger' })
    }
  }

  return (
    <div className="grid gap-3 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Segmented<Filter>
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All' }, { value: 'mcp', label: 'MCP wire' }, { value: 'model', label: 'Model' }]}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" icon="copy" onClick={() => void copy()} disabled={!entries.length}>Copy JSON</Button>
          <Button size="sm" variant="ghost" icon="close" onClick={onClear} disabled={!entries.length}>Clear</Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No messages yet">Run a prompt or call a tool directly. The handshake (initialize, tools/list) is logged first.</EmptyState>
      ) : (
        <ol className="m-0 p-0 list-none grid gap-1 min-w-0" aria-label="Protocol log">
          {shown.map((e) => (
            <li key={e.seq} className="min-w-0">
              <details className={cx('group border-l-4 bg-bg-2 rounded-0', KIND_CLASS[e.kind])}>
                <summary className="grid min-h-tap cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-[2px] px-3 py-2 [&::-webkit-details-marker]:hidden">
                  <span className="nums font-mono text-00 text-ink-3 row-span-2 self-start pt-[2px]">+{(e.t / 1000).toFixed(2)}s</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 font-mono text-00 uppercase tracking-[.06em]">
                    <span className="text-ink-2">{NAMES[e.from]}</span>
                    <span aria-hidden="true" className="text-accent-ink">→</span>
                    <span className="sr-only">to</span>
                    <span className="text-ink-2">{NAMES[e.to]}</span>
                    <span className="text-ink normal-case tracking-normal">{e.method}</span>
                    {e.rpcId != null ? <span className="text-ink-3">#{e.rpcId}</span> : null}
                    {e.kind === 'error' ? <span className="text-danger">error</span> : null}
                    {e.ms != null ? <span className="nums text-ink-3">{e.ms} ms</span> : null}
                  </span>
                  <span className="text-0 text-ink-2 truncate">{e.summary}</span>
                </summary>
                <pre className="m-0 max-h-72 overflow-auto border-t border-rule-soft p-3 font-mono text-00 leading-[1.5] text-ink whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
