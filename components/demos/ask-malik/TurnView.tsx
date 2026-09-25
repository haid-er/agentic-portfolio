'use client'
/** One question + streamed answer + its numbered sources. */
import Link from 'next/link'
import { Badge, Button } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { BROWSER_MODEL_DOWNLOAD, type AiMeta } from '@/lib/ai'
import { cx } from '@/lib/utils'
import { citedNumbers } from './answer'
import { Rich } from './Rich'
import type { Hit } from './search'

export type Via = 'model' | 'extractive' | 'device'

export interface Turn {
  id: string
  q: string
  hits: Hit[]
  answer: string
  status: 'thinking' | 'streaming' | 'done'
  via: Via
  meta?: AiMeta | null
  /** Honest note: why we fell back, that it was stopped, etc. */
  note?: string
  /** The server is out of quota: offer the on-device model. */
  canDevice?: boolean
  /** 0..1 while the on-device model downloads. */
  deviceProgress?: number | null
}

function metaLine(t: Turn): string {
  if (t.via === 'extractive') return 'Extractive · no model · nothing left your browser'
  const m = t.meta
  if (!m) return t.via === 'device' ? 'On this device' : ''
  const parts = [t.via === 'device' ? 'On this device' : m.provider, m.model, `${(m.latencyMs / 1000).toFixed(1)} s`]
  if (m.usage?.inputTokens) parts.push(`${m.usage.inputTokens} in / ${m.usage.outputTokens} out tokens`)
  return parts.join(' · ')
}

function routeLine(m: AiMeta | null | undefined): string {
  const skipped = m?.route?.filter((r) => r.outcome !== 'ok') ?? []
  if (!m?.route || !skipped.length) return ''
  return m.route.map((r) => `${r.provider} ${r.outcome === 'ok' ? 'ok' : r.reason ?? r.outcome}`).join(' → ')
}

export function TurnView({ turn, active, onCite, onDevice, busy }: {
  turn: Turn
  active: number | null
  onCite: (n: number | null) => void
  onDevice: () => void
  busy: boolean
}) {
  const titles = turn.hits.map((h) => h.chunk.title)
  const cited = citedNumbers(turn.answer, turn.hits.length)
  const prefix = `${turn.id}-src`
  const route = routeLine(turn.meta)
  const live = turn.status !== 'done'

  return (
    <article className="grid gap-3 [animation:fade-in_var(--dur-med)_var(--ease-out)] motion-reduce:[animation:none]" aria-busy={live}>
      <div className="flex justify-end">
        <p className="m-0 max-w-[85%] px-4 py-2 bg-ink text-bg almanac:text-on-accent rounded-2 [overflow-wrap:anywhere]">
          <span className="sr-only">You asked: </span>{turn.q}
        </p>
      </div>

      <div className="grid gap-3 p-4 border border-rule rounded-2 bg-surface strata:border-rule-soft min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="nodes" size={16} className="text-accent-ink" />
          <span className="mono text-ink-2">Answer</span>
          {turn.via === 'extractive' ? <Badge tone="warn">Extractive, no model</Badge> : null}
          {turn.via === 'device' ? <Badge tone="accent">Small on-device model</Badge> : null}
          {live ? <span className="mono text-ink-3" role="status">{turn.status === 'thinking' ? 'Retrieving and asking…' : 'Streaming…'}</span> : null}
        </div>

        {turn.answer ? (
          <div className="text-1 leading-[var(--lh-body)] [overflow-wrap:anywhere]">
            <Rich text={turn.answer} max={turn.hits.length} idPrefix={prefix} titles={titles} onCite={onCite} />
            {turn.status === 'streaming' ? <span aria-hidden="true" className="inline-block w-[.55em] h-[1em] align-[-.15em] bg-accent" /> : null}
          </div>
        ) : turn.status === 'thinking' ? (
          <div className="grid gap-2" aria-hidden="true">
            {[92, 78, 55].map((w) => <span key={w} className="block h-3 rounded-pill bg-rule-soft" style={{ width: `${w}%` }} />)}
          </div>
        ) : null}

        {turn.deviceProgress != null ? (
          <p className="m-0 mono text-ink-2" role="status">Downloading on-device model… {Math.round(turn.deviceProgress * 100)}%</p>
        ) : null}

        {turn.note ? (
          <p className="m-0 flex items-start gap-2 text-0 text-ink-2">
            <Icon name="info" size={16} className="mt-[3px] shrink-0 text-warn" />
            <span>{turn.note}</span>
          </p>
        ) : null}

        {turn.canDevice && !live ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon="download" onClick={onDevice} disabled={busy}>
              Try a small on-device model
            </Button>
            <span className="text-00 text-ink-3">{BROWSER_MODEL_DOWNLOAD} once, nothing leaves your browser, much weaker than the server models.</span>
          </div>
        ) : null}

        {turn.hits.length ? (
          <details className="group border-t border-rule-soft pt-2" open={turn.hits.length <= 3}>
            <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 mono text-ink-2 [&::-webkit-details-marker]:hidden">
              <Icon name="plus" size={14} className="transition-transform group-open:rotate-45 motion-reduce:transition-none" />
              Sources ({cited.size ? `${cited.size} cited of ${turn.hits.length}` : turn.hits.length})
            </summary>
            <ol className="m-0 mt-1 p-0 list-none grid gap-1">
              {turn.hits.map((h, i) => {
                const n = i + 1
                return (
                  <li key={h.chunk.id} id={`${prefix}-${n}`} className={cx('scroll-mt-24 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 p-2 rounded-1 border transition-colors', active === n ? 'border-accent bg-bg-2' : 'border-transparent')}>
                    <span className={cx('font-mono text-00 px-1 h-fit rounded-0 border', cited.has(n) ? 'border-accent text-accent-ink' : 'border-rule-soft text-ink-3')}>{n}</span>
                    <span className="min-w-0 grid gap-[2px]">
                      <Link href={h.chunk.href} className="text-0 font-semibold text-ink underline decoration-rule-soft underline-offset-2 hover:decoration-accent [overflow-wrap:anywhere]">
                        {h.chunk.title}
                      </Link>
                      <span className="mono text-ink-3">{h.chunk.section}</span>
                      <span className="text-0 text-ink-2 line-clamp-3">{h.chunk.text}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </details>
        ) : null}

        {!live && metaLine(turn) ? (
          <p className="m-0 font-mono text-00 text-ink-3 [overflow-wrap:anywhere]">
            {metaLine(turn)}{route ? <><br />Route: {route}</> : null}
          </p>
        ) : null}
      </div>
    </article>
  )
}
