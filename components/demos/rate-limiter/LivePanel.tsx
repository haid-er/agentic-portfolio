'use client'
/** Calls the real edge endpoint and shows each 200 / 429 with its RateLimit headers. */
import { useEffect, useState } from 'react'
import { Badge, Button, ErrorState, Segmented, Table, TableWrap, Td, Th, useToast } from '@/components/ui'
import { cx } from '@/lib/utils'

type LiveAlgo = 'token-bucket' | 'sliding-window'

interface Row {
  n: number
  status: number
  remaining: string
  reset: string
  retryAfter: string
  ms: number
  isolate: string
  headers: [string, string][]
  at: number
}

const HEADER_NAMES = ['ratelimit-policy', 'ratelimit', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'retry-after', 'x-ratelimit-algorithm', 'x-edge-isolate', 'cache-control']

export function LivePanel() {
  const toast = useToast()
  const [algo, setAlgo] = useState<LiveAlgo>('token-bucket')
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [origin, setOrigin] = useState('')

  useEffect(() => { setOrigin(window.location.origin) }, [])

  const last = rows[0]
  const is429 = last?.status === 429
  const retryUntil = last && is429 ? last.at + Number(last.retryAfter || 0) * 1000 : 0
  const waiting = Math.max(0, Math.ceil((retryUntil - nowTs) / 1000))

  useEffect(() => {
    if (!retryUntil) return
    const id = window.setInterval(() => setNowTs(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [retryUntil])

  const fire = async (count: number) => {
    setBusy(true)
    setError(null)
    try {
      for (let i = 0; i < count; i++) {
        const t0 = performance.now()
        const res = await fetch(`/api/demos/limited?algo=${algo}`, { cache: 'no-store' })
        const ms = Math.round(performance.now() - t0)
        if (res.status !== 200 && res.status !== 429) throw new Error(`the endpoint answered ${res.status}`)
        const headers = HEADER_NAMES.flatMap((h) => { const v = res.headers.get(h); return v ? [[h, v] as [string, string]] : [] })
        const get = (h: string) => res.headers.get(h) ?? ''
        await res.text()
        const row: Row = { n: 0, status: res.status, remaining: get('ratelimit-remaining'), reset: get('ratelimit-reset'), retryAfter: get('retry-after'), ms, isolate: get('x-edge-isolate'), headers, at: Date.now() }
        setRows((r) => [{ ...row, n: (r[0]?.n ?? 0) + 1 }, ...r].slice(0, 40))
        setNowTs(Date.now())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
    } finally {
      setBusy(false)
    }
  }

  const curl = `curl -i "${origin || 'https://<this-site>'}/api/demos/limited?algo=${algo}"`
  const copy = async () => {
    try { await navigator.clipboard.writeText(curl); toast('curl command copied.', { tone: 'ok' }) } catch { toast('Could not copy: the clipboard is blocked.', { tone: 'danger' }) }
  }
  const isolates = new Set(rows.map((r) => r.isolate).filter(Boolean))

  return (
    <div className="grid gap-4 min-w-0">
      <p className="m-0 text-0 text-ink-2 measure">
        A real edge function, limited to 5 requests per 10 seconds per IP. Fire a burst and watch the sixth request come back 429 with Retry-After.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Segmented<LiveAlgo> label="Server algorithm" value={algo} onChange={(a) => { setAlgo(a); setRows([]) }} options={[{ value: 'token-bucket', label: 'Token bucket' }, { value: 'sliding-window', label: 'Sliding window' }]} />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon="play" disabled={busy} onClick={() => void fire(1)}>Send 1</Button>
          <Button variant="secondary" icon="plus" disabled={busy} onClick={() => void fire(8)}>Burst 8</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <code className="flex-1 min-w-0 px-3 py-2 bg-bg-2 rounded-0 font-mono text-00 [overflow-wrap:anywhere]">{curl}</code>
        <Button size="sm" variant="ghost" icon="copy" onClick={() => void copy()}>Copy</Button>
      </div>

      {error ? (
        <ErrorState title="The edge endpoint could not be reached" action={<Button size="sm" variant="secondary" icon="refresh" onClick={() => void fire(1)}>Try again</Button>}>
          <p className="m-0">Request failed: {error}. Nothing is estimated; the simulation above still runs offline.</p>
        </ErrorState>
      ) : null}

      {/* Only the status and the one-off "retry now" are announced; the ticking countdown sits outside the live region. */}
      <div className="min-h-6 flex flex-wrap items-center gap-2 font-mono text-0">
        <p aria-live="polite" className="m-0 flex flex-wrap items-center gap-2">
          {last ? <span className="sr-only">{`Request ${last.n}:`}</span> : null}
          {last ? <Badge tone={is429 ? 'danger' : 'ok'}>{is429 ? '429 Too Many Requests' : '200 OK'}</Badge> : null}
          {last && !is429 ? <span className="text-ink-2 nums">{last.remaining} left</span> : null}
          {last && is429 && waiting === 0 ? <span className="text-ink-2">you can retry now</span> : null}
        </p>
        {last && is429 && waiting > 0 ? <span aria-live="off" className="text-ink-2 nums">retry in {waiting}s</span> : null}
        {last && isolates.size > 1 ? <span className="text-00 text-ink-3">{isolates.size} edge isolates answered; each keeps its own counter</span> : null}
      </div>

      {rows.length ? (
        <>
          <ol className="m-0 p-0 list-none flex flex-wrap gap-1" aria-label="Response strip, oldest first">
            {[...rows].reverse().map((r) => (
              <li key={r.n} className={cx('size-7 inline-flex items-center justify-center rounded-0 font-mono text-00 border', r.status === 429 ? 'border-danger text-danger' : 'border-ok bg-ok text-bg')} title={`#${r.n}: ${r.status}`}>
                {r.status === 429 ? '×' : r.n}
                <span className="sr-only">{`request ${r.n}: ${r.status}`}</span>
              </li>
            ))}
          </ol>
          <TableWrap label="Responses from the edge endpoint">
            <Table>
              <thead>
                <tr><Th>#</Th><Th>Status</Th><Th>Remaining</Th><Th>Reset</Th><Th>Retry-After</Th><Th>Latency</Th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 12).map((r) => (
                  <tr key={r.n}>
                    <Td className="font-mono text-00">{r.n}</Td>
                    <Td><Badge tone={r.status === 429 ? 'danger' : 'ok'}>{r.status}</Badge></Td>
                    <Td className="font-mono text-00">{r.remaining}</Td>
                    <Td className="font-mono text-00">{r.reset ? `${r.reset}s` : ''}</Td>
                    <Td className="font-mono text-00">{r.retryAfter ? `${r.retryAfter}s` : ''}</Td>
                    <Td className="font-mono text-00">{r.ms} ms</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          {last ? (
            <details>
              <summary className="min-h-tap flex items-center cursor-pointer mono text-ink-2">Latest response headers</summary>
              <pre className="m-0 p-3 bg-bg-2 rounded-0 font-mono text-00 leading-relaxed overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere]">
                {`HTTP/1.1 ${last.status}\n${last.headers.map(([k, v]) => `${k}: ${v}`).join('\n')}`}
              </pre>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
