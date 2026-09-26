'use client'
/** Pick an operation and an actor, optionally inject a DB failure, run it as one transaction. */
import { Badge, Button, Icon, Select, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import { check } from './ability'
import { USERS, userById, type Attr, type Resource, type Role } from './model'
import { OPERATIONS } from './tx'

export interface TxDraft { opId: string; actorId: string; failAt: string }

const fmt = (v: Attr | undefined) => (v === undefined ? '' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v))

export function TxPanel({ draft, onDraft, onRun, roles, resources, changed }: {
  draft: TxDraft
  onDraft: (d: TxDraft) => void
  onRun: () => void
  roles: Role[]
  resources: Resource[]
  changed: Set<string>
}) {
  const op = OPERATIONS.find((o) => o.id === draft.opId) ?? OPERATIONS[0]
  if (!op) return null
  const steps = op.steps(resources)
  const actor = userById(draft.actorId)
  const role = roles.find((r) => r.id === actor.roleId)

  // Pre-flight: walk the steps against a scratch copy so later steps see earlier writes.
  let scratch = resources
  const preflight = steps.map((s) => {
    const target = scratch.find((r) => r.id === s.resourceId)
    const ok = target ? check(role, actor, s.action, target).allowed : false
    if (ok && target) scratch = scratch.map((r) => (r.id === target.id ? { ...r, attrs: { ...r.attrs, ...s.set } } : r))
    return ok
  })

  return (
    <div className="grid gap-4 min-w-0">
      <div className="grid gap-2 xs:grid-cols-2">
        <Select label="Operation" value={op.id} onChange={(e) => onDraft({ ...draft, opId: e.target.value, failAt: 'none' })}>
          {OPERATIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Select>
        <Select label="Acting as" value={draft.actorId} onChange={(e) => onDraft({ ...draft, actorId: e.target.value })}>
          {USERS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Select>
      </div>
      <p className="m-0 text-0 text-ink-2 measure">{op.description}</p>

      <ol className="m-0 p-0 list-none grid gap-1" aria-label="Transaction steps with pre-flight permission check">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 bg-bg-2 rounded-0 min-w-0">
            <span className="font-mono text-00 text-ink-3 nums">{i + 1}</span>
            <span className="text-0 flex-1 min-w-[8rem]">{s.label}</span>
            <code className="font-mono text-00 text-ink-2">{s.action} {s.resourceId}</code>
            <span className={cx('inline-flex items-center gap-1 font-mono text-00', preflight[i] ? 'text-ok' : 'text-danger')}>
              <Icon name={preflight[i] ? 'check' : 'close'} size={14} />
              {preflight[i] ? 'allowed' : 'denied'}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-3">
        <Select label="Inject DB failure" wrapperClassName="min-w-[12rem]" value={draft.failAt} onChange={(e) => onDraft({ ...draft, failAt: e.target.value })}>
          <option value="none">No failure</option>
          {steps.map((_, i) => <option key={i} value={String(i)}>Before step {i + 1}</option>)}
        </Select>
        <Button variant="primary" icon="play" onClick={onRun}>Run transaction</Button>
      </div>

      <div className="grid gap-1 min-w-0">
        <p className="m-0 mono text-ink-3">Committed rows</p>
        <TableWrap label="Current committed data">
          <Table>
            <thead>
              <tr><Th>Resource</Th><Th>status</Th><Th>locked</Th><Th className="text-right">tCO2e</Th></tr>
            </thead>
            <tbody>
              {resources.filter((r) => r.subject !== 'AuditLog').map((r) => (
                <tr key={r.id} className={cx(changed.has(r.id) && 'bg-bg-2')}>
                  <Td>
                    <span className="block text-0">{r.label}</span>
                    {changed.has(r.id) ? <Badge tone="accent" className="mt-1">changed</Badge> : null}
                  </Td>
                  <Td className="font-mono text-00">{fmt(r.attrs.status)}</Td>
                  <Td className="font-mono text-00">{fmt(r.attrs.locked)}</Td>
                  <Td className="font-mono text-00 text-right">{fmt(r.attrs.tCO2e)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        <p className="m-0 text-00 text-ink-3">Sample rows only. Nothing leaves your browser.</p>
      </div>
    </div>
  )
}
