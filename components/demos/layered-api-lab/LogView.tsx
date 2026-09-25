'use client'
/** Winston-style JSON log lines for the selected request, filterable by level. */
import { useState } from 'react'
import { Button, EmptyState, Segmented, useToast } from '@/components/ui'
import { cx } from '@/lib/utils'
import { formatLogLine } from './api/logger'
import type { LogLevel, LogLine } from './api/types'

type Filter = 'debug' | 'info' | 'warn'
const RANK: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, http: 3, debug: 4 }
const MAX: Record<Filter, number> = { warn: 1, info: 3, debug: 4 }

const LEVEL_CLASS: Record<LogLevel, string> = {
  error: 'border-danger text-danger',
  warn: 'border-warn text-warn',
  info: 'border-data-1 text-ink',
  http: 'border-data-4 text-ink-2',
  debug: 'border-rule-soft text-ink-3',
}

export function LogView({ logs }: { logs: LogLine[] }) {
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('debug')
  const shown = logs.filter((l) => RANK[l.level] <= MAX[filter])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(logs.map(formatLogLine).join('\n'))
      toast('Log lines copied (NDJSON).', { tone: 'ok' })
    } catch {
      toast('Could not copy: the clipboard is blocked.', { tone: 'danger' })
    }
  }

  return (
    <div className="grid gap-3 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Segmented<Filter> label="Level" value={filter} onChange={setFilter} options={[{ value: 'debug', label: 'debug+' }, { value: 'info', label: 'info+' }, { value: 'warn', label: 'warn+' }]} />
        <Button size="sm" variant="ghost" icon="copy" onClick={() => void copy()} disabled={!logs.length}>Copy</Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No log lines at this level">Lower the level, or send a request.</EmptyState>
      ) : (
        <ol className="m-0 p-0 list-none grid gap-1 min-w-0" aria-label="Log lines">
          {shown.map((l, i) => (
            <li key={i} className={cx('min-w-0 px-3 py-2 border-l-4 bg-bg-2 font-mono text-00 leading-relaxed', LEVEL_CLASS[l.level])}>
              <span className="uppercase font-semibold tracking-[.06em]">{l.level}</span>{' '}
              <span className="text-ink-3">[{l.layer}]</span>{' '}
              <span className="text-ink">{l.message}</span>
              <code className="block text-ink-3 [overflow-wrap:anywhere] whitespace-pre-wrap">{formatLogLine(l)}</code>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
