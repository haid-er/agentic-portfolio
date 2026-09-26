'use client'
/**
 * Ownership extractor: text about a corporate group -> ownership graph -> equity share vs
 * control consolidation of scope 1+2 emissions (GHG Protocol Corporate Standard, chapter 3).
 * Rule reader runs offline; the AI path goes through the lib/ai gateway.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge, Button, DemoPanel, DemoToolbar, EmptyState, ErrorState, Loading, Segmented, Textarea, useToast,
} from '@/components/ui'
import { AiError, aiErrorMessage, generateObject, isQuotaError, type AiMeta } from '@/lib/ai'
import type { DemoProps } from '@/lib/demos/types'
import { cx } from '@/lib/utils'
import { OwnershipGraph } from './Graph'
import { APPROACH_LABEL, type Approach, type Consolidation, type Group, consolidate, fmtPct, fmtT, shareFor } from './model'
import { parseOwnership } from './parse'
import { PROSE_SAMPLE, SAMPLES } from './sample'
import { OwnershipExtraction, SYSTEM, toGroup } from './schema'
import { EntityTable, LinkTable } from './Tables'

export { notes } from './notes'

const MAX_CHARS = 6000
const APPROACHES = [
  { value: 'equity', label: 'Equity' },
  { value: 'financial', label: 'Fin. control' },
  { value: 'operational', label: 'Op. control' },
] as const

type Source = { kind: 'rules'; hits: number } | { kind: 'ai'; meta: AiMeta } | { kind: 'fallback'; reason: string; hits: number }

function initial() {
  const r = parseOwnership(SAMPLES[0].text)
  return { group: r.group, source: { kind: 'rules', hits: r.hits } as Source }
}

export default function Demo({ slug }: DemoProps) {
  const toast = useToast()
  const [text, setText] = useState(SAMPLES[0].text)
  const [{ group, source }, setState] = useState<{ group: Group | null; source: Source | null }>(initial)
  const [version, setVersion] = useState(0)
  const [approach, setApproach] = useState<Approach>('equity')
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  const graphBox = useRef<HTMLDivElement | null>(null)

  // On phones the graph scrolls sideways: start centred on the reporting entity's column.
  useEffect(() => {
    const el = graphBox.current
    if (el) el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
  }, [version])

  const result = useMemo(() => (group ? consolidate(group) : null), [group])
  const tooLong = text.length > MAX_CHARS

  const load = (g: Group | null, s: Source) => {
    setState({ group: g, source: s })
    setVersion((v) => v + 1)
    setSelected(null)
  }

  const runRules = (reason?: string) => {
    const r = parseOwnership(text)
    if (!r.group) {
      setError(reason ? `${reason} The offline rule reader found no ownership sentences it understands either.` : 'The rule reader found no sentences like "A owns 60% of B". Try the AI extractor, or rephrase.')
      return
    }
    setError(null)
    load(r.group, reason ? { kind: 'fallback', reason, hits: r.hits } : { kind: 'rules', hits: r.hits })
  }

  const runAi = async () => {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setBusy(true)
    setError(null)
    try {
      const res = await generateObject({
        demo: slug,
        system: SYSTEM,
        temperature: 0,
        maxTokens: 800,
        messages: [{ role: 'user', content: `Extract the ownership structure from this text:\n\n${text}` }],
        schema: OwnershipExtraction,
        schemaName: 'OwnershipExtraction',
      }, { signal: c.signal })
      if (ctrl.current !== c) return
      load(toGroup(res.object), { kind: 'ai', meta: res })
    } catch (e) {
      if (ctrl.current !== c) return
      if (e instanceof AiError && e.code === 'aborted') return
      if (isQuotaError(e) || (e instanceof AiError && e.code === 'upstream')) runRules(`${aiErrorMessage(e)} Showing the offline rule reader instead.`)
      else setError(aiErrorMessage(e))
    } finally {
      if (ctrl.current === c) { setBusy(false); ctrl.current = null }
    }
  }

  const stop = () => { ctrl.current?.abort(); ctrl.current = null; setBusy(false) }

  const exportJson = () => {
    if (!group || !result) return
    const names = new Map(group.entities.map((e) => [e.id, e.name]))
    const data = {
      reportingEntity: names.get(group.parentId),
      entities: group.entities.map((e) => ({ ...e, consolidation: result.byId[e.id] })),
      links: group.links.map((l) => ({ ...l, ownerName: names.get(l.owner), ownedName: names.get(l.owned) })),
      totalsTco2e: result.totals,
      method: 'GHG Protocol Corporate Standard ch.3: equity share, financial control, operational control',
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'ownership-boundary.json'
    a.click()
    URL.revokeObjectURL(url)
    toast('Exported ownership-boundary.json', { tone: 'ok' })
  }

  const sel = group && selected ? group.entities.find((e) => e.id === selected) : undefined

  return (
    <div className="grid gap-4 min-w-0">
      <DemoPanel title="1 · Describe the group" meta={`${text.length.toLocaleString('en-GB')} / ${MAX_CHARS.toLocaleString('en-GB')} chars`}>
        <div className="grid gap-3 min-w-0">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Load a fictional sample">
            {SAMPLES.map((s) => (
              <Button key={s.id} size="sm" variant="secondary" onClick={() => { setText(s.text); setError(null) }}>{s.label}</Button>
            ))}
            <Button size="sm" variant="secondary" onClick={() => { setText(PROSE_SAMPLE); setError(null) }}>Free prose (needs AI)</Button>
          </div>
          <Textarea
            label="Group structure (plain text)"
            hint="Samples are fictional companies and figures. Try: “A owns 70% of B”, “B is operated by C”, “B: 4,300 tCO2e”."
            error={tooLong ? `Keep it under ${MAX_CHARS.toLocaleString('en-GB')} characters.` : undefined}
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-0"
          />
          <DemoToolbar>
            {busy ? (
              <Button variant="danger" icon="close" onClick={stop}>Stop</Button>
            ) : (
              <Button icon="nodes" onClick={runAi} disabled={!text.trim() || tooLong}>Extract with AI</Button>
            )}
            <Button variant="secondary" icon="leaders" onClick={() => runRules()} disabled={busy || !text.trim() || tooLong}>Rule reader (offline)</Button>
          </DemoToolbar>
          <div aria-live="polite" className="min-h-[1.5rem]">
            {busy ? <Loading label="Reading the group structure" /> : null}
            {!busy && source && group ? <SourceLine source={source} group={group} /> : null}
          </div>
          {error ? <ErrorState title="Could not extract a structure">{error}</ErrorState> : null}
        </div>
      </DemoPanel>

      {!group || !result ? (
        <EmptyState title="No group yet">Load a sample or paste a description, then extract.</EmptyState>
      ) : (
        <>
          <DemoPanel
            title="2 · Boundary"
            meta={<span>tCO2e, scope 1+2</span>}
            actions={<Button size="sm" variant="secondary" icon="download" onClick={exportJson}>JSON</Button>}
          >
            <div className="grid gap-4 min-w-0">
              <Segmented label="Consolidation approach" options={APPROACHES} value={approach} onChange={setApproach} />
              <Totals result={result} approach={approach} onPick={setApproach} />
              {result.missingEmissions.length ? (
                <p className="m-0 text-0 text-ink-2 flex gap-2 items-start">
                  <Badge tone="warn">no figure</Badge>
                  <span>{result.missingEmissions.join(', ')}: add emissions in the table below. Nothing is estimated.</span>
                </p>
              ) : null}
              {result.cycles ? <p className="m-0 text-0 text-warn">Circular holding detected: the loop is ignored in the maths.</p> : null}
            </div>
          </DemoPanel>

          <DemoPanel title="3 · Ownership graph" meta="tap an entity" bodyClassName="p-0">
            <div ref={graphBox} className="scroll-x p-3" role="region" aria-label="Ownership graph (scrolls sideways on small screens)" tabIndex={0}>
              <OwnershipGraph group={group} result={result} approach={approach} selected={selected} onSelect={setSelected} />
            </div>
            <Legend />
            <div aria-live="polite" className="px-4 pb-4">
              {sel ? <EntityDetail name={sel.name} group={group} id={sel.id} result={result} approach={approach} /> : null}
            </div>
          </DemoPanel>

          <DemoPanel title="4 · Entities">
            <EntityTable group={group} result={result} approach={approach} selected={selected} onSelect={setSelected} onChange={(g) => setState((s) => ({ ...s, group: g }))} />
          </DemoPanel>

          <DemoPanel title="5 · Links (edit to test the rules)">
            <LinkTable key={version} group={group} onChange={(g) => setState((s) => ({ ...s, group: g }))} />
          </DemoPanel>
        </>
      )}
    </div>
  )
}

function SourceLine({ source, group }: { source: Source; group: Group }) {
  const counts = `${group.entities.length} entities, ${group.links.length} links`
  if (source.kind === 'ai') {
    return (
      <p className="m-0 flex flex-wrap items-center gap-2 text-0 text-ink-2">
        <Badge tone="ok">AI</Badge>
        <span>{counts} · {source.meta.provider} · {source.meta.model} · {(source.meta.latencyMs / 1000).toFixed(1)}s</span>
      </p>
    )
  }
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-0 text-ink-2">
      <Badge tone={source.kind === 'fallback' ? 'warn' : 'neutral'}>rule reader</Badge>
      <span>{counts} · {source.hits} sentence matches · ran in your browser</span>
      {source.kind === 'fallback' ? <span className="basis-full text-ink-3">{source.reason}</span> : null}
    </p>
  )
}

function Totals({ result, approach, onPick }: { result: Consolidation; approach: Approach; onPick: (a: Approach) => void }) {
  const max = Math.max(1, result.totals.equity, result.totals.financial, result.totals.operational)
  return (
    <ul className="grid gap-2 m-0 p-0 list-none xs:grid-cols-3">
      {(Object.keys(APPROACH_LABEL) as Approach[]).map((a) => {
        const on = a === approach
        return (
          <li key={a}>
            <button
              type="button"
              onClick={() => onPick(a)}
              aria-pressed={on}
              className={cx('w-full text-left grid gap-1 p-3 border rounded-1 bg-surface min-h-tap', on ? 'border-accent border-2' : 'border-rule')}
            >
              <span className="mono text-ink-3">{APPROACH_LABEL[a]}</span>
              <span className="display text-3 nums leading-none">{fmtT(result.totals[a])}<span className="text-0 font-mono text-ink-3"> t</span></span>
              <span aria-hidden="true" className="block h-[6px] bg-rule-soft">
                <span
                  className="block h-full origin-left motion-safe:transition-transform motion-safe:duration-[var(--dur-med)]"
                  style={{ transform: `scaleX(${result.totals[a] / max})`, background: on ? 'var(--accent)' : 'var(--data-1)' }}
                />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 m-0 list-none border-t border-rule-soft mono text-ink-3">
      <li className="flex items-center gap-2"><svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" style={{ stroke: 'var(--ink-2)', strokeWidth: 2.5 }} /></svg>counts under approach</li>
      <li className="flex items-center gap-2"><svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" style={{ stroke: 'var(--ink-2)', strokeWidth: 1.25, strokeDasharray: '5 4' }} /></svg>does not count</li>
      <li>OC operational · FC financial · JC joint · ? not stated</li>
    </ul>
  )
}

function EntityDetail({ id, name, group, result, approach }: { id: string; name: string; group: Group; result: Consolidation; approach: Approach }) {
  const r = result.byId[id]
  const names = new Map(group.entities.map((e) => [e.id, e.name]))
  const owners = group.links.filter((l) => l.owned === id)
  const e = group.entities.find((x) => x.id === id)
  return (
    <div className="grid gap-2 mt-2 p-3 border-l-4 border-accent-2 bg-bg-2 rounded-1">
      <p className="m-0 font-semibold">{name}</p>
      <p className="m-0 text-0 text-ink-2 nums">
        Equity {fmtPct(r.equity)} · Financial control {fmtPct(r.financial)} · Operational control {fmtPct(r.operational)}
        {e?.emissions != null ? ` · ${APPROACH_LABEL[approach]}: ${fmtT(e.emissions * shareFor(r, approach))} of ${fmtT(e.emissions)} t` : ''}
      </p>
      {owners.length ? (
        <ul className="m-0 pl-4 text-0 text-ink-2">
          {owners.map((l) => <li key={l.id}>Held {l.equityPct}% by {names.get(l.owner)} ({l.control === 'unstated' ? 'control not stated' : l.control})</li>)}
        </ul>
      ) : null}
      {r.notes.length ? <ul className="m-0 pl-4 text-00 text-ink-3">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      {!owners.length && id !== group.parentId ? <p className="m-0 text-00 text-ink-3">Not held by the group: outside the boundary under every approach.</p> : null}
    </div>
  )
}
