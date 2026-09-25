'use client'
/** Side panel: how each source was ranked (BM25 vs cosine, fused with RRF). */
import Link from 'next/link'
import { cx } from '@/lib/utils'
import type { Hit } from './search'

function Bar({ value, label, tone }: { value: number; label: string; tone: 'lex' | 'vec' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-center gap-2">
      <span className="font-mono text-00 text-ink-3 uppercase tracking-[.06em]">{label}</span>
      <span className="relative block h-[6px] bg-rule-soft rounded-pill overflow-hidden" aria-hidden="true">
        <span
          className={cx('absolute inset-y-0 left-0 rounded-pill origin-left transition-transform duration-[var(--dur-med)] ease-[var(--ease-out)]', tone === 'lex' ? 'bg-data-1' : 'bg-data-2')}
          style={{ width: '100%', transform: `scaleX(${pct / 100})` }}
        />
      </span>
    </div>
  )
}

export function Retrieval({ hits, semantic, active, onHover, query }: {
  hits: Hit[]
  semantic: boolean
  active: number | null
  onHover: (n: number | null) => void
  query: string
}) {
  const maxBm = Math.max(0.0001, ...hits.map((h) => h.bm25))
  return (
    <div className="grid gap-3">
      <p className="m-0 text-0 text-ink-2">
        Top {hits.length} for <q className="text-ink">{query}</q>, ranked by {semantic ? 'Reciprocal Rank Fusion of BM25 and MiniLM cosine' : 'BM25 (load the semantic model to fuse in vectors)'}.
      </p>
      <ol className="m-0 p-0 list-none grid gap-2">
        {hits.map((h, i) => {
          const n = i + 1
          return (
            <li
              key={h.chunk.id}
              onMouseEnter={() => onHover(n)}
              onMouseLeave={() => onHover(null)}
              className={cx(
                'grid gap-2 p-3 border rounded-1 bg-bg-2 transition-colors duration-[var(--dur-fast)]',
                active === n ? 'border-accent' : 'border-rule-soft',
              )}
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="flex min-w-0 items-start gap-2">
                  <span className="font-mono text-00 text-accent-ink border border-accent px-1 rounded-0 leading-[1.5]">{n}</span>
                  <span className="min-w-0">
                    <Link href={h.chunk.href} className="block text-0 font-semibold text-ink underline decoration-rule-soft underline-offset-2 hover:decoration-accent [overflow-wrap:anywhere]">
                      {h.chunk.title}
                    </Link>
                    <span className="mono text-ink-3">{h.chunk.section}</span>
                  </span>
                </span>
                <span className="nums font-mono text-00 text-ink-3 whitespace-nowrap" title="Reciprocal Rank Fusion score">
                  RRF {h.fused.toFixed(4)}
                </span>
              </div>
              <Bar label="BM25" value={h.bm25 / maxBm} tone="lex" />
              {semantic ? <Bar label="Cos" value={h.cosine ?? 0} tone="vec" /> : null}
              <p className="m-0 nums font-mono text-00 text-ink-3">
                bm25 {h.bm25.toFixed(2)}{h.lexRank ? ` (#${h.lexRank})` : ' (no match)'}
                {semantic ? ` · cos ${(h.cosine ?? 0).toFixed(3)}${h.vecRank ? ` (#${h.vecRank})` : ''}` : ''}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
