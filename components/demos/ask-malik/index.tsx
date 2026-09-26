'use client'
/**
 * Ask the portfolio: RAG over this site's own content.
 * Retrieval runs in the browser (BM25 instantly, + MiniLM embeddings fused with RRF once loaded).
 * Generation streams through the lib/ai gateway; if it is unavailable, an extractive answer
 * (best sentence per source, cited) is shown instead, and a small on-device model is offered.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button, DemoGrid, DemoPanel, EmptyState, ErrorState, Input, Segmented } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { AiError, aiErrorMessage, isQuotaError, streamText } from '@/lib/ai'
import { getEducation, getExperience, getProfile, getResearch, getSkills } from '@/lib/content'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { buildMessages, extractiveAnswer, retrievalQuery, systemPrompt, type PastTurn } from './answer'
import { getCorpus, nameStopwords } from './corpus'
import { Retrieval } from './Retrieval'
import { buildBm25, hybridSearch, type Hit } from './search'
import { embedQuery, loadCorpusVectors, type SemanticProgress } from './semantic'
import { TurnView, type Turn } from './TurnView'

export { notes } from './notes'

const MAX_Q = 300
const TOP_K = 6
type Mode = 'model' | 'extractive'
type SemState = { state: 'off' } | { state: 'loading'; progress: SemanticProgress | null } | { state: 'ready' } | { state: 'error'; message: string }

function suggestions(): string[] {
  const p = getProfile()
  const first = p.name.split(' ')[0] ?? p.name
  const exp = getExperience()[0]
  const aiSkill = getSkills().find((s) => s.pillar === 'ai')
  const out = [
    exp ? `What does ${first} do at ${exp.org.replace(/\s*\(.*\)$/, '')}?` : '',
    aiSkill ? `Which demo proves ${aiSkill.name}?` : '',
    getResearch().items.length ? `What research has ${first} published?` : '',
    getEducation().length ? `Where did ${first} study?` : '',
    `Which stack does ${first} use for backends?`,
  ]
  return out.filter(Boolean).slice(0, 4)
}

export default function Demo({ slug }: DemoProps) {
  const chunks = useMemo(() => getCorpus(), [])
  const index = useMemo(() => buildBm25(chunks, nameStopwords()), [chunks])
  const name = useMemo(() => getProfile().name, [])
  const system = useMemo(() => systemPrompt(name), [name])
  const prompts = useMemo(() => suggestions(), [])
  const sectionCount = useMemo(() => new Set(chunks.map((c) => c.section)).size, [chunks])

  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<Mode>('model')
  const [semanticWanted, setSemanticWanted] = useLocalStorage('ask-malik:semantic', false)
  const [sem, setSem] = useState<SemState>({ state: 'off' })
  const [active, setActive] = useState<{ turn: string; n: number } | null>(null)
  const vectors = useRef<Float32Array[] | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const counter = useRef(0)
  const logRef = useRef<HTMLDivElement | null>(null)

  const busy = turns.some((t) => t.status !== 'done')
  const last = turns[turns.length - 1]
  const tooLong = question.length > MAX_Q

  const patch = useCallback((id: string, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => {
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...(typeof p === 'function' ? p(t) : p) } : t)))
  }, [])

  const loadSemantic = useCallback(async () => {
    setSemanticWanted(true)
    setSem({ state: 'loading', progress: null })
    try {
      vectors.current = await loadCorpusVectors(chunks, (progress) => setSem({ state: 'loading', progress }))
      setSem({ state: 'ready' })
    } catch (e) {
      vectors.current = null
      setSem({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [chunks, setSemanticWanted])

  // Re-load automatically for visitors who opted in before (the model is browser-cached).
  useEffect(() => {
    if (semanticWanted && sem.state === 'off') void loadSemantic()
  }, [semanticWanted, sem.state, loadSemantic])

  useEffect(() => () => ctrl.current?.abort(), [])

  const history = (upTo: number): PastTurn[] =>
    turns.slice(0, upTo).filter((t) => t.status === 'done' && t.answer).map((t) => ({ q: t.q, answer: t.answer }))

  const retrieve = async (q: string, past: PastTurn[]): Promise<Hit[]> => {
    const query = retrievalQuery(q, past)
    let queryVec: Float32Array | null = null
    if (vectors.current) {
      try { queryVec = await embedQuery(query) } catch { queryVec = null }
    }
    return hybridSearch({ chunks, index, query, queryVec, vectors: vectors.current, k: TOP_K })
  }

  const ask = async (raw: string) => {
    const q = raw.trim().slice(0, MAX_Q)
    if (!q || busy) return
    const id = `t${++counter.current}`
    const past = history(turns.length)
    setQuestion('')
    setTurns((all) => [...all, { id, q, hits: [], answer: '', status: 'thinking', via: mode }])
    requestAnimationFrame(() => logRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'auto' }))

    const hits = await retrieve(q, past)
    if (!hits.length) {
      patch(id, { hits, status: 'done', via: 'extractive', answer: '', note: 'Nothing on this site matches that question, so there is nothing to answer from. Try asking about roles, projects, research, skills or the playground demos.' })
      return
    }
    if (mode === 'extractive') {
      patch(id, { hits, status: 'done', via: 'extractive', answer: extractiveAnswer(q, hits) })
      return
    }

    patch(id, { hits })
    const c = new AbortController()
    ctrl.current = c
    let got = ''
    try {
      const res = await streamText(
        { demo: slug, system, messages: buildMessages(q, hits, past), maxTokens: 420, temperature: 0.2 },
        { signal: c.signal, onToken: (tok) => { got += tok; patch(id, (t) => ({ status: 'streaming', answer: t.answer + tok })) } },
      )
      patch(id, { status: 'done', via: 'model', answer: res.text || got, meta: res })
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('upstream', String(e))
      if (err.code === 'aborted') {
        patch(id, { status: 'done', note: got ? 'Stopped. The partial answer is kept.' : 'Stopped before the model answered.', answer: got })
      } else if (got) {
        patch(id, { status: 'done', via: 'model', answer: got, note: `The stream broke off: ${aiErrorMessage(err)} The partial answer is kept.` })
      } else {
        patch(id, {
          status: 'done', via: 'extractive', answer: extractiveAnswer(q, hits),
          note: `${aiErrorMessage(err)} Showing an extractive answer instead: the best-matching sentence from each top source, quoted as written.`,
          canDevice: isQuotaError(err) && err.code !== 'rate_limited',
        })
      }
    } finally {
      if (ctrl.current === c) ctrl.current = null
    }
  }

  const runOnDevice = async (turn: Turn) => {
    const at = turns.findIndex((t) => t.id === turn.id)
    const past = history(at)
    const c = new AbortController()
    ctrl.current = c
    patch(turn.id, { status: 'thinking', answer: '', note: undefined, canDevice: false, deviceProgress: 0, via: 'device', meta: null })
    try {
      const { generateInBrowser } = await import('@/lib/ai/browser')
      const res = await generateInBrowser(buildMessages(turn.q, turn.hits, past), {
        system, maxNewTokens: 220, signal: c.signal,
        onProgress: (p) => patch(turn.id, { deviceProgress: p }),
        onToken: (tok) => patch(turn.id, (t) => ({ status: 'streaming', deviceProgress: null, answer: t.answer + tok })),
      })
      patch(turn.id, { status: 'done', answer: res.text, meta: res, deviceProgress: null, note: 'A 135M-parameter model running on your device: expect rough answers and check the cited sources.' })
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      patch(turn.id, {
        status: 'done', via: 'extractive', deviceProgress: null, answer: extractiveAnswer(turn.q, turn.hits),
        note: aborted ? 'Stopped. Showing the extractive answer.' : `The on-device model could not run here (${e instanceof Error ? e.message : String(e)}). Showing the extractive answer.`,
      })
    } finally {
      if (ctrl.current === c) ctrl.current = null
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!tooLong) void ask(question)
  }

  const semanticMeta = sem.state === 'ready' ? 'Hybrid · BM25 + MiniLM' : 'Lexical · BM25'

  return (
    <DemoGrid
      aside={
        <>
          <DemoPanel title="Retrieval" meta={semanticMeta}>
            {last?.hits.length ? (
              <Retrieval
                hits={last.hits}
                semantic={sem.state === 'ready' && last.hits.some((h) => h.cosine != null)}
                active={active?.turn === last.id ? active.n : null}
                onHover={(n) => setActive(n ? { turn: last.id, n } : null)}
                query={last.q}
              />
            ) : (
              <EmptyState title="No query yet">
                Ask something and the ranked sources appear here, with each retriever&apos;s score.
              </EmptyState>
            )}
          </DemoPanel>

          <DemoPanel title="Index" meta={`${chunks.length} chunks · ${sectionCount} sections`}>
            <div className="grid gap-3 text-0">
              <p className="m-0 text-ink-2">
                Every visible item on this site is cut into sentence-bounded chunks. BM25 works instantly and offline. The semantic model adds meaning-based matches (&ldquo;agents&rdquo; finds &ldquo;autonomous workflows&rdquo;).
              </p>
              {sem.state === 'off' ? (
                <Button variant="secondary" size="sm" icon="download" onClick={() => void loadSemantic()}>
                  Load semantic model (~25 MB)
                </Button>
              ) : sem.state === 'loading' ? (
                <SemanticProgressBar progress={sem.progress} />
              ) : sem.state === 'ready' ? (
                <p className="m-0 flex items-center gap-2 mono text-ok"><Icon name="check" size={16} />MiniLM-L6 ready: {chunks.length} vectors, 384-d</p>
              ) : (
                <ErrorState title="Semantic model failed to load" action={<Button size="sm" variant="secondary" icon="refresh" onClick={() => void loadSemantic()}>Retry</Button>}>
                  {sem.message}. Lexical search still works.
                </ErrorState>
              )}
            </div>
          </DemoPanel>
        </>
      }
    >
      <DemoPanel
        title="Ask the portfolio"
        meta={mode === 'model' ? 'Streamed via AI gateway' : 'Offline · extractive'}
        actions={turns.length ? <Button variant="ghost" size="sm" icon="refresh" onClick={() => { ctrl.current?.abort(); setTurns([]) }}>Clear</Button> : null}
      >
        <div className="grid gap-4">
          <Segmented<Mode>
            label="Answer with"
            value={mode}
            onChange={setMode}
            options={[{ value: 'model', label: 'Model + citations' }, { value: 'extractive', label: 'Extractive (offline)' }]}
          />

          {/* Streaming is visual only; screen readers hear one status when each answer settles. */}
          <p role="status" className="sr-only">{last?.status === 'done' ? 'Answer ready.' : ''}</p>

          <div ref={logRef} aria-label="Conversation" className="grid gap-5 min-w-0">
            {turns.length === 0 ? (
              <EmptyState title="Ask anything about the work on this site">
                <p className="m-0 mb-3">Answers come only from this site&apos;s content, and every sentence cites its source.</p>
                <div className="flex flex-wrap gap-2">
                  {prompts.map((p) => (
                    <button key={p} type="button" onClick={() => void ask(p)} className="min-h-tap px-3 py-2 text-left text-0 border border-rule rounded-pill bg-bg-2 hover:border-accent hover:text-accent-ink">
                      {p}
                    </button>
                  ))}
                </div>
              </EmptyState>
            ) : (
              turns.map((t) => (
                <TurnView
                  key={t.id}
                  turn={t}
                  active={active?.turn === t.id ? active.n : null}
                  onCite={(n) => setActive(n ? { turn: t.id, n } : null)}
                  onDevice={() => void runOnDevice(t)}
                  busy={busy}
                />
              ))
            )}
          </div>

          <form onSubmit={onSubmit} className="grid gap-2 border-t border-rule-soft pt-4">
            <div className="flex flex-col gap-2 xs:flex-row xs:items-end">
              <Input
                label="Your question"
                wrapperClassName="flex-1"
                value={question}
                maxLength={MAX_Q + 50}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. What is the most recent role?"
                error={tooLong ? `Keep it under ${MAX_Q} characters.` : undefined}
                autoComplete="off"
              />
              {busy ? (
                <Button variant="secondary" icon="pause" onClick={() => ctrl.current?.abort()}>Stop</Button>
              ) : (
                <Button type="submit" arrow disabled={!question.trim() || tooLong}>Ask</Button>
              )}
            </div>
            <p className="m-0 text-00 text-ink-3">
              {mode === 'model'
                ? 'Your question and the retrieved sources go to the site’s AI gateway (free providers, rate limited). Nothing is stored.'
                : 'Nothing leaves your browser: answers are quoted sentences from the top sources.'}
            </p>
          </form>
        </div>
      </DemoPanel>
    </DemoGrid>
  )
}

function SemanticProgressBar({ progress }: { progress: SemanticProgress | null }) {
  const [label, value] = !progress
    ? ['Starting…', 0]
    : progress.phase === 'model'
      ? [`Downloading model ${Math.round(progress.p * 100)}%`, progress.p * 0.7]
      : [`Embedding chunks ${progress.done}/${progress.total}`, 0.7 + (progress.done / progress.total) * 0.3]
  return (
    <div className="grid gap-1" role="status" aria-live="polite">
      <span className="mono text-ink-2">{label}</span>
      <span className="relative block h-[6px] bg-rule-soft rounded-pill overflow-hidden" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 w-full origin-left bg-data-1 transition-transform duration-[var(--dur-fast)]" style={{ transform: `scaleX(${value})` }} />
      </span>
    </div>
  )
}
