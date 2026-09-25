'use client'
/**
 * ESG disclosure gap checker: excerpt -> keyword screen (instant, offline) -> AI pass per pillar
 * (structured output via the lib/ai gateway, Zod-validated) -> matrix, findings, export.
 */
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Badge, Button, DemoPanel, DemoToolbar, EmptyState, ErrorState, Loading, Segmented, Textarea, useToast,
} from '@/components/ui'
import { buttonClasses } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { AiError, aiErrorMessage, generateObject, isQuotaError, type AiMeta } from '@/lib/ai'
import type { DemoProps } from '@/lib/demos/types'
import { cx } from '@/lib/utils'
import { applicable, CHECKLIST, FRAMEWORKS, type Framework } from './checklist'
import { readReportFile } from './readFile'
import { Coverage, FindingCard, Matrix, sortFindings } from './Results'
import { SAMPLES } from './samples'
import { BATCHES, findingsSchema, SYSTEM, userPrompt } from './schema'
import { quoteIn, screen, type Finding, type Status } from './screen'

export { notes } from './notes'

const MAX_CHARS = 9000
type BatchState = 'idle' | 'running' | 'done' | 'failed'
type Filter = 'all' | Status

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' }, { value: 'gap', label: 'Gaps' }, { value: 'partial', label: 'Partial' }, { value: 'met', label: 'Met' },
]

const toMap = (list: Finding[]) => Object.fromEntries(list.map((f) => [f.id, f])) as Record<string, Finding>

export default function Demo({ slug }: DemoProps) {
  const toast = useToast()
  const [text, setText] = useState(SAMPLES[0].text)
  const [frameworks, setFrameworks] = useState<Framework[]>(['issb', 'tcfd', 'csrd'])
  const [findings, setFindings] = useState<Record<string, Finding> | null>(() => toMap(screen(SAMPLES[0].text, CHECKLIST)))
  const [analysed, setAnalysed] = useState(SAMPLES[0].text)
  const [batches, setBatches] = useState<BatchState[]>(BATCHES.map(() => 'idle'))
  const [metas, setMetas] = useState<AiMeta[]>([])
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [fileNote, setFileNote] = useState<string | null>(null)
  const [fileBusy, setFileBusy] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const ctrl = useRef<AbortController | null>(null)

  const reqs = useMemo(() => CHECKLIST.filter((r) => applicable(r, frameworks)), [frameworks])
  const busy = batches.includes('running')
  const stale = findings != null && analysed !== text
  const tooLong = text.length > MAX_CHARS

  const toggleFw = (f: Framework) =>
    setFrameworks((cur) => (cur.includes(f) ? (cur.length > 1 ? cur.filter((x) => x !== f) : cur) : [...cur, f]))

  const runScreen = () => {
    ctrl.current?.abort()
    setFindings(toMap(screen(text, CHECKLIST)))
    setAnalysed(text)
    setBatches(BATCHES.map(() => 'idle'))
    setMetas([])
    setAiNote(null)
  }

  const runAi = async () => {
    runScreen() // instant baseline; AI answers replace it pillar by pillar
    const c = new AbortController()
    ctrl.current = c
    const excerpt = text
    const jobs = BATCHES.map((pillars) => reqs.filter((r) => pillars.includes(r.pillar)))
    setBatches(jobs.map((j) => (j.length ? 'running' : 'idle')))
    const failures: unknown[] = []
    await Promise.all(jobs.map(async (job, i) => {
      if (!job.length) return
      try {
        const ids = job.map((r) => r.id) as [string, ...string[]]
        const res = await generateObject({
          demo: slug,
          system: SYSTEM,
          temperature: 0.1,
          maxTokens: 800,
          messages: [{ role: 'user', content: userPrompt(job, excerpt) }],
          schema: findingsSchema(ids),
          schemaName: 'DisclosureFindings',
        }, { signal: c.signal })
        if (ctrl.current !== c) return
        setFindings((cur) => {
          const next = { ...(cur ?? {}) }
          for (const f of res.object.findings) {
            next[f.id] = {
              id: f.id,
              status: f.status,
              evidence: f.evidence.trim(),
              recommendation: f.status === 'met' ? f.recommendation.trim() : f.recommendation.trim() || next[f.id]?.recommendation || '',
              origin: 'ai',
              quoteFound: f.evidence ? quoteIn(excerpt, f.evidence) : false,
            }
          }
          return next
        })
        setMetas((m) => [...m, res])
        setBatches((b) => b.map((s, k) => (k === i ? 'done' : s)))
      } catch (e) {
        if (ctrl.current !== c) return
        if (e instanceof AiError && e.code === 'aborted') return
        failures.push(e)
        setBatches((b) => b.map((s, k) => (k === i ? 'failed' : s)))
      }
    }))
    if (ctrl.current !== c) return
    ctrl.current = null
    if (failures.length) {
      const first = failures[0]
      setAiNote(`${aiErrorMessage(first)} ${isQuotaError(first) ? 'The keyword screen results stay in place for those pillars (marked “keyword screen”).' : 'Those pillars keep their keyword-screen results.'}`)
    }
  }

  const stop = () => {
    ctrl.current?.abort()
    ctrl.current = null
    setBatches((b) => b.map((s) => (s === 'running' ? 'idle' : s)))
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { setFileNote('That file is over 20 MB. Paste an excerpt instead.'); return }
    setFileBusy(true)
    setFileNote(null)
    try {
      const r = await readReportFile(file, MAX_CHARS)
      if (!r.text.trim()) { setFileNote('No selectable text found (a scanned PDF?). Paste the text instead.'); return }
      setText(r.text)
      setFileNote(`${file.name}: read ${r.pages ? `${r.pages} page${r.pages === 1 ? '' : 's'}, ` : ''}${r.text.length.toLocaleString('en-GB')} characters${r.truncated ? `, cut at ${MAX_CHARS.toLocaleString('en-GB')}` : ''}. Nothing was uploaded.`)
    } catch (err) {
      setFileNote(`Could not read that file: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setFileBusy(false)
    }
  }

  const jump = (id: string) => {
    setFilter('all')
    requestAnimationFrame(() => {
      const el = document.getElementById(`gap-${id}`)
      el?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      el?.focus({ preventScroll: true })
    })
  }

  const report = () => {
    if (!findings) return null
    return {
      frameworks,
      generated: new Date().toISOString(),
      findings: reqs.map((r) => ({ requirement: r.title, pillar: r.pillar, refs: r.refs, ...findings[r.id] })),
    }
  }

  const exportJson = () => {
    const data = report()
    if (!data) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'disclosure-gap-analysis.json'
    a.click()
    URL.revokeObjectURL(url)
    toast('Exported disclosure-gap-analysis.json', { tone: 'ok' })
  }

  const copyMarkdown = async () => {
    if (!findings) return
    const lines = ['# Disclosure gap analysis', '', `Frameworks: ${frameworks.map((f) => f.toUpperCase()).join(', ')}`, '']
    for (const r of sortFindings(reqs, findings)) {
      const f = findings[r.id]
      if (!f) continue
      lines.push(`## ${r.title} (${f.status.toUpperCase()})`, `Refs: ${Object.values(r.refs).join('; ')}`)
      if (f.evidence) lines.push(`> ${f.evidence}`)
      if (f.recommendation) lines.push(`Next step: ${f.recommendation}`)
      lines.push('')
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      toast('Markdown report copied', { tone: 'ok' })
    } catch {
      toast('Clipboard is blocked in this browser', { tone: 'danger' })
    }
  }

  const shown = findings ? sortFindings(reqs, findings).filter((r) => filter === 'all' || findings[r.id]?.status === filter) : []
  const aiCount = findings ? reqs.filter((r) => findings[r.id]?.origin === 'ai').length : 0

  return (
    <div className="grid gap-4 min-w-0">
      <DemoPanel title="1 · Excerpt" meta={`${text.length.toLocaleString('en-GB')} / ${MAX_CHARS.toLocaleString('en-GB')} chars`}>
        <div className="grid gap-3 min-w-0">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Load a fictional sample excerpt">
            {SAMPLES.map((s) => (
              <Button key={s.id} size="sm" variant="secondary" onClick={() => { setText(s.text); setFileNote(null) }}>{s.label}</Button>
            ))}
            <label className={cx(buttonClasses({ variant: 'secondary', size: 'sm' }), 'cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus')}>
              <Icon name="upload" size={16} />
              {fileBusy ? 'Reading…' : 'Upload .pdf / .txt'}
              <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="sr-only" onChange={onFile} disabled={fileBusy} />
            </label>
          </div>
          {fileNote ? <p className="m-0 text-0 text-ink-2" aria-live="polite">{fileNote}</p> : null}
          <Textarea
            label="Sustainability report excerpt"
            hint="Samples are fictional. Files are read in your browser; only the text is sent for the AI pass."
            error={tooLong ? `Trim to ${MAX_CHARS.toLocaleString('en-GB')} characters.` : undefined}
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <fieldset className="m-0 p-0 border-0 grid gap-1">
            <legend className="mono text-ink-2 mb-1">Check against</legend>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => {
                const on = frameworks.includes(f.id)
                return (
                  <label key={f.id} className={cx('inline-flex items-center gap-2 min-h-tap px-3 border rounded-pill cursor-pointer select-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus', on ? 'border-ink bg-ink text-bg' : 'border-rule bg-surface text-ink')}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleFw(f.id)} />
                    <Icon name={on ? 'check' : 'plus'} size={14} />
                    <span className="mono">{f.label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <DemoToolbar>
            {busy ? (
              <Button variant="danger" icon="close" onClick={stop}>Stop</Button>
            ) : (
              <Button icon="leaf" onClick={runAi} disabled={!text.trim() || tooLong}>Analyse with AI</Button>
            )}
            <Button variant="secondary" icon="search" onClick={runScreen} disabled={busy || !text.trim() || tooLong}>Keyword screen (offline)</Button>
          </DemoToolbar>
          <BatchStrip batches={batches} />
          <div aria-live="polite">
            {busy ? <Loading label="Reading the excerpt pillar by pillar" /> : null}
            {!busy && findings ? (
              <p className="m-0 flex flex-wrap items-center gap-2 text-0 text-ink-2">
                <Badge tone={aiCount ? 'accent' : 'neutral'}>{aiCount ? `${aiCount} of ${reqs.length} by AI` : 'keyword screen'}</Badge>
                {metas.length ? <span>{Array.from(new Set(metas.map((m) => `${m.provider} · ${m.model}`))).join(', ')}</span> : <span>Instant screen in your browser. Run the AI pass for judgement.</span>}
                {stale ? <Badge tone="warn">text changed: re-run</Badge> : null}
              </p>
            ) : null}
          </div>
          {aiNote ? <ErrorState title="AI pass incomplete">{aiNote}</ErrorState> : null}
        </div>
      </DemoPanel>

      {!findings ? (
        <EmptyState title="Nothing analysed yet">Paste an excerpt or load a sample, then run the checker.</EmptyState>
      ) : (
        <>
          <DemoPanel
            title="2 · Coverage"
            actions={
              <>
                <Button size="sm" variant="secondary" icon="copy" onClick={copyMarkdown}>Markdown</Button>
                <Button size="sm" variant="secondary" icon="download" onClick={exportJson}>JSON</Button>
              </>
            }
          >
            <div className="grid gap-5">
              <Coverage findings={findings} frameworks={frameworks} />
              <Matrix findings={findings} frameworks={frameworks} onJump={jump} />
            </div>
          </DemoPanel>

          <DemoPanel title="3 · Findings and recommendations" meta={`${shown.length} shown`}>
            <div className="grid gap-3 min-w-0">
              <Segmented label="Show" options={FILTERS} value={filter} onChange={setFilter} />
              {shown.length ? (
                <ol className="grid gap-3 m-0 p-0 list-none">
                  {shown.map((r) => <FindingCard key={r.id} req={r} finding={findings[r.id]} frameworks={frameworks} />)}
                </ol>
              ) : (
                <EmptyState title="None in this view">No requirements have this status.</EmptyState>
              )}
            </div>
          </DemoPanel>
        </>
      )}
    </div>
  )
}

const BATCH_LABELS = BATCHES.map((b) => b.join(' + '))

function BatchStrip({ batches }: { batches: BatchState[] }) {
  if (batches.every((b) => b === 'idle')) return null
  return (
    <ol className="flex flex-wrap gap-2 m-0 p-0 list-none" aria-label="AI pass progress">
      {batches.map((b, i) => (
        <li key={BATCH_LABELS[i]} className="mono inline-flex items-center gap-2 px-2 py-1 border border-rule rounded-pill text-00">
          <span
            aria-hidden="true"
            className={cx('inline-block size-2 rounded-pill', b === 'running' && 'bg-accent', b === 'done' && 'bg-ok', b === 'failed' && 'bg-danger', b === 'idle' && 'bg-rule')}
          />
          {BATCH_LABELS[i]}: {b === 'running' ? 'reading' : b === 'done' ? 'done' : b === 'failed' ? 'failed' : 'skipped'}
        </li>
      ))}
    </ol>
  )
}
