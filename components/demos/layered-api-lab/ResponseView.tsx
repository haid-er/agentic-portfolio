'use client'
/** Status line, headers, body; validation issues are listed field by field. */
import { Badge } from '@/components/ui'
import type { Exchange } from './useLab'

const REASON: Record<number, string> = {
  200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 404: 'Not Found', 405: 'Method Not Allowed',
  409: 'Conflict', 413: 'Payload Too Large', 422: 'Unprocessable Content', 500: 'Internal Server Error',
}

interface Issue { path: string; message: string; code: string }

function issuesOf(body: unknown): Issue[] {
  if (!body || typeof body !== 'object' || !('error' in body)) return []
  const err = (body as { error?: { issues?: unknown } }).error
  return Array.isArray(err?.issues) ? (err.issues as Issue[]) : []
}

export function ResponseView({ ex }: { ex: Exchange }) {
  const tone = ex.status >= 500 ? 'danger' : ex.status >= 400 ? 'warn' : 'ok'
  const issues = issuesOf(ex.body)
  return (
    <div className="grid gap-3 min-w-0">
      <p className="m-0 flex flex-wrap items-center gap-2 font-mono text-0">
        <Badge tone={tone}>{ex.status} {REASON[ex.status] ?? ''}</Badge>
        <span className="text-ink-2 nums">{ex.roundTripMs} ms round trip</span>
        <Badge tone={ex.runtime === 'server' ? 'accent' : 'neutral'}>{ex.runtime === 'server' ? 'served by route' : 'ran in browser'}</Badge>
        {ex.coldStart ? <Badge tone="neutral">fresh session</Badge> : null}
      </p>
      {ex.fallbackReason ? (
        <p className="m-0 text-0 text-ink-2">The server route could not be reached ({ex.fallbackReason}), so the same layered code ran in your browser.</p>
      ) : null}

      {issues.length ? (
        <div className="grid gap-1">
          <p className="m-0 mono text-ink-3">Zod issues</p>
          <ul className="m-0 p-0 list-none grid gap-1">
            {issues.map((i, n) => (
              <li key={`${i.path}-${n}`} className="grid gap-[2px] px-3 py-2 border-l-4 border-warn bg-bg-2">
                <code className="font-mono text-00 text-ink [overflow-wrap:anywhere]">{i.path}</code>
                <span className="text-0 text-ink-2">{i.message} <span className="font-mono text-00 text-ink-3">({i.code})</span></span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="group">
        <summary className="min-h-tap flex items-center cursor-pointer mono text-ink-2">Headers ({ex.headers.length})</summary>
        <dl className="m-0 grid gap-1 font-mono text-00">
          {ex.headers.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-2">
              <dt className="text-ink-3">{k}:</dt>
              <dd className="m-0 text-ink [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="grid gap-1 min-w-0">
        <p className="m-0 mono text-ink-3">Body</p>
        <pre className="m-0 p-3 bg-bg-2 rounded-0 font-mono text-00 leading-relaxed overflow-auto max-h-80 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {ex.body === null ? '(empty: 204 No Content)' : JSON.stringify(ex.body, null, 2)}
        </pre>
      </div>
    </div>
  )
}
