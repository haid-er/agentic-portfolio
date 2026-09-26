'use client'
/**
 * Chunking lab: cut one document four ways, embed every chunk with the active
 * embedder, and see which strategy returns the answer in one piece.
 */
import { useEffect, useMemo, useState } from 'react'
import { Badge, DemoPanel, ErrorState, Loading, Segmented, Select, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import { chunk, STRATEGIES, type Chunk, type Strategy } from './chunking'
import { CHUNK_DOC, CHUNK_QUESTIONS } from './corpus'
import type { EmbedMany } from './useEmbedder'
import { dot } from './vectors'

interface Row {
  strategy: Strategy
  chunks: Chunk[]
  scores: number[]
  best: number
  intact: boolean
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')

export function ChunkLab({ embedMany, embedderLabel }: { embedMany: EmbedMany; embedderLabel: string }) {
  const [strategy, setStrategy] = useState<Strategy>('fixed')
  // sizeLive follows the slider; size (which triggers chunking + embedding) settles 250 ms after the last move.
  const [sizeLive, setSizeLive] = useState(200)
  const [size, setSize] = useState(200)
  const [qi, setQi] = useState(0)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const question = CHUNK_QUESTIONS[qi] ?? CHUNK_QUESTIONS[0]

  useEffect(() => {
    if (sizeLive === size) return
    const t = window.setTimeout(() => setSize(sizeLive), 250)
    return () => window.clearTimeout(t)
  }, [sizeLive, size])

  const all = useMemo(
    () => STRATEGIES.map((s) => ({ strategy: s.value, chunks: chunk(CHUNK_DOC, s.value, size) })),
    [size],
  )

  useEffect(() => {
    let live = true
    setError(null)
    const texts = [question.q, ...all.flatMap((a) => a.chunks.map((c) => c.text))]
    embedMany(texts)
      .then(([qv, ...rest]) => {
        if (!live || !qv) return
        let at = 0
        const next = all.map(({ strategy: s, chunks }) => {
          const scores = chunks.map(() => dot(qv, rest[at++]))
          const best = scores.indexOf(Math.max(...scores))
          const top = chunks[best]
          return { strategy: s, chunks, scores, best, intact: Boolean(top && squash(top.text).includes(question.answer)) }
        })
        setRows(next)
      })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : String(e)) })
    return () => { live = false }
  }, [all, embedMany, question])

  const row = rows?.find((r) => r.strategy === strategy)
  const blurb = STRATEGIES.find((s) => s.value === strategy)?.blurb

  return (
    <DemoPanel title="Chunking lab" meta={`${embedderLabel} · ${CHUNK_DOC.length} chars`}>
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <Select label="Test question" value={qi} onChange={(e) => setQi(Number(e.target.value))}>
            {CHUNK_QUESTIONS.map((q, i) => <option key={q.q} value={i}>{q.q}</option>)}
          </Select>
          <label className="grid gap-1">
            <span className="mono text-ink-2">Max chunk size · <span className="nums">{sizeLive}</span> chars</span>
            <input
              type="range"
              min={80}
              max={480}
              step={20}
              value={sizeLive}
              onChange={(e) => setSizeLive(Number(e.target.value))}
              onPointerUp={(e) => setSize(Number(e.currentTarget.value))}
              className="w-full min-h-tap accent-[var(--accent)]"
            />
          </label>
        </div>

        {error ? (
          <ErrorState title="Could not embed the chunks">{error}</ErrorState>
        ) : !rows ? (
          <Loading label="Embedding chunks" />
        ) : (
          <TableWrap label="Chunking strategies compared">
            <Table>
              <thead>
                <tr><Th>Strategy</Th><Th className="text-right">Vectors</Th><Th className="text-right">Avg chars</Th><Th className="text-right">Top score</Th><Th>Answer in top chunk</Th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const label = STRATEGIES.find((s) => s.value === r.strategy)?.label ?? r.strategy
                  const avg = Math.round(r.chunks.reduce((s, c) => s + c.text.length, 0) / (r.chunks.length || 1))
                  return (
                    <tr key={r.strategy} className={cx(r.strategy === strategy && 'bg-bg-2')}>
                      <Td>
                        <button type="button" onClick={() => setStrategy(r.strategy)} className="min-h-tap text-left font-semibold underline decoration-rule-soft underline-offset-4 hover:decoration-accent" aria-pressed={r.strategy === strategy}>
                          {label}
                        </button>
                      </Td>
                      <Td className="text-right">{r.chunks.length}</Td>
                      <Td className="text-right">{avg}</Td>
                      <Td className="text-right">{(r.scores[r.best] ?? 0).toFixed(3)}</Td>
                      <Td>{r.intact ? <Badge tone="ok">Intact</Badge> : <Badge tone="warn">Cut or missed</Badge>}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}

        <div className="grid gap-3">
          <Segmented<Strategy> label="Show cuts for" value={strategy} onChange={setStrategy} options={STRATEGIES.map(({ value, label }) => ({ value, label }))} />
          {blurb ? <p className="m-0 text-0 text-ink-2 measure">{blurb}</p> : null}
        </div>

        {row ? <CutMap row={row} total={CHUNK_DOC.length} /> : null}

        {row ? (
          <ol className="grid gap-2 m-0 p-0 list-none" aria-label="Chunks for this strategy">
            {row.chunks.map((c, i) => {
              const top = i === row.best
              return (
                <li key={`${c.start}-${c.end}`} className={cx('grid gap-1 p-3 border rounded-1 min-w-0', top ? 'border-accent bg-bg-2' : 'border-rule-soft')}>
                  <span className="flex flex-wrap items-center gap-2 mono text-ink-3">
                    <span>#{i + 1}</span>
                    <span className="nums">{c.start}–{c.end}</span>
                    <span className="nums">score {(row.scores[i] ?? 0).toFixed(3)}</span>
                    {top ? <Badge tone="accent">Top match</Badge> : null}
                  </span>
                  <span className="text-0 [overflow-wrap:anywhere]">
                    {c.start > 0 && !/\s/.test(CHUNK_DOC[c.start - 1] ?? ' ') ? <span className="text-danger" aria-label="cut mid-word">…</span> : null}
                    {c.text}
                    {c.end < CHUNK_DOC.length && !/[\s.]/.test(CHUNK_DOC[c.end] ?? ' ') ? <span className="text-danger" aria-label="cut mid-word">…</span> : null}
                  </span>
                </li>
              )
            })}
          </ol>
        ) : null}
      </div>
    </DemoPanel>
  )
}

/** A strip of the document with each chunk drawn as a bar; overlaps stack on two rows. */
function CutMap({ row, total }: { row: Row; total: number }) {
  return (
    <figure className="m-0 grid gap-1">
      <div className="relative h-9 bg-bg-2 rounded-0 overflow-hidden" aria-hidden="true">
        {row.chunks.map((c, i) => (
          <span
            key={`${c.start}-${c.end}`}
            className="absolute rounded-0 border border-surface"
            style={{
              height: row.strategy === 'overlap' ? 14 : 30,
              left: `${(c.start / total) * 100}%`,
              width: `${((c.end - c.start) / total) * 100}%`,
              top: row.strategy === 'overlap' && i % 2 ? 19 : 3,
              background: i === row.best ? 'var(--accent)' : `var(--data-${(i % 3) + 2})`,
              opacity: i === row.best ? 1 : 0.55,
            }}
          />
        ))}
      </div>
      <figcaption className="mono text-ink-3">
        Cut map · {row.chunks.length} chunks across {total} characters · top match highlighted
      </figcaption>
    </figure>
  )
}
