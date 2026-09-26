'use client'
/** Retrieved chunks with every retriever's score; the ones sent to the model are numbered. */
import { Badge } from '@/components/ui'
import { cx } from '@/lib/utils'
import { sourceLabel } from './answer'
import type { Hit } from './retrieve'

export function Sources({ sent, held, active, onActive, semantic }: {
  sent: Hit[]
  held: Hit[]
  active: number | null
  onActive: (n: number | null) => void
  semantic: boolean
}) {
  const top = sent[0]?.score || 1
  return (
    <div className="grid gap-4">
      <ol className="grid gap-2 m-0 p-0 list-none" aria-label="Sources sent to the model">
        {sent.map((h, i) => {
          const n = i + 1
          const on = active === n
          return (
            <li
              key={h.chunk.id}
              id={`legal-src-${n}`}
              tabIndex={-1}
              onPointerEnter={() => onActive(n)}
              onPointerLeave={() => onActive(null)}
              className={cx(
                'grid gap-2 p-3 border rounded-1 min-w-0 transition-colors duration-[var(--dur-fast)] scroll-mt-24 outline-none',
                on ? 'border-accent bg-bg-2' : 'border-rule-soft bg-surface',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-grid place-items-center size-7 border border-rule rounded-0 mono !tracking-normal text-ink">{n}</span>
                <span className="mono text-accent-ink">{sourceLabel(h)}</span>
                {h.chunk.provision.excerpt ? <Badge>excerpt</Badge> : null}
              </div>
              <p className="m-0 text-00 mono text-ink-3 !normal-case !tracking-normal">{h.chunk.provision.heading}</p>
              <blockquote className="m-0 pl-3 border-l-2 border-accent-2 text-0 [overflow-wrap:anywhere]">{h.chunk.text}</blockquote>
              <Scores hit={h} top={top} semantic={semantic} />
            </li>
          )
        })}
      </ol>

      {held.length ? (
        <details className="group">
          <summary className="min-h-tap flex items-center cursor-pointer mono text-ink-2">
            {held.length} more matched but were not sent
          </summary>
          <ul className="grid gap-2 m-0 mt-2 p-0 list-none">
            {held.map((h) => (
              <li key={h.chunk.id} className="grid gap-1 p-3 border border-dashed border-rule-soft rounded-1 text-0 text-ink-2">
                <span className="mono text-ink-3">{sourceLabel(h)} · {h.chunk.provision.heading}</span>
                <Scores hit={h} top={top} semantic={semantic} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

function Scores({ hit, top, semantic }: { hit: Hit; top: number; semantic: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="block h-[6px] bg-rule-soft rounded-pill overflow-hidden" aria-hidden="true">
        <span className="block h-full origin-left bg-data-1 rounded-pill" style={{ transform: `scaleX(${Math.min(1, hit.score / top)})` }} />
      </span>
      <dl className="flex flex-wrap gap-x-4 gap-y-0 m-0 mono text-ink-3 nums">
        <div className="flex gap-1"><dt>BM25</dt><dd className="m-0 text-ink">{hit.bm25.toFixed(2)}{hit.lexRank ? ` · #${hit.lexRank}` : ''}</dd></div>
        {semantic ? (
          <div className="flex gap-1"><dt>Cosine</dt><dd className="m-0 text-ink">{hit.cosine?.toFixed(3) ?? '—'}{hit.semRank ? ` · #${hit.semRank}` : ''}</dd></div>
        ) : null}
        <div className="flex gap-1"><dt>{semantic ? 'RRF' : 'Score'}</dt><dd className="m-0 text-ink">{semantic ? hit.score.toFixed(4) : hit.score.toFixed(2)}</dd></div>
      </dl>
    </div>
  )
}
