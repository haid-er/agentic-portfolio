/** Network waterfall drawn with plain HTML boxes so it reflows at any width. */
import { cx } from '@/lib/utils'
import { seconds, type Kind, type Result } from './model'

export const KIND: Record<Kind, { tag: string; label: string; bar: string }> = {
  doc: { tag: 'DOC', label: 'Document', bar: 'bg-ink-2' },
  css: { tag: 'CSS', label: 'Stylesheet', bar: 'bg-data-3' },
  js: { tag: 'JS', label: 'Script', bar: 'bg-data-1' },
  font: { tag: 'FNT', label: 'Font', bar: 'bg-ink-3' },
  api: { tag: 'API', label: 'API call', bar: 'bg-data-2' },
  img: { tag: 'IMG', label: 'Image', bar: 'bg-data-4' },
}

const pct = (ms: number, scale: number) => `${Math.min(100, Math.max(0, (ms / scale) * 100))}%`

/** Width of a segment that is revealed up to the playhead. */
function seg(from: number, to: number, head: number, scale: number) {
  const end = Math.min(to, head)
  if (end <= from) return null
  return { left: pct(from, scale), width: pct(end - from, scale) }
}

export function Waterfall({ result, scale, head, baselineReady }: {
  result: Result
  scale: number
  head: number
  baselineReady: number
}) {
  const ticks = tickList(scale)
  const markers = [
    { at: result.fcp, label: 'first paint', cls: 'border-ink-3' },
    { at: result.ready, label: 'ready', cls: 'border-accent' },
  ]
  return (
    <div className="grid gap-1 text-00">
      {/* axis */}
      <div className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-2" aria-hidden="true">
        <span className="mono text-ink-3">Request</span>
        <div className="relative h-5">
          {ticks.map((t) => (
            <span key={t} className="absolute top-0 mono text-ink-3 -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(t, scale) }}>
              {t / 1000}s
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* grid lines, markers and the playhead share one overlay on the track column */}
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[calc(34%+0.5rem)] md:left-[calc(15rem+0.5rem)]" aria-hidden="true">
          {ticks.map((t) => <span key={t} className="absolute inset-y-0 border-l border-rule-soft" style={{ left: pct(t, scale) }} />)}
          {baselineReady > result.ready + 50 ? (
            <span className="absolute inset-y-0 border-l-2 border-dashed border-data-2 opacity-70" style={{ left: pct(baselineReady, scale) }} />
          ) : null}
          {markers.map((m) => (head >= m.at ? (
            <span key={m.label} className={cx('absolute inset-y-0 border-l-2', m.cls)} style={{ left: pct(m.at, scale) }} />
          ) : null))}
          {head < result.loaded ? <span className="absolute inset-y-0 border-l border-ink" style={{ left: pct(head, scale) }} /> : null}
        </div>

        <ol className="m-0 p-0 list-none grid" aria-label="Network requests in start order">
          <MainThread result={result} scale={scale} head={head} />
          {result.reqs.map((r) => {
            const k = KIND[r.kind]
            const queue = seg(r.queuedAt, r.startAt, head, scale)
            const wait = seg(r.startAt, r.firstByte, head, scale)
            const dl = seg(r.firstByte, r.end, head, scale)
            return (
              <li key={r.id}
                className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-2 items-center min-h-[20px]"
                aria-label={`${k.label} ${r.label}, ${r.transferKb} KB, starts ${seconds(r.queuedAt)}, ends ${seconds(r.end)}${r.deferred ? ', deferred until after ready' : ''}`}>
                <span className="flex items-center gap-1 min-w-0">
                  <span className="font-mono text-ink-3 w-7 shrink-0">{k.tag}</span>
                  <span className={cx('truncate font-mono', r.deferred ? 'text-ink-3' : 'text-ink')}>{r.label}</span>
                </span>
                <span className="relative block h-3">
                  {queue ? <span className="absolute inset-y-[5px] bg-rule-soft" style={queue} /> : null}
                  {wait ? <span className={cx('absolute inset-y-[3px] opacity-45', k.bar)} style={wait} /> : null}
                  {dl ? (
                    <span className={cx('absolute inset-y-0', k.bar, r.deferred && 'opacity-55 outline outline-1 outline-dashed outline-ink-3')} style={dl} />
                  ) : null}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <ul className="m-0 mt-2 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 text-ink-2" aria-label="Legend">
        {(Object.keys(KIND) as Kind[]).map((key) => (
          <li key={key} className="flex items-center gap-1">
            <span aria-hidden="true" className={cx('inline-block size-3', KIND[key].bar)} /> {KIND[key].label}
          </li>
        ))}
        <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-4 h-1 bg-rule-soft" /> queued (no free connection)</li>
        <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-4 border-t-2 border-accent" /> ready</li>
        <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-data-2" /> baseline ready</li>
      </ul>
    </div>
  )
}

function MainThread({ result, scale, head }: { result: Result; scale: number; head: number }) {
  return (
    <li className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-2 items-center min-h-[24px] mb-1 border-b border-rule-soft"
      aria-label={`Main thread: ${Math.round(result.mainThreadMs)} ms of JavaScript`}>
      <span className="flex items-center gap-1 min-w-0">
        <span className="font-mono text-ink-3 w-7 shrink-0">CPU</span>
        <span className="truncate font-mono text-ink">main thread</span>
      </span>
      <span className="relative block h-4">
        {result.tasks.map((t) => {
          const s = seg(t.start, t.end, head, scale)
          return s ? (
            <span key={t.id} title={t.label}
              className={cx('absolute inset-y-0 min-w-[2px]', t.id === 'render' ? 'bg-accent' : 'bg-ink bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--surface)_3px_4px)]')}
              style={s} />
          ) : null
        })}
      </span>
    </li>
  )
}

function tickList(scale: number): number[] {
  const step = scale > 20_000 ? 5000 : scale > 8000 ? 2000 : scale > 4000 ? 1000 : 500
  const out: number[] = []
  for (let t = 0; t <= scale; t += step) out.push(t)
  return out
}
