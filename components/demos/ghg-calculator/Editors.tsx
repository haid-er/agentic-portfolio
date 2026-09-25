'use client'
/** Boundary (entities) and activity-ledger editors. Every control has a visible label and a 44px target. */
import { useEffect, useState } from 'react'
import { Badge, Button, Field, Select, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import {
  CATEGORIES, FACTORS, MAX_ACTIVITIES, MAX_ENTITIES, categoryOf, factorById, fmtPct, fmtT, inclusion, inclusionReason,
  type Activity, type Approach, type CalcState, type Entity, type FinancialControl, type Totals,
} from './model'

/** Numeric input that lets people type freely ("", "1.") and commits clean numbers. */
export function NumField({ label, value, onChange, min = 0, max, step, suffix, className, hint }: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  className?: string
  hint?: string
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setDraft(String(value)) }, [value, focused])
  const n = Number(draft)
  const error = draft.trim() === '' ? undefined
    : !Number.isFinite(n) ? 'Enter a number'
    : n < min ? `Minimum ${min}`
    : max !== undefined && n > max ? `Maximum ${max.toLocaleString('en-GB')}`
    : undefined
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step ?? 'any'}
            value={draft}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); setDraft(String(value)) }}
            onChange={(e) => {
              setDraft(e.target.value)
              const v = Number(e.target.value)
              if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= min && (max === undefined || v <= max)) onChange(v)
            }}
            className={cx(controlClasses, 'nums', suffix && 'pr-16')}
          />
          {suffix ? <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 mono text-ink-3">{suffix}</span> : null}
        </div>
      )}
    </Field>
  )
}

const FIN_LABEL: Record<FinancialControl, string> = { full: 'Full', joint: 'Joint', none: 'None' }

export function EntitiesEditor({ state, totals, onChange, onAdd, onRemove }: {
  state: CalcState
  totals: Totals
  onChange: (id: string, patch: Partial<Entity>) => void
  onAdd: () => void
  onRemove: (e: Entity) => void
}) {
  return (
    <div className="grid gap-3">
      <ul className="m-0 p-0 list-none grid gap-3">
        {state.entities.map((e) => (
          <EntityRow key={e.id} e={e} approach={state.approach} reportedKg={totals.byEntity[e.id] ?? 0}
            canRemove={state.entities.length > 1} onChange={(p) => onChange(e.id, p)} onRemove={() => onRemove(e)} />
        ))}
      </ul>
      <Button variant="secondary" size="sm" icon="plus" onClick={onAdd} disabled={state.entities.length >= MAX_ENTITIES} className="justify-self-start">
        Add entity
      </Button>
    </div>
  )
}

function EntityRow({ e, approach, reportedKg, canRemove, onChange, onRemove }: {
  e: Entity
  approach: Approach
  reportedKg: number
  canRemove: boolean
  onChange: (p: Partial<Entity>) => void
  onRemove: () => void
}) {
  const inc = inclusion(e, approach)
  return (
    <li className="grid gap-2 p-3 border border-rule-soft rounded-1 bg-bg">
      <div className="flex items-end gap-2">
        <Field label="Entity" className="flex-1">
          {({ id }) => (
            <input id={id} value={e.name} maxLength={60} onChange={(ev) => onChange({ name: ev.target.value })} className={controlClasses} />
          )}
        </Field>
        {canRemove ? (
          <Button variant="ghost" size="sm" icon="close" onClick={onRemove} aria-label={`Remove ${e.name || 'entity'}`} className="px-2" />
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Equity" value={e.equity} min={0} max={100} suffix="%" onChange={(v) => onChange({ equity: v })} />
        <Select label="Financial ctrl" value={e.financial} onChange={(ev) => onChange({ financial: ev.target.value as FinancialControl })}>
          {(['full', 'joint', 'none'] as const).map((f) => <option key={f} value={f}>{FIN_LABEL[f]}</option>)}
        </Select>
      </div>
      <label className="flex items-center gap-3 min-h-tap cursor-pointer">
        <input type="checkbox" checked={e.operational} onChange={(ev) => onChange({ operational: ev.target.checked })} className="size-5 accent-[var(--accent)]" />
        <span className="text-0">We have operational control</span>
      </label>
      <p className="m-0 flex flex-wrap items-center gap-2 text-0">
        <Badge tone={inc === 0 ? 'neutral' : inc === 1 ? 'ok' : 'accent'}>{inc === 0 ? 'Excluded' : `Included ${fmtPct(+(inc * 100).toFixed(1))}`}</Badge>
        <span className="text-ink-3">{inclusionReason(e, approach)}</span>
        <span className="ml-auto mono nums text-ink-2">{fmtT(reportedKg)} t</span>
      </p>
    </li>
  )
}

export function Ledger({ state, totals, onChange, onAdd, onRemove }: {
  state: CalcState
  totals: Totals
  onChange: (id: string, patch: Partial<Activity>) => void
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  const reported = new Map<string, number>()
  for (const l of totals.lines) reported.set(l.activityId, (reported.get(l.activityId) ?? 0) + (l.derived ? 0 : l.reportedKg))
  return (
    <div className="grid gap-3">
      {state.activities.length === 0 ? null : (
        <ol className="m-0 p-0 list-none grid gap-3">
          {state.activities.map((a, i) => (
            <ActivityRow key={a.id} n={i + 1} a={a} state={state} reportedKg={reported.get(a.id) ?? 0}
              onChange={(p) => onChange(a.id, p)} onRemove={() => onRemove(a.id)} />
          ))}
        </ol>
      )}
      <Button variant="secondary" size="sm" icon="plus" onClick={onAdd} disabled={state.activities.length >= MAX_ACTIVITIES} className="justify-self-start">
        Add activity line
      </Button>
    </div>
  )
}

function ActivityRow({ n, a, state, reportedKg, onChange, onRemove }: {
  n: number
  a: Activity
  state: CalcState
  reportedKg: number
  onChange: (p: Partial<Activity>) => void
  onRemove: () => void
}) {
  const f = factorById(a.factorId)
  const cat = f ? categoryOf(f.category) : undefined
  const isElec = cat?.id === 's2-electricity'
  return (
    <li className="grid gap-2 p-3 border border-rule-soft rounded-1 bg-bg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-ink-3 nums">Line {String(n).padStart(2, '0')}</span>
        {cat ? <Badge tone="neutral">Scope {cat.scope}</Badge> : null}
        {cat ? <span className="text-00 text-ink-3 min-w-0 truncate">{cat.label}</span> : null}
        <span className="ml-auto mono nums text-ink">{fmtT(reportedKg)} tCO₂e</span>
        <Button variant="ghost" size="sm" icon="close" onClick={onRemove} aria-label={`Remove line ${n}`} className="px-2" />
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <Select label="Entity" value={a.entityId} onChange={(e) => onChange({ entityId: e.target.value })}>
          {state.entities.map((e) => <option key={e.id} value={e.id}>{e.name || 'Unnamed entity'}</option>)}
        </Select>
        <Select label="Activity" value={a.factorId} onChange={(e) => onChange({ factorId: e.target.value })}>
          {CATEGORIES.filter((c) => c.id !== 's3-c3').map((c) => (
            <optgroup key={c.id} label={`Scope ${c.scope} · ${c.label}`}>
              {FACTORS.filter((x) => x.category === c.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </optgroup>
          ))}
        </Select>
        <NumField label="Quantity" value={a.quantity} max={1e12} suffix={f?.unit} onChange={(v) => onChange({ quantity: v })} />
      </div>
      {isElec && state.s2 === 'market' ? (
        <NumField label="Covered by renewable contracts (REGOs / PPA)" value={a.renewablePct ?? 0} min={0} max={100} suffix="%"
          hint="Market-based only. The uncovered share uses the grid factor as a stand-in for a residual mix."
          onChange={(v) => onChange({ renewablePct: v })} />
      ) : null}
    </li>
  )
}
