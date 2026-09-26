'use client'
/**
 * GHG calculator: a small corporate inventory (Scope 1, 2 and 3) with an editable
 * organisational boundary. Switch between operational control, financial control and
 * equity share, or between location- and market-based Scope 2, and every figure,
 * the stacked breakdown and the CSV follow. Runs fully in the browser; state is local.
 */
import { useMemo, useState } from 'react'
import { Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, Segmented, useToast } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { ApproachCompare, ScopeBreakdown } from './Charts'
import { EntitiesEditor, Ledger } from './Editors'
import { FactorTable } from './Factors'
import {
  APPROACHES, EMPTY, FACTORS, SAMPLE, calculate, fmtT, loadState, newId, toCsv,
  type Activity, type Approach, type CalcState, type Entity, type S2Method, type Totals,
} from './model'

export { notes } from './notes'

const S2_OPTIONS = [{ value: 'location', label: 'Location' }, { value: 'market', label: 'Market' }] as const

export default function Demo(_props: DemoProps) {
  const [raw, setRaw] = useLocalStorage<unknown>('ghg-calculator:v1', SAMPLE)
  const state = useMemo(() => loadState(raw), [raw])
  const toast = useToast()
  const [announce, setAnnounce] = useState('')

  const update = (fn: (s: CalcState) => CalcState) => setRaw((prev: unknown) => fn(loadState(prev)))

  const byApproach = useMemo(() => ({
    operational: calculate(state, 'operational'),
    financial: calculate(state, 'financial'),
    equity: calculate(state, 'equity'),
  }) satisfies Record<Approach, Totals>, [state])
  const totals = byApproach[state.approach]

  const setApproach = (approach: Approach) => {
    update((s) => ({ ...s, approach }))
    const label = APPROACHES.find((a) => a.value === approach)?.label ?? approach
    setAnnounce(`${label}: ${fmtT(byApproach[approach].totalKg)} tonnes CO2e.`)
  }

  const patchEntity = (id: string, patch: Partial<Entity>) =>
    update((s) => ({ ...s, entities: s.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  const addEntity = () =>
    update((s) => ({ ...s, entities: [...s.entities, { id: newId('e'), name: `Entity ${s.entities.length + 1}`, equity: 100, operational: true, financial: 'full' }] }))
  const removeEntity = (e: Entity) => {
    const n = state.activities.filter((a) => a.entityId === e.id).length
    update((s) => ({ ...s, entities: s.entities.filter((x) => x.id !== e.id), activities: s.activities.filter((a) => a.entityId !== e.id) }))
    toast(`Removed ${e.name || 'entity'}${n ? ` and its ${n} activity line${n === 1 ? '' : 's'}` : ''}.`)
  }

  const patchActivity = (id: string, patch: Partial<Activity>) =>
    update((s) => ({ ...s, activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
  const addActivity = () =>
    update((s) => ({
      ...s,
      activities: [...s.activities, { id: newId('a'), entityId: s.entities[0]?.id ?? '', factorId: FACTORS[0]?.id ?? '', quantity: 0 }],
    }))
  const removeActivity = (id: string) => update((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== id) }))

  const setOverride = (id: string, kg: number | undefined) =>
    update((s) => {
      const overrides = { ...s.overrides }
      if (kg === undefined) delete overrides[id]
      else overrides[id] = kg
      return { ...s, overrides }
    })

  const exportCsv = () => {
    try {
      const blob = new Blob([toCsv(state, totals)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ghg-inventory-${state.approach}-${state.s2}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast(`CSV exported: ${totals.lines.length} lines.`, { tone: 'ok' })
    } catch {
      toast('The CSV could not be created in this browser.', { tone: 'danger' })
    }
  }

  const approachLabel = APPROACHES.find((a) => a.value === state.approach)?.label ?? ''
  const entitiesIn = state.entities.filter((e) => (byApproach[state.approach].byEntity[e.id] ?? 0) > 0).length

  return (
    <div className="grid gap-4">
      <DemoToolbar>
        <Segmented label="Organisational boundary" options={APPROACHES.map((a) => ({ value: a.value, label: a.short }))} value={state.approach} onChange={setApproach} />
        <Segmented label="Scope 2 method" options={S2_OPTIONS} value={state.s2} onChange={(v: S2Method) => update((s) => ({ ...s, s2: v }))} />
        <label className="flex items-center gap-3 min-h-tap cursor-pointer">
          <input type="checkbox" checked={state.includeTD} onChange={(e) => update((s) => ({ ...s, includeTD: e.target.checked }))} className="size-5 accent-[var(--accent)]" />
          <span className="text-0">Derive T&amp;D losses (Scope 3 Cat 3)</span>
        </label>
        <div className="flex flex-wrap gap-2 ml-auto">
          <Button icon="download" size="sm" onClick={exportCsv} disabled={!totals.lines.length}>Export CSV</Button>
          <Button variant="secondary" size="sm" icon="refresh" onClick={() => { setRaw(SAMPLE); toast('Sample inventory restored.') }}>Sample</Button>
          <Button variant="ghost" size="sm" onClick={() => setRaw({ ...EMPTY, approach: state.approach, s2: state.s2 })}>Clear</Button>
        </div>
      </DemoToolbar>

      <Headline totals={totals} approachLabel={approachLabel} s2={state.s2} entitiesIn={entitiesIn} entitiesAll={state.entities.length} />
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoGrid
        aside={
          <>
            <DemoPanel title="Same data, three boundaries" meta="tap to switch">
              <ApproachCompare byApproach={byApproach} current={state.approach} onPick={setApproach} />
            </DemoPanel>
            <DemoPanel title="Boundary · entities" meta={`${state.entities.length} of 12`}>
              <EntitiesEditor state={state} totals={totals} onChange={patchEntity} onAdd={addEntity} onRemove={removeEntity} />
            </DemoPanel>
          </>
        }
      >
        <DemoPanel title="Stacked breakdown" meta={`${approachLabel} · ${state.s2}-based S2`}>
          {totals.lines.length ? <ScopeBreakdown totals={totals} /> : (
            <EmptyState title="No emissions in the boundary yet">
              Add an activity line below, or restore the sample inventory.
            </EmptyState>
          )}
        </DemoPanel>
        <DemoPanel title="Activity ledger" meta={`${state.activities.length} lines`}>
          <Ledger state={state} totals={totals} onChange={patchActivity} onAdd={addActivity} onRemove={removeActivity} />
        </DemoPanel>
        <DemoPanel title="Model">
          <ModelNote />
        </DemoPanel>
      </DemoGrid>

      <details className="group border border-rule rounded-2 bg-surface strata:border-rule-soft">
        <summary className="min-h-tap flex items-center gap-2 px-4 py-2 cursor-pointer mono text-ink-2 list-none [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>
          Emission factor library (editable)
          {Object.keys(state.overrides).length ? <span className="text-accent-ink">· {Object.keys(state.overrides).length} edited</span> : null}
        </summary>
        <div className="p-4 pt-0">
          <FactorTable overrides={state.overrides} onSet={setOverride} onReset={() => update((s) => ({ ...s, overrides: {} }))} />
        </div>
      </details>
    </div>
  )
}

function Headline({ totals, approachLabel, s2, entitiesIn, entitiesAll }: {
  totals: Totals
  approachLabel: string
  s2: S2Method
  entitiesIn: number
  entitiesAll: number
}) {
  return (
    <div className="grid gap-3 border-y border-rule py-3 md:grid-cols-[auto_1fr] md:items-end md:gap-6">
      <div>
        <p className="m-0 mono text-ink-3">Reported total · {approachLabel}</p>
        <p className="m-0 nums leading-none">
          <span className="font-display text-5 text-ink">{fmtT(totals.totalKg)}</span>{' '}
          <span className="mono text-ink-2">tCO₂e</span>
        </p>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="min-w-0 border-l-2 border-rule pl-2">
            <dt className="mono text-ink-3">Scope {s}{s === 2 ? ` · ${s2}` : ''}</dt>
            <dd className="m-0 font-display text-2 nums text-ink">{fmtT(totals.byScope[s])}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-00 text-ink-3 md:col-span-2">
        {entitiesIn} of {entitiesAll} entities contribute under this boundary. Figures are tonnes CO₂e; factors are illustrative and editable.
      </p>
    </div>
  )
}

function ModelNote() {
  return (
    <div className="grid gap-2 text-0 text-ink-2">
      <p tabIndex={0} className="m-0 font-mono text-ink bg-bg-2 px-3 py-2 overflow-x-auto whitespace-nowrap">
        reported = quantity × factor × inclusion(entity, boundary)
      </p>
      <ul className="m-0 pl-5 grid gap-1">
        <li><strong className="text-ink">Operational control:</strong> 100% of what you operate, 0% of the rest.</li>
        <li><strong className="text-ink">Financial control:</strong> 100% where you control policy for economic benefit; joint control takes the equity share.</li>
        <li><strong className="text-ink">Equity share:</strong> your ownership percentage of every entity.</li>
        <li><strong className="text-ink">Scope 2 market-based:</strong> subtracts the share covered by renewable contracts. T&amp;D losses stay in Scope 3 Cat 3.</li>
      </ul>
    </div>
  )
}
