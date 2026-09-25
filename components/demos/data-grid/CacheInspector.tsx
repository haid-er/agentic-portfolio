'use client'
import { Badge, Button, EmptyState, type Tone } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { LogEntry, LogKind, QueryClient, QueryState } from './queryClient'

function freshness(client: QueryClient, s: QueryState, now: number) {
  const { staleTime } = client.opts
  if (s.status !== 'success' || s.dataUpdatedAt === 0 || staleTime === 0) return { ratio: 0, left: 0 }
  const left = Math.max(0, staleTime - (now - s.dataUpdatedAt))
  return { ratio: left / staleTime, left }
}

function badgesFor(client: QueryClient, s: QueryState, now: number): Array<{ text: string; tone: Tone }> {
  const out: Array<{ text: string; tone: Tone }> = []
  if (s.fetching) out.push({ text: 'fetching', tone: 'accent' })
  if (s.status === 'error') out.push({ text: 'error', tone: 'danger' })
  else if (s.status === 'pending') out.push({ text: 'pending', tone: 'neutral' })
  else out.push(client.isStale(s, now) ? { text: 'stale', tone: 'warn' } : { text: 'fresh', tone: 'ok' })
  if (s.error && s.status === 'success') out.push({ text: 'last fetch failed', tone: 'danger' })
  out.push(s.observers > 0 ? { text: `${s.observers} observer${s.observers > 1 ? 's' : ''}`, tone: 'neutral' } : { text: 'inactive', tone: 'neutral' })
  return out
}

const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`

export function CacheInspector({ client, entries, now, onRefetch, onRemove }: {
  client: QueryClient
  entries: QueryState[]
  now: number
  onRefetch: (key: string) => void
  onRemove: (key: string) => void
}) {
  if (!entries.length) {
    return <EmptyState title="Cache is empty">Entries appear here as soon as a page is requested.</EmptyState>
  }
  return (
    <ul className="grid gap-3 m-0 p-0 list-none">
      {entries.map((s) => {
        const f = freshness(client, s, now)
        const gcLeft = s.inactiveSince !== null ? Math.max(0, s.inactiveSince + client.opts.gcTime - now) : null
        return (
          <li key={s.key} className="border border-rule rounded-1 p-3 grid gap-2 bg-surface strata:border-rule-soft">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <code className="mono text-ink">{s.label}</code>
              <span className="mono text-ink-3">fetches {s.fetchCount}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {badgesFor(client, s, now).map((b) => <Badge key={b.text} tone={b.tone}>{b.text}</Badge>)}
            </div>
            <div className="grid gap-1">
              <div className="h-[6px] bg-bg-2 rounded-pill overflow-hidden" aria-hidden="true">
                <div className="h-full bg-data-1 origin-left" style={{ transform: `scaleX(${f.ratio})` }} />
              </div>
              <p className="m-0 mono text-ink-3 flex flex-wrap justify-between gap-2">
                <span>{s.status !== 'success' ? 'no data yet' : f.left > 0 ? `stale in ${secs(f.left)}` : 'stale now'}</span>
                {gcLeft !== null ? <span>gc in {secs(gcLeft)}</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon="refresh" onClick={() => onRefetch(s.key)} disabled={s.fetching}>Refetch</Button>
              <Button size="sm" variant="ghost" icon="close" onClick={() => onRemove(s.key)}>Remove</Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const KIND_TONE: Partial<Record<LogKind, string>> = {
  error: 'text-danger', rollback: 'text-danger', retry: 'text-warn',
  success: 'text-ok', confirm: 'text-ok', hit: 'text-ok',
  optimistic: 'text-accent-ink', focus: 'text-accent-ink',
}

export function EventLog({ log }: { log: LogEntry[] }) {
  if (!log.length) return <p className="m-0 text-0 text-ink-3">No events yet.</p>
  return (
    <ol className="m-0 p-0 list-none grid gap-2 max-h-[340px] overflow-y-auto pr-1" aria-label="Cache events, newest first">
      {log.map((e) => (
        <li key={e.id} className="grid grid-cols-[auto_1fr] gap-x-3 text-0">
          <span className="mono text-ink-3 nums">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span>
          <span className="min-w-0">
            <span className={cx('mono mr-2', KIND_TONE[e.kind] ?? 'text-ink-2')}>{e.kind}</span>
            <span className="mono text-ink-3 mr-2">{e.label}</span>
            <span className="text-ink-2 [overflow-wrap:anywhere]">{e.text}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
