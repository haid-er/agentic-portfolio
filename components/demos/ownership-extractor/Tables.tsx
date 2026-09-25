'use client'
/** Editable entity + link tables. Every edit recomputes the consolidation upstream. */
import { useState } from 'react'
import { Badge, Button, Table, TableWrap, Td, Th } from '@/components/ui'
import { controlClasses } from '@/components/ui/Field'
import { cx } from '@/lib/utils'
import {
  type Approach, type Consolidation, type Control, type Group, type Link,
  APPROACH_LABEL, CONTROL_LABEL, fmtPct, fmtT, shareFor, slugId, uniqueId,
} from './model'

const CONTROLS = Object.keys(CONTROL_LABEL) as Control[]
const cell = cx(controlClasses, 'min-h-[40px] py-1 px-2 text-0')

export function EntityTable({ group, result, approach, selected, onSelect, onChange }: {
  group: Group
  result: Consolidation
  approach: Approach
  selected: string | null
  onSelect: (id: string) => void
  onChange: (g: Group) => void
}) {
  const setEmissions = (id: string, raw: string) => {
    const v = raw.trim() === '' ? null : Math.max(0, Number(raw))
    onChange({ ...group, entities: group.entities.map((e) => (e.id === id ? { ...e, emissions: v != null && Number.isFinite(v) ? v : null } : e)) })
  }
  return (
    <TableWrap label="Entities and consolidated emissions">
      <Table className="min-w-[640px]">
        <thead>
          <tr>
            <Th>Entity</Th>
            <Th className="text-right">tCO2e (100%)</Th>
            <Th className="text-right">Equity</Th>
            <Th className="text-right">Fin. control</Th>
            <Th className="text-right">Op. control</Th>
            <Th className="text-right">{APPROACH_LABEL[approach]} t</Th>
          </tr>
        </thead>
        <tbody>
          {group.entities.map((e) => {
            const r = result.byId[e.id]
            const share = shareFor(r, approach)
            return (
              <tr key={e.id} className={cx(selected === e.id && 'bg-bg-2')}>
                <Td>
                  <button type="button" onClick={() => onSelect(e.id)} className="text-left underline decoration-rule underline-offset-2 hover:decoration-accent min-h-[40px]">
                    {e.name}
                  </button>
                  {e.id === group.parentId ? <Badge tone="accent" className="ml-2">parent</Badge> : null}
                </Td>
                <Td className="text-right">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    aria-label={`Scope 1 and 2 emissions of ${e.name}, tonnes CO2e`}
                    value={e.emissions ?? ''}
                    placeholder="—"
                    onChange={(ev) => setEmissions(e.id, ev.target.value)}
                    className={cx(cell, 'w-[7.5rem] text-right nums')}
                  />
                </Td>
                <Td className="text-right">{fmtPct(r?.equity ?? 0)}</Td>
                <Td className="text-right">{fmtPct(r?.financial ?? 0)}</Td>
                <Td className="text-right">{fmtPct(r?.operational ?? 0)}</Td>
                <Td className="text-right font-semibold">{e.emissions == null ? '—' : fmtT(e.emissions * share)}</Td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <Td className="mono text-ink-3">Consolidated</Td>
            <Td className="text-right text-ink-3">{fmtT(result.gross)}</Td>
            <Td className="text-right">{fmtT(result.totals.equity)}</Td>
            <Td className="text-right">{fmtT(result.totals.financial)}</Td>
            <Td className="text-right">{fmtT(result.totals.operational)}</Td>
            <Td className="text-right font-semibold">{fmtT(result.totals[approach])}</Td>
          </tr>
        </tfoot>
      </Table>
    </TableWrap>
  )
}

export function LinkTable({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const names = new Map(group.entities.map((e) => [e.id, e.name]))
  const [owner, setOwner] = useState(group.parentId)
  const [owned, setOwned] = useState('')
  const [newName, setNewName] = useState('')

  const patch = (id: string, p: Partial<Link>) => onChange({ ...group, links: group.links.map((l) => (l.id === id ? { ...l, ...p } : l)) })
  const remove = (id: string) => onChange({ ...group, links: group.links.filter((l) => l.id !== id) })

  const addLink = () => {
    let g = group
    let target = owned
    if (target === '__new') {
      const name = newName.trim()
      if (!name) return
      const id = uniqueId(slugId(name), new Set(g.entities.map((e) => e.id)))
      g = { ...g, entities: [...g.entities, { id, name, emissions: null }] }
      target = id
      setNewName('')
    }
    if (!target || target === owner) return
    const id = uniqueId(`${owner}--${target}`, new Set(g.links.map((l) => l.id)))
    onChange({ ...g, links: [...g.links, { id, owner, owned: target, equityPct: 100, control: 'unstated' }] })
    setOwned('')
  }

  return (
    <div className="grid gap-3">
      <TableWrap label="Ownership links">
        <Table className="min-w-[620px]">
          <thead>
            <tr><Th>Owner</Th><Th>Owns</Th><Th className="text-right">Equity %</Th><Th>Control</Th><Th><span className="sr-only">Remove</span></Th></tr>
          </thead>
          <tbody>
            {group.links.map((l) => (
              <tr key={l.id}>
                <Td>{names.get(l.owner) ?? l.owner}</Td>
                <Td>{names.get(l.owned) ?? l.owned}</Td>
                <Td className="text-right">
                  <input
                    type="number" min={0} max={100} step="any" inputMode="decimal"
                    aria-label={`Equity percent ${names.get(l.owner)} holds in ${names.get(l.owned)}`}
                    value={l.equityPct}
                    onChange={(e) => patch(l.id, { equityPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    className={cx(cell, 'w-[5.5rem] text-right nums')}
                  />
                </Td>
                <Td>
                  <select
                    aria-label={`Control ${names.get(l.owner)} has over ${names.get(l.owned)}`}
                    value={l.control}
                    onChange={(e) => patch(l.id, { control: e.target.value as Control })}
                    className={cx(cell, 'w-[14rem]')}
                  >
                    {CONTROLS.map((c) => <option key={c} value={c}>{CONTROL_LABEL[c]}</option>)}
                  </select>
                </Td>
                <Td>
                  <Button variant="ghost" size="sm" icon="close" aria-label={`Remove link ${names.get(l.owner)} to ${names.get(l.owned)}`} onClick={() => remove(l.id)} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <fieldset className="grid gap-2 xs:grid-cols-[1fr_1fr_auto] items-end border border-dashed border-rule rounded-1 p-3">
        <legend className="mono text-ink-2 px-1">Add a link</legend>
        <label className="grid gap-1">
          <span className="mono text-ink-3">Owner</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={cell}>
            {group.entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="mono text-ink-3">Owns</span>
          <select value={owned} onChange={(e) => setOwned(e.target.value)} className={cell}>
            <option value="">Choose…</option>
            {group.entities.filter((e) => e.id !== owner).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            <option value="__new">+ New entity…</option>
          </select>
        </label>
        <Button variant="secondary" size="sm" icon="plus" onClick={addLink} disabled={!owned || (owned === '__new' && !newName.trim())}>Add</Button>
        {owned === '__new' ? (
          <label className="grid gap-1 xs:col-span-3">
            <span className="mono text-ink-3">New entity name</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} className={cell} placeholder="e.g. Aster Hydrogen Ltd" />
          </label>
        ) : null}
      </fieldset>
    </div>
  )
}
