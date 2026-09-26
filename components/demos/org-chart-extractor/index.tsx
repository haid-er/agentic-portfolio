'use client'
/**
 * Org-chart extractor ("Structure Fetcher" reborn): image / PDF / outline -> people with manager ids
 * -> editable chart, outline and table -> JSON export. Vision calls go through the lib/ai gateway.
 */
import { useRef, useState, type DragEvent } from 'react'
import {
  Badge, Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, ErrorState, Loading, Segmented, Textarea, useToast,
} from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { AiError, aiErrorMessage, generateObject, isQuotaError, type AiMeta } from '@/lib/ai'
import type { DemoProps } from '@/lib/demos/types'
import { cx } from '@/lib/utils'
import { ChartView, svgToPngDataUrl } from './ChartView'
import { prepareFile } from './files'
import { newId, type Person, removePerson, sanitize, stats, toNested } from './model'
import { parseOutline } from './outline'
import { SAMPLE_ORG, SAMPLE_OUTLINE } from './sample'
import { MAX_PEOPLE, OrgExtraction, SYSTEM, toPeople, USER_TEXT } from './schema'
import { Inspector, OutlineView, TableView } from './Views'

export { notes } from './notes'

type Mode = 'sample' | 'upload' | 'outline'
type View = 'chart' | 'outline' | 'table'
type Origin = { kind: 'ai'; meta: AiMeta; from: string } | { kind: 'outline' } | { kind: 'key' }

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'sample', label: 'Sample' }, { value: 'upload', label: 'Upload' }, { value: 'outline', label: 'Outline' },
]
const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'chart', label: 'Chart' }, { value: 'outline', label: 'Tree' }, { value: 'table', label: 'Table' },
]
const MAX_FILE = 15 * 1024 * 1024

/** How well did the model read the sample? Measured against the answer key for this run only. */
function score(people: Person[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const byName = new Map(people.map((p) => [norm(p.name), p]))
  const byId = new Map(people.map((p) => [p.id, p]))
  let found = 0
  let lines = 0
  for (const k of SAMPLE_ORG) {
    const got = byName.get(norm(k.name))
    if (!got) continue
    found++
    const keyBoss = SAMPLE_ORG.find((x) => x.id === k.managerId)?.name ?? ''
    const gotBoss = got.managerId ? byId.get(got.managerId)?.name ?? '' : ''
    if (norm(keyBoss) === norm(gotBoss)) lines++
  }
  return { found, lines, total: SAMPLE_ORG.length }
}

export default function Demo({ slug }: DemoProps) {
  const toast = useToast()
  const sampleRef = useRef<SVGSVGElement | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const [mode, setMode] = useState<Mode>('sample')
  const [view, setView] = useState<View>('chart')
  const [people, setPeople] = useState<Person[] | null>(null)
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'reading'>('idle')
  const [error, setError] = useState<{ message: string; quota: boolean } | null>(null)
  const [upload, setUpload] = useState<{ dataUrl: string; note: string } | null>(null)
  const [outline, setOutline] = useState(SAMPLE_OUTLINE)
  const [drag, setDrag] = useState(false)
  const [sampleScore, setSampleScore] = useState<ReturnType<typeof score> | null>(null)

  const busy = phase !== 'idle'

  const load = (list: Person[], o: Origin) => {
    setPeople(list)
    setOrigin(o)
    setSelected(null)
    setError(null)
  }

  const extract = async (dataUrl: string, from: string) => {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setPhase('reading')
    setError(null)
    setSampleScore(null)
    try {
      const res = await generateObject({
        demo: slug,
        vision: true,
        system: SYSTEM,
        temperature: 0,
        maxTokens: 800,
        messages: [{ role: 'user', content: [{ type: 'text', text: USER_TEXT }, { type: 'image', dataUrl }] }],
        schema: OrgExtraction,
        schemaName: 'OrgExtraction',
      }, { signal: c.signal })
      if (ctrl.current !== c) return
      const list = toPeople(res.object)
      load(list, { kind: 'ai', meta: res, from })
      if (from === 'sample') setSampleScore(score(list))
      const total = res.object.people.length
      toast(total > list.length ? `Showing the first ${list.length} of ${total} people` : `Extracted ${list.length} people`, { tone: 'ok' })
    } catch (e) {
      if (ctrl.current !== c) return
      if (e instanceof AiError && e.code === 'aborted') return
      const tooBig = e instanceof AiError && e.code === 'invalid_output'
      setError({
        message: tooBig ? `The model's answer did not fit the expected shape. Large charts can overflow the output limit (about ${MAX_PEOPLE} people): crop to one section and try again.` : aiErrorMessage(e),
        quota: isQuotaError(e),
      })
    } finally {
      if (ctrl.current === c) { ctrl.current = null; setPhase('idle') }
    }
  }

  const extractSample = async () => {
    if (!sampleRef.current) return
    setPhase('preparing')
    try {
      const dataUrl = await svgToPngDataUrl(sampleRef.current)
      await extract(dataUrl, 'sample')
    } catch (e) {
      setPhase('idle')
      setError({ message: e instanceof Error ? e.message : String(e), quota: false })
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_FILE) { setError({ message: 'That file is over 15 MB. Try a smaller export or a screenshot.', quota: false }); return }
    setPhase('preparing')
    setError(null)
    try {
      const prepared = await prepareFile(file)
      setUpload(prepared)
      setPhase('idle')
    } catch (e) {
      setPhase('idle')
      setError({ message: `Could not read that file: ${e instanceof Error ? e.message : String(e)}`, quota: false })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    void onFile(e.dataTransfer.files?.[0])
  }

  const buildOutline = () => {
    const list = parseOutline(outline)
    if (!list.length) { setError({ message: 'No lines to read. Put one person per line and indent reports under their manager.', quota: false }); return }
    load(list, { kind: 'outline' })
    setSampleScore(null)
  }

  const loadKey = () => { load(sanitize(SAMPLE_ORG), { kind: 'key' }); setSampleScore(null) }

  const stop = () => { ctrl.current?.abort(); ctrl.current = null; setPhase('idle') }

  /* edits */
  const patch = (id: string, p: Partial<Person>) => setPeople((cur) => (cur ? cur.map((x) => (x.id === id ? { ...x, ...p } : x)) : cur))
  const addReport = (managerId: string | null) => {
    const list = people ?? []
    const id = newId(list)
    const boss = list.find((p) => p.id === managerId)
    setPeople([...list, { id, name: 'New person', title: '', department: boss?.department ?? '', managerId }])
    setSelected(id)
  }
  const del = (id: string) => { setPeople((cur) => (cur ? removePerson(cur, id) : cur)); setSelected(null) }

  const exportJson = () => {
    if (!people) return
    const data = { tree: toNested(people), people }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'org-chart.json'
    a.click()
    URL.revokeObjectURL(url)
    toast('Exported org-chart.json', { tone: 'ok' })
  }

  const copyJson = async () => {
    if (!people) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(toNested(people), null, 2))
      toast('Nested JSON copied', { tone: 'ok' })
    } catch {
      toast('Clipboard is blocked in this browser', { tone: 'danger' })
    }
  }

  const s = people ? stats(people) : null
  const person = people?.find((p) => p.id === selected)

  return (
    <div className="grid gap-4 min-w-0">
      <DemoPanel title="1 · Source document">
        <div className="grid gap-4 min-w-0">
          <Segmented label="Source" options={MODES} value={mode} onChange={(m) => { setMode(m); setError(null) }} />

          {mode === 'sample' ? (
            <div className="grid gap-3 min-w-0">
              <figure className="m-0 grid gap-2 min-w-0">
                <div className="scroll-x border border-rule rounded-1 bg-surface p-2" role="region" aria-label="Sample organisation chart" tabIndex={0}>
                  <ChartView ref={sampleRef} people={SAMPLE_ORG} printed label="Sample organisation chart of a fictional renewables company, 10 boxes" />
                </div>
                <figcaption className="mono text-ink-3">Fictional chart, printed in this world&apos;s inks and sent to the model as a PNG</figcaption>
              </figure>
              <DemoToolbar>
                {busy ? <Button variant="danger" icon="close" onClick={stop}>Stop</Button> : <Button icon="doc" onClick={extractSample}>Extract with AI</Button>}
                <Button variant="secondary" icon="check" onClick={loadKey} disabled={busy}>Load answer key (offline)</Button>
              </DemoToolbar>
            </div>
          ) : null}

          {mode === 'upload' ? (
            <div className="grid gap-3 min-w-0">
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                className={cx(
                  'grid place-items-center gap-2 p-s6 text-center border-2 border-dashed rounded-1 cursor-pointer min-h-[160px]',
                  'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
                  drag ? 'border-accent bg-bg-2' : 'border-rule bg-surface hover:bg-bg-2',
                )}
              >
                <Icon name="upload" size={28} className="text-ink-2" />
                <span className="font-semibold">Drop an org chart here, or choose a file</span>
                <span className="mono text-ink-3">PNG · JPEG · WebP · PDF (page 1) · max 15 MB</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {upload ? (
                <figure className="m-0 grid gap-2 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
                  <img src={upload.dataUrl} alt="Your uploaded chart, as it will be sent to the model" className="max-h-[320px] w-auto max-w-full object-contain border border-rule rounded-1 bg-surface" />
                  <figcaption className="mono text-ink-3">{upload.note}</figcaption>
                </figure>
              ) : null}
              <DemoToolbar>
                {busy && phase === 'reading' ? <Button variant="danger" icon="close" onClick={stop}>Stop</Button> : (
                  <Button icon="doc" onClick={() => upload && extract(upload.dataUrl, 'upload')} disabled={!upload || busy}>Extract with AI</Button>
                )}
              </DemoToolbar>
              <p className="m-0 text-00 text-ink-3">The image is downscaled in your browser and sent once to the AI gateway; it is not stored.</p>
            </div>
          ) : null}

          {mode === 'outline' ? (
            <div className="grid gap-3 min-w-0">
              <Textarea
                label="Indented outline"
                hint="One person per line: “Name — Title (Department)”. Indent reports under their manager. Runs offline."
                rows={10}
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                className="font-mono text-0"
              />
              <DemoToolbar>
                <Button icon="leaders" onClick={buildOutline}>Build tree</Button>
              </DemoToolbar>
            </div>
          ) : null}

          <div aria-live="polite">
            {phase === 'preparing' ? <Loading label="Preparing the image" /> : null}
            {phase === 'reading' ? <Loading label="Reading boxes and connector lines" /> : null}
          </div>
          {error ? (
            <ErrorState
              title={error.quota ? 'AI is not available right now' : 'Extraction failed'}
              action={error.quota ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={loadKey}>Show the sample answer key</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setMode('outline'); setError(null) }}>Use an outline instead</Button>
                </div>
              ) : undefined}
            >
              {error.message}
            </ErrorState>
          ) : null}
        </div>
      </DemoPanel>

      {!people || !s ? (
        <EmptyState title="No structure yet">Extract the sample chart, upload your own, or build one from an outline.</EmptyState>
      ) : (
        <DemoPanel
          title="2 · Structure"
          meta={<OriginLine origin={origin} />}
          actions={
            <>
              <Button size="sm" variant="secondary" icon="copy" onClick={copyJson}>Copy</Button>
              <Button size="sm" variant="secondary" icon="download" onClick={exportJson}>JSON</Button>
            </>
          }
        >
          <div className="grid gap-4 min-w-0">
            <dl className="grid grid-cols-2 xs:grid-cols-4 gap-2 m-0">
              {[
                ['People', s.headcount],
                ['Levels', s.levels],
                ['Widest span', s.widestSpan],
                ['Departments', s.departments],
              ].map(([k, v]) => (
                <div key={k} className="p-3 border border-rule rounded-1 bg-bg-2">
                  <dt className="mono text-ink-3">{k}</dt>
                  <dd className="m-0 display text-3 nums leading-none mt-1">{v}</dd>
                </div>
              ))}
            </dl>
            {sampleScore ? (
              <p className="m-0 flex flex-wrap items-center gap-2 text-0 text-ink-2" aria-live="polite">
                <Badge tone={sampleScore.found === sampleScore.total && sampleScore.lines === sampleScore.total ? 'ok' : 'warn'}>this run</Badge>
                {sampleScore.found} of {sampleScore.total} people found · {sampleScore.lines} of {sampleScore.total} reporting lines match the answer key
              </p>
            ) : null}

            <DemoGrid aside={
              <DemoPanel title={person ? 'Edit person' : 'Inspector'}>
                <Inspector people={people} person={person} onChange={patch} onAddReport={addReport} onDelete={del} />
              </DemoPanel>
            }>
              <div className="grid gap-3 min-w-0">
                <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
                {people.length === 0 ? (
                  <EmptyState title="Everyone was deleted">Add a top-level person from the inspector, or extract again.</EmptyState>
                ) : view === 'chart' ? (
                  <div className="scroll-x border border-rule-soft rounded-1 p-2" role="region" aria-label="Extracted chart (scrolls sideways on small screens)" tabIndex={0}>
                    <ChartView people={people} selected={selected} onSelect={setSelected} label={`Extracted organisation chart, ${people.length} people`} />
                  </div>
                ) : view === 'outline' ? (
                  <OutlineView people={people} selected={selected} onSelect={setSelected} />
                ) : (
                  <TableView people={people} onChange={patch} onSelect={setSelected} />
                )}
              </div>
            </DemoGrid>
          </div>
        </DemoPanel>
      )}
    </div>
  )
}

function OriginLine({ origin }: { origin: Origin | null }) {
  if (!origin) return null
  if (origin.kind === 'ai') return <span>AI · {origin.meta.provider} · {origin.meta.model} · {(origin.meta.latencyMs / 1000).toFixed(1)}s</span>
  if (origin.kind === 'outline') return <span>outline · parsed in your browser</span>
  return <span>answer key · no AI call</span>
}
