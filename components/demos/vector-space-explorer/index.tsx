'use client'
/**
 * Vector space explorer: embed sentences in the browser, project them to 2-D with PCA,
 * run exact cosine top-k search with a metadata filter (the Pinecone query model),
 * and compare chunking strategies. Starts offline with a hash embedder; MiniLM is opt-in.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, EmptyState, ErrorState, Input, Loading, Segmented, Select } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { ChunkLab } from './ChunkLab'
import { DOCS, SAMPLE_QUERIES, TOPICS, topicStyle, type Doc, type Topic } from './corpus'
import { Mark, Scatter, type Pt } from './Scatter'
import { EMBEDDERS, useEmbedder, type EmbedderId } from './useEmbedder'
import { fitBox, fitPca, project, topK, type Basis, type Hit } from './vectors'

export { notes } from './notes'

const MAX_CUSTOM = 8
const MAX_LEN = 160
type Filter = Topic | 'all'
type Space = { embedder: EmbedderId; vectors: Float32Array[]; basis: Basis }
type Result = { q: string; vec: Float32Array; hits: Hit[]; ms: number; embedder: EmbedderId }

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const emb = useEmbedder()
  const { embedMany } = emb
  const [custom, setCustom] = useLocalStorage<string[]>('vector-space-explorer:custom', [])
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [k, setK] = useState<'3' | '5' | '8'>('5')
  const [filter, setFilter] = useState<Filter>('all')
  const [space, setSpace] = useState<Space | null>(null)
  const [spaceError, setSpaceError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const docs = useMemo<Doc[]>(
    () => [...DOCS, ...custom.slice(0, MAX_CUSTOM).map((text, i) => ({ id: `my-${i + 1}`, text, topic: 'custom' as const }))],
    [custom],
  )

  // (Re)index whenever the corpus or the embedder changes.
  useEffect(() => {
    let live = true
    setSpaceError(null)
    embedMany(docs.map((d) => d.text))
      .then((vectors) => { if (live) setSpace({ embedder: emb.id, vectors, basis: fitPca(vectors) }) })
      .catch((e: unknown) => { if (live) setSpaceError(e instanceof Error ? e.message : String(e)) })
    return () => { live = false }
  }, [docs, embedMany, emb.id])

  const allow = useCallback((i: number) => filter === 'all' || docs[i]?.topic === filter, [docs, filter])

  const lastQ = useRef<string | null>(null)
  const search = useCallback(async (raw: string) => {
    const q = raw.trim().slice(0, MAX_LEN)
    if (!q) return
    lastQ.current = q
    // Wait for the index of the active embedder (vector sizes differ between embedders).
    if (!space || space.embedder !== emb.id || space.vectors.length !== docs.length) return
    const t0 = performance.now()
    const [vec] = await embedMany([q])
    if (!vec || lastQ.current !== q) return
    const hits = topK(vec, space.vectors, Number(k), allow)
    setResult({ q, vec, hits, ms: performance.now() - t0, embedder: space.embedder })
  }, [allow, docs.length, emb.id, embedMany, k, space])

  // Keep the last query live when the index, k or the filter changes.
  useEffect(() => {
    if (lastQ.current) void search(lastQ.current)
  }, [search])

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void search(query) }
  const pickDoc = (id: string) => {
    const d = docs.find((x) => x.id === id)
    if (d) { setQuery(d.text); void search(d.text) }
  }

  const points = useMemo<Pt[]>(() => {
    if (!space || space.vectors.length !== docs.length) return []
    const raw = space.vectors.map((v) => project(space.basis, v))
    const box = fitBox(raw)
    const rank = new Map(result?.hits.map((h, i) => [h.index, i + 1]))
    return docs.map((d, i) => {
      const [x, y] = box(raw[i])
      return { id: d.id, text: d.text, topic: d.topic, x, y, rank: rank.get(i), muted: !allow(i) }
    })
  }, [allow, docs, result, space])

  const queryPt = useMemo(() => {
    if (!space || !result || space.vectors.length !== docs.length) return null
    const raw = space.vectors.map((v) => project(space.basis, v))
    const [x, y] = fitBox(raw)(project(space.basis, result.vec))
    return { x: Math.min(0.98, Math.max(0.02, x)), y: Math.min(0.98, Math.max(0.02, y)) }
  }, [docs.length, result, space])

  const active = docs.find((d) => d.id === activeId)
  const embedder = EMBEDDERS[emb.id]
  const indexing = !space || space.embedder !== emb.id || space.vectors.length !== docs.length

  const addSentence = (e: FormEvent) => {
    e.preventDefault()
    const t = draft.trim().slice(0, MAX_LEN)
    if (!t || custom.length >= MAX_CUSTOM || custom.includes(t)) return
    setCustom([...custom, t])
    setDraft('')
  }

  return (
    <div className="grid gap-4">
      <DemoGrid
        aside={
          <>
            <DemoPanel title="Embedder" meta={`${embedder.dim}-d`}>
              <div className="grid gap-3">
                <Segmented<EmbedderId>
                  label="Turn text into vectors with"
                  value={emb.id}
                  onChange={emb.choose}
                  options={[{ value: 'hash', label: 'Hash (offline)' }, { value: 'minilm', label: 'MiniLM (semantic)' }]}
                />
                {emb.model.state === 'loading' ? (
                  <Progress value={emb.model.progress} label={`Downloading MiniLM · ${Math.round(emb.model.progress * 100)}%`} />
                ) : emb.model.state === 'error' ? (
                  <ErrorState title="The embedding model did not load" action={<Button size="sm" variant="secondary" icon="refresh" onClick={() => void emb.loadModel()}>Retry</Button>}>
                    {emb.model.message}. The offline hash embedder still works.
                  </ErrorState>
                ) : emb.id === 'hash' ? (
                  <p className="m-0 text-0 text-ink-2">
                    Feature hashing knows spelling, not meaning: &ldquo;bread&rdquo; and &ldquo;dough&rdquo; are strangers. Switch to MiniLM (a one-time ~25&nbsp;MB download, cached) and watch the clusters regroup by meaning.
                  </p>
                ) : (
                  <p className="m-0 flex items-start gap-2 text-0 text-ink-2">
                    <Icon name="check" size={16} className="text-ok mt-[3px]" />
                    <span>all-MiniLM-L6-v2 runs on this device (transformers.js). Sentences with no words in common now land together.</span>
                  </p>
                )}
              </div>
            </DemoPanel>

            <DemoPanel title="Pinecone-shaped query" meta="not sent anywhere">
              <PineconeView result={result} k={Number(k)} filter={filter} docs={docs} dim={embedder.dim} />
            </DemoPanel>

            <DemoPanel title="Corpus" meta={`${docs.length} vectors`}>
              <form onSubmit={addSentence} className="grid gap-2">
                <Input
                  label="Upsert your own sentence"
                  value={draft}
                  maxLength={MAX_LEN}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="e.g. Wind turbines slow down in calm weather"
                  hint={custom.length >= MAX_CUSTOM ? `Limit of ${MAX_CUSTOM} reached. Remove one to add more.` : 'Stays in this browser. Drawn as a star.'}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" icon="plus" disabled={!draft.trim() || custom.length >= MAX_CUSTOM}>Upsert</Button>
                  {custom.length ? <Button size="sm" variant="ghost" icon="refresh" onClick={() => setCustom([])}>Remove mine</Button> : null}
                </div>
              </form>
              {custom.length ? (
                <ul className="mt-3 grid gap-1 m-0 p-0 list-none">
                  {custom.map((t, i) => (
                    <li key={t} className="flex items-center gap-2 text-0">
                      <button type="button" className="flex-1 min-h-tap text-left hover:text-accent-ink" onClick={() => pickDoc(`my-${i + 1}`)}>{t}</button>
                      <Button size="sm" variant="ghost" icon="close" aria-label={`Remove “${t}”`} onClick={() => setCustom(custom.filter((x) => x !== t))} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </DemoPanel>
          </>
        }
      >
        <DemoPanel
          title="Vector space"
          meta={space ? `PCA · PC1 + PC2 keep ${Math.round((space.basis.explained[0] + space.basis.explained[1]) * 100)}% of variance` : 'indexing'}
        >
          {spaceError ? (
            <ErrorState title="Indexing failed">{spaceError}</ErrorState>
          ) : !points.length ? (
            <Loading label="Embedding the corpus" />
          ) : (
            <div className="grid gap-3">
              <Scatter points={points} query={queryPt} activeId={activeId} onActive={setActiveId} onPick={pickDoc} reduced={reduced} busy={indexing} />
              <p className="m-0 min-h-[3em] text-0 text-ink-2" aria-live="polite">
                {active ? (
                  <><span className="mono text-ink-3">{topicStyle(active.topic).label} · </span>{active.text}</>
                ) : (
                  <>Point at a mark to read it; tap or press Enter to search with it. Distances are squeezed into 2-D, so trust the scores, not the picture.</>
                )}
              </p>
              <Legend />
            </div>
          )}
        </DemoPanel>

        <DemoPanel title="Semantic search" meta="exact cosine top-k">
          <form onSubmit={onSubmit} className="grid gap-3">
            <div className="flex flex-col gap-2 xs:flex-row xs:items-end">
              <Input label="Query" wrapperClassName="flex-1" value={query} maxLength={MAX_LEN} onChange={(e) => setQuery(e.target.value)} placeholder="Ask in your own words" autoComplete="off" />
              <Button type="submit" arrow disabled={!query.trim() || !space}>Search</Button>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Sample queries">
              {SAMPLE_QUERIES.map((q) => (
                <button key={q} type="button" onClick={() => { setQuery(q); void search(q) }} className="min-h-tap px-3 py-2 text-left text-0 border border-rule rounded-pill bg-bg-2 hover:border-accent hover:text-accent-ink">
                  {q}
                </button>
              ))}
            </div>
            <div className="grid gap-3 xs:grid-cols-2">
              <Segmented<'3' | '5' | '8'> label="topK" value={k} onChange={setK} options={[{ value: '3', label: '3' }, { value: '5', label: '5' }, { value: '8', label: '8' }]} />
              <Select label="Metadata filter · topic" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                <option value="all">All topics</option>
                {TOPICS.filter((t) => t.id !== 'custom' || custom.length).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </div>
          </form>

          <div className="mt-4" aria-live="polite">
            {!result ? (
              <EmptyState title="No query yet">Pick a sample or type your own. The nearest sentences appear here with their cosine scores, and threads draw to them on the map.</EmptyState>
            ) : !result.hits.length ? (
              <EmptyState title="Nothing matches this filter">Every vector was filtered out by the topic filter. Choose another topic.</EmptyState>
            ) : (
              <Results result={result} docs={docs} onPick={pickDoc} />
            )}
          </div>
        </DemoPanel>
      </DemoGrid>

      <ChunkLab embedMany={embedMany} embedderLabel={embedder.short} />
    </div>
  )
}

function Results({ result, docs, onPick }: { result: Result; docs: Doc[]; onPick: (id: string) => void }) {
  const top = result.hits[0]?.score ?? 1
  return (
    <div className="grid gap-2">
      <p className="m-0 mono text-ink-3">
        {result.hits.length} nearest to &ldquo;{result.q}&rdquo; · <span className="nums">{result.ms.toFixed(1)} ms</span> · {EMBEDDERS[result.embedder].short}
      </p>
      <ol className="grid gap-2 m-0 p-0 list-none">
        {result.hits.map((h, i) => {
          const d = docs[h.index]
          if (!d) return null
          const s = topicStyle(d.topic)
          const width = Math.max(0, Math.min(1, h.score / (top || 1)))
          return (
            <li key={d.id}>
              <button type="button" onClick={() => onPick(d.id)} className={cx('w-full grid gap-1 p-3 text-left border rounded-1 min-h-tap hover:border-accent', i === 0 ? 'border-accent' : 'border-rule-soft')}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="display text-2 nums w-6">{i + 1}</span>
                  <svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden="true"><Mark shape={s.shape} r={5} fill={s.ink} /></svg>
                  <span className="mono text-ink-3">{s.label}</span>
                  <span className="ml-auto mono nums text-ink">{h.score.toFixed(3)}</span>
                </span>
                <span className="text-0">{d.text}</span>
                <span className="block h-[6px] bg-rule-soft rounded-pill overflow-hidden" aria-hidden="true">
                  <span className="block h-full origin-left bg-data-1 rounded-pill" style={{ transform: `scaleX(${width})` }} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 m-0 p-0 list-none" aria-label="Legend">
      {TOPICS.map((t) => (
        <li key={t.id} className="flex items-center gap-1 mono text-ink-2">
          <svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden="true"><Mark shape={t.shape} r={5} fill={t.ink} /></svg>
          {t.label}
        </li>
      ))}
      <li className="flex items-center gap-1 mono text-ink-2">
        <svg width="16" height="16" viewBox="-10 -10 20 20" aria-hidden="true"><circle r="6" fill="none" stroke="var(--accent)" strokeWidth="1.6" /><path d="M-9 0H9M0 -9V9" stroke="var(--accent)" /></svg>
        Query
      </li>
    </ul>
  )
}

function PineconeView({ result, k, filter, docs, dim }: { result: Result | null; k: number; filter: Filter; docs: Doc[]; dim: number }) {
  const vec = result ? `[${Array.from(result.vec.slice(0, 3), (x) => x.toFixed(3)).join(', ')}, … ${dim} values]` : `[… ${dim} values]`
  const req = [
    `index.namespace('demo').query({`,
    `  vector: ${vec},`,
    `  topK: ${k},`,
    filter === 'all' ? null : `  filter: { topic: { $eq: '${filter}' } },`,
    `  includeMetadata: true,`,
    `})`,
  ].filter(Boolean).join('\n')
  const res = result?.hits.slice(0, 3).map((h) => `  { id: '${docs[h.index]?.id}', score: ${h.score.toFixed(4)}, metadata: { topic: '${docs[h.index]?.topic}' } },`)
  return (
    <div className="grid gap-2">
      <pre className="m-0 p-3 text-00 leading-[1.6] bg-bg-2 rounded-0 overflow-x-auto" aria-label="Query request">{req}</pre>
      {res?.length ? (
        <pre className="m-0 p-3 text-00 leading-[1.6] bg-bg-2 rounded-0 overflow-x-auto" aria-label="Query response">{`// matches\n[\n${res.join('\n')}${result && result.hits.length > 3 ? `\n  … ${result.hits.length - 3} more` : ''}\n]`}</pre>
      ) : null}
      <p className="m-0 text-00 text-ink-3">
        The search runs locally by brute force. A managed index answers the same request with approximate nearest neighbours over millions of vectors. <Badge tone="neutral">exact here</Badge>
      </p>
    </div>
  )
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid gap-1" role="status" aria-live="polite">
      <span className="mono text-ink-2">{label}</span>
      <span className="relative block h-[6px] bg-rule-soft rounded-pill overflow-hidden" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 w-full origin-left bg-data-1 transition-transform duration-[var(--dur-fast)]" style={{ transform: `scaleX(${value})` }} />
      </span>
    </div>
  )
}
