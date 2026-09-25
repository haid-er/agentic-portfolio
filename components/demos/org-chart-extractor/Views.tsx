'use client'
/** Outline (collapsible tree), editable table, and the inspector that edits one person. */
import { useState } from 'react'
import { Button, Table, TableWrap, Td, Th } from '@/components/ui'
import { controlClasses } from '@/components/ui/Field'
import { cx } from '@/lib/utils'
import { childrenOf, type Person, wouldCycle } from './model'

const cell = cx(controlClasses, 'min-h-[40px] py-1 px-2 text-0')

/* ------------------------------------------------------------------ */
/* Outline                                                              */
/* ------------------------------------------------------------------ */

export function OutlineView({ people, selected, onSelect }: { people: Person[]; selected: string | null; onSelect: (id: string) => void }) {
  const kids = childrenOf(people)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setClosed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const branch = (list: Person[], level: number) => (
    <ul className={cx('m-0 p-0 list-none grid gap-1', level > 0 && 'ml-3 pl-3 border-l border-rule')}>
      {list.map((p) => {
        const cs = kids.get(p.id) ?? []
        const open = !closed.has(p.id)
        return (
          <li key={p.id} className="relative">
            {level > 0 ? <span aria-hidden="true" className="absolute -left-3 top-[22px] w-3 border-t border-rule" /> : null}
            <div className={cx('flex items-stretch gap-1 border rounded-1 bg-surface', selected === p.id ? 'border-accent border-2' : 'border-rule')}>
              {cs.length ? (
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-expanded={open}
                  aria-label={`${open ? 'Collapse' : 'Expand'} ${p.name}'s ${cs.length} reports`}
                  className="w-10 shrink-0 grid place-items-center mono text-ink-2 border-r border-rule-soft hover:bg-bg-2"
                >
                  {open ? '−' : '+'}
                </button>
              ) : <span className="w-10 shrink-0 grid place-items-center text-ink-3 border-r border-rule-soft" aria-hidden="true">·</span>}
              <button type="button" onClick={() => onSelect(p.id)} aria-pressed={selected === p.id} className="flex-1 min-w-0 text-left px-3 py-2 min-h-tap hover:bg-bg-2">
                <span className="block font-semibold truncate">{p.name}</span>
                <span className="block text-0 text-ink-2 truncate">
                  {p.title || <span className="text-ink-3">no title</span>}
                  {p.department ? <span className="mono text-ink-3"> · {p.department}</span> : null}
                </span>
              </button>
              {cs.length ? <span className="self-center mono text-ink-3 pr-3" aria-hidden="true">{cs.length}</span> : null}
            </div>
            {cs.length && open ? <div className="mt-1">{branch(cs, level + 1)}</div> : null}
          </li>
        )
      })}
    </ul>
  )

  return <nav aria-label="Organisation outline">{branch(kids.get(null) ?? [], 0)}</nav>
}

/* ------------------------------------------------------------------ */
/* Table                                                                */
/* ------------------------------------------------------------------ */

export function TableView({ people, onChange, onSelect }: { people: Person[]; onChange: (id: string, patch: Partial<Person>) => void; onSelect: (id: string) => void }) {
  return (
    <TableWrap label="Organisation table (editable)">
      <Table className="min-w-[720px]">
        <thead>
          <tr><Th>Name</Th><Th>Title</Th><Th>Department</Th><Th>Reports to</Th><Th><span className="sr-only">Select</span></Th></tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <Td><input aria-label={`Name of ${p.name}`} value={p.name} maxLength={80} onChange={(e) => onChange(p.id, { name: e.target.value })} className={cell} /></Td>
              <Td><input aria-label={`Title of ${p.name}`} value={p.title} maxLength={80} onChange={(e) => onChange(p.id, { title: e.target.value })} className={cell} /></Td>
              <Td><input aria-label={`Department of ${p.name}`} value={p.department} maxLength={60} onChange={(e) => onChange(p.id, { department: e.target.value })} className={cell} /></Td>
              <Td><ManagerSelect people={people} person={p} onChange={(m) => onChange(p.id, { managerId: m })} /></Td>
              <Td><Button size="sm" variant="ghost" onClick={() => onSelect(p.id)} aria-label={`Open ${p.name} in the inspector`}>Edit</Button></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  )
}

function ManagerSelect({ people, person, onChange, id }: { people: Person[]; person: Person; onChange: (m: string | null) => void; id?: string }) {
  return (
    <select
      id={id}
      aria-label={id ? undefined : `${person.name} reports to`}
      value={person.managerId ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={cx(cell, 'min-w-[10rem]')}
    >
      <option value="">— top level —</option>
      {people.filter((o) => o.id !== person.id).map((o) => (
        <option key={o.id} value={o.id} disabled={wouldCycle(people, person.id, o.id)}>{o.name}</option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------ */
/* Inspector                                                            */
/* ------------------------------------------------------------------ */

export function Inspector({ people, person, onChange, onAddReport, onDelete }: {
  people: Person[]
  person: Person | undefined
  onChange: (id: string, patch: Partial<Person>) => void
  onAddReport: (managerId: string | null) => void
  onDelete: (id: string) => void
}) {
  if (!person) {
    return (
      <div className="grid gap-3">
        <p className="m-0 text-0 text-ink-2">Select a box in the chart or outline to edit it.</p>
        <Button variant="secondary" size="sm" icon="plus" onClick={() => onAddReport(null)}>Add a top-level person</Button>
      </div>
    )
  }
  const reports = people.filter((p) => p.managerId === person.id).length
  const field = (label: string, key: 'name' | 'title' | 'department', max: number) => (
    <label className="grid gap-1">
      <span className="mono text-ink-2">{label}</span>
      <input value={person[key]} maxLength={max} onChange={(e) => onChange(person.id, { [key]: e.target.value })} className={cx(controlClasses)} />
    </label>
  )
  return (
    <div className="grid gap-3" key={person.id}>
      {field('Name', 'name', 80)}
      {field('Title', 'title', 80)}
      {field('Department', 'department', 60)}
      <label className="grid gap-1" htmlFor={`mgr-${person.id}`}>
        <span className="mono text-ink-2">Reports to</span>
        <ManagerSelect id={`mgr-${person.id}`} people={people} person={person} onChange={(m) => onChange(person.id, { managerId: m })} />
      </label>
      <p className="m-0 mono text-ink-3">{reports} direct report{reports === 1 ? '' : 's'}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon="plus" onClick={() => onAddReport(person.id)}>Add report</Button>
        <Button variant="danger" size="sm" icon="close" onClick={() => onDelete(person.id)}>Delete</Button>
      </div>
      {reports ? <p className="m-0 text-00 text-ink-3">Deleting moves their reports up one level.</p> : null}
    </div>
  )
}
