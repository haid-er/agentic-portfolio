'use client'
/**
 * Legal RAG assistant: retrieve -> cite -> answer over public-domain constitutional text.
 * Retrieval runs in the browser (BM25 with query expansion, plus opt-in MiniLM fused by RRF).
 * The answer streams through the lib/ai gateway with numbered sources; when the gateway is
 * unavailable an extractive, quoted answer is shown and an on-device model is offered.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button, DemoGrid, DemoPanel, EmptyState, ErrorState, Input, Segmented } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { AiError, aiErrorMessage, isQuotaError, streamText } from '@/lib/ai'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, useReducedMotion } from '@/lib/hooks'
import { buildMessages, extractiveAnswer, SYSTEM_PROMPT } from './answer'
import { AnswerView, type Run } from './AnswerView'
import { buildChunks, PROVISIONS, SAMPLE_QUESTIONS, SOURCE_NAME, SOURCE_URL } from './corpus'
import { buildBm25, expandQuery, retrieve } from './retrieve'
import { embedQuery, loadChunkVectors, type SemanticProgress } from './semantic'
import { Sources } from './Sources'

export { notes } from './notes'

const MAX_Q = 280
type Mode = 'model' | 'extractive'
type K = '3' | '4' | '6'
type Sem = { state: 'off' } | { state: 'loading'; progress: SemanticProgress | null } | { state: 'ready' } | { state: 'error'; message: string }

export default function Demo({ slug }: DemoProps) {
  const chunks = useMemo(() => buildChunks(), [])
  const ix = useMemo(() => buildBm25(chunks), [chunks])
  const reduced = useReducedMotion()

  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<Mode>('model')
  const [k, setK] = useState<K>('4')
  const [run, setRun] = useState<Run | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [semWanted, setSemWanted] = useLocalStorage('legal-rag-assistant:semantic', false)
  const [sem, setSem] = useState<Sem>({ state: 'off' })
  const vectors = useRef<Float32Array[] | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const counter = useRef(0)

  const busy = Boolean(run && run.status !== 'done')
  const tooLong = question.length > MAX_Q

  const patch = useCallback((id: number, p: Partial<Run> | ((r: Run) => Partial<Run>)) => {
    setRun((r) => (r && r.id === id ? { ...r, ...(typeof p === 'function' ? p(r) : p) } : r))
  }, [])

  const loadSemantic = useCallback(async () => {
    setSemWanted(true)
    setSem({ state: 'loading', progress: null })
    try {
      vectors.current = await loadChunkVectors(chunks, (progress) => setSem({ state: 'loading', progress }))
      setSem({ state: 'ready' })
    } catch (e) {
      vectors.current = null
      setSem({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [chunks, setSemWanted])

  useEffect(() => { if (semWanted && sem.state === 'off') void loadSemantic() }, [semWanted, sem.state, loadSemantic])
  useEffect(() => () => ctrl.current?.abort(), [])

  const ask = async (raw: string) => {
    const q = raw.trim().slice(0, MAX_Q)
    if (!q) return
    ctrl.current?.abort()
    const id = ++counter.current
    const expanded = expandQuery(q)
    setActive(null)
    setRun({ id, q, expanded, hits: [], sent: [], retrievalMs: 0, semantic: false, status: 'retrieving', answer: '', via: mode })

    const t0 = performance.now()
    let queryVec: Float32Array | null = null
    if (vectors.current) { try { queryVec = await embedQuery(q) } catch { queryVec = null } }
    const hits = retrieve({ chunks, ix, qTerms: expanded.terms, queryVec, vectors: vectors.current })
    const sent = hits.slice(0, Number(k))
    const retrievalMs = performance.now() - t0
    const semantic = Boolean(queryVec)

    if (!sent.length) {
      patch(id, { hits, sent, retrievalMs, semantic, status: 'done', via: 'extractive', note: `Nothing in these ${PROVISIONS.length} provisions matches the question, so there is nothing to answer from. Try asking about speech, searches, trials, voting or the presidency.` })
      return
    }
    if (mode === 'extractive') {
      patch(id, { hits, sent, retrievalMs, semantic, status: 'done', via: 'extractive', answer: extractiveAnswer(expanded.terms, sent) })
      return
    }

    patch(id, { hits, sent, retrievalMs, semantic, status: 'thinking' })
    const c = new AbortController()
    ctrl.current = c
    let got = ''
    try {
      const res = await streamText(
        { demo: slug, system: SYSTEM_PROMPT, messages: buildMessages(q, sent), maxTokens: 360, temperature: 0.1 },
        { signal: c.signal, onToken: (tok) => { got += tok; patch(id, (r) => ({ status: 'streaming', answer: r.answer + tok })) } },
      )
      patch(id, { status: 'done', via: 'model', answer: res.text || got, meta: res })
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('upstream', String(e))
      if (err.code === 'aborted') {
        patch(id, { status: 'done', answer: got, note: got ? 'Stopped. The partial answer is kept.' : 'Stopped before the model answered.' })
      } else if (got) {
        patch(id, { status: 'done', answer: got, note: `The stream broke off: ${aiErrorMessage(err)} The partial answer is kept.` })
      } else {
        patch(id, {
          status: 'done', via: 'extractive', answer: extractiveAnswer(expanded.terms, sent),
          note: `${aiErrorMessage(err)} Showing an extractive answer instead: the best-matching clause of each top source, quoted exactly.`,
          canDevice: isQuotaError(err) && err.code !== 'rate_limited',
        })
      }
    } finally {
      if (ctrl.current === c) ctrl.current = null
    }
  }

  const runOnDevice = async () => {
    if (!run) return
    const id = run.id
    const c = new AbortController()
    ctrl.current = c
    patch(id, { status: 'thinking', answer: '', note: undefined, canDevice: false, deviceProgress: 0, via: 'device', meta: null })
    try {
      const { generateInBrowser } = await import('@/lib/ai/browser')
      const res = await generateInBrowser(buildMessages(run.q, run.sent), {
        system: SYSTEM_PROMPT, maxNewTokens: 200, signal: c.signal,
        onProgress: (p) => patch(id, { deviceProgress: p }),
        onToken: (tok) => patch(id, (r) => ({ status: 'streaming', deviceProgress: null, answer: r.answer + tok })),
      })
      patch(id, { status: 'done', answer: res.text, meta: res, deviceProgress: null, note: 'A 135M-parameter model running on your device: expect rough answers, and check them against the quoted sources.' })
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError'
      patch(id, {
        status: 'done', via: 'extractive', deviceProgress: null, answer: extractiveAnswer(run.expanded.terms, run.sent),
        note: aborted ? 'Stopped. Showing the extractive answer.' : `The on-device model could not run here (${e instanceof Error ? e.message : String(e)}). Showing the extractive answer.`,
      })
    } finally {
      if (ctrl.current === c) ctrl.current = null
    }
  }

  const cite = (n: number) => {
    setActive(n)
    const el = document.getElementById(`legal-src-${n}`)
    el?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    el?.focus({ preventScroll: true })
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (!tooLong && !busy) void ask(question) }

  return (
    <DemoGrid
      aside={
        <>
          <DemoPanel title="Retrieved chunks" meta={run?.sent.length ? `top ${run.sent.length} of ${run.hits.length}` : `${chunks.length} chunks indexed`}>
            {run && run.status !== 'retrieving' && run.sent.length ? (
              <Sources sent={run.sent} held={run.hits.slice(run.sent.length, run.sent.length + 4)} active={active} onActive={setActive} semantic={run.semantic} />
            ) : (
              <EmptyState title="No retrieval yet">Ask a question and the matching clauses appear here, numbered as the model sees them, with BM25 and cosine scores.</EmptyState>
            )}
          </DemoPanel>

          <DemoPanel title="Index" meta={sem.state === 'ready' ? 'Hybrid · BM25 + MiniLM' : 'Lexical · BM25'}>
            <div className="grid gap-3 text-0">
              <p className="m-0 text-ink-2">
                {PROVISIONS.length} provisions of the{' '}
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-accent-ink underline-offset-2">{SOURCE_NAME}</a>{' '}
                (public domain), split at semicolons into {chunks.length} clause-sized chunks. Everyday words are expanded to the text&apos;s own vocabulary (&ldquo;lawyer&rdquo; → &ldquo;counsel&rdquo;).
              </p>
              {sem.state === 'off' ? (
                <Button variant="secondary" size="sm" icon="download" onClick={() => void loadSemantic()}>Add semantic search (~25 MB)</Button>
              ) : sem.state === 'loading' ? (
                <SemanticBar progress={sem.progress} />
              ) : sem.state === 'ready' ? (
                <p className="m-0 flex items-center gap-2 mono text-ok"><Icon name="check" size={16} />MiniLM-L6 ready · {chunks.length} vectors · 384-d</p>
              ) : (
                <ErrorState title="Semantic model failed to load" action={<Button size="sm" variant="secondary" icon="refresh" onClick={() => void loadSemantic()}>Retry</Button>}>
                  {sem.message}. BM25 still works.
                </ErrorState>
              )}
              <Segmented<K> label="Sources sent to the model" value={k} onChange={setK} options={[{ value: '3', label: '3' }, { value: '4', label: '4' }, { value: '6', label: '6' }]} />
            </div>
          </DemoPanel>
        </>
      }
    >
      <DemoPanel title="Ask the Constitution" meta={mode === 'model' ? 'Streamed via AI gateway' : 'Offline · extractive'}>
        <div className="grid gap-4">
          <Segmented<Mode>
            label="Answer with"
            value={mode}
            onChange={setMode}
            options={[{ value: 'model', label: 'Model + citations' }, { value: 'extractive', label: 'Quotes only (offline)' }]}
          />

          <form onSubmit={onSubmit} className="grid gap-2">
            <div className="flex flex-col gap-2 xs:flex-row xs:items-end">
              <Input
                label="Your question"
                wrapperClassName="flex-1"
                value={question}
                maxLength={MAX_Q + 40}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Can the police search my home without a warrant?"
                error={tooLong ? `Keep it under ${MAX_Q} characters.` : undefined}
                autoComplete="off"
              />
              {busy ? (
                <Button variant="secondary" icon="pause" onClick={() => ctrl.current?.abort()}>Stop</Button>
              ) : (
                <Button type="submit" arrow disabled={!question.trim() || tooLong}>Ask</Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Sample questions">
              {SAMPLE_QUESTIONS.map((q) => (
                <button key={q} type="button" disabled={busy} onClick={() => { setQuestion(q); void ask(q) }} className="min-h-tap px-3 py-2 text-left text-0 border border-rule rounded-pill bg-bg-2 hover:border-accent hover:text-accent-ink disabled:opacity-55">
                  {q}
                </button>
              ))}
            </div>
          </form>

          <div aria-live="polite" className="border-t border-rule-soft pt-4 min-w-0">
            {run ? (
              <div className="grid gap-3">
                <p className="m-0 display text-3 [overflow-wrap:anywhere]">{run.q}</p>
                <AnswerView run={run} onCite={cite} onDevice={() => void runOnDevice()} />
              </div>
            ) : (
              <EmptyState title="Ask a question in plain English">
                The assistant retrieves the relevant clauses, numbers them, and answers only from them, citing every sentence. Try a sample above.
              </EmptyState>
            )}
          </div>

          <p className="m-0 flex items-start gap-2 text-00 text-ink-3">
            <Icon name="alert" size={16} className="mt-[1px] shrink-0" />
            <span>
              Not legal advice. The corpus is historical constitutional text only: no case law, statutes or later interpretation.{' '}
              {mode === 'model' ? 'Your question and the retrieved clauses go to the site’s AI gateway (free providers, rate limited). Nothing is stored.' : 'Nothing leaves your browser.'}
            </span>
          </p>
        </div>
      </DemoPanel>
    </DemoGrid>
  )
}

function SemanticBar({ progress }: { progress: SemanticProgress | null }) {
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
