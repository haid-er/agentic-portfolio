'use client'
/**
 * RBAC + audit lab: build CASL-style rules per role, ask "can X do Y on Z?", see the permission
 * matrix, then run multi-step transactions whose audit rows commit or roll back with them.
 * Runs entirely in the browser; rules persist locally.
 */
import { useMemo, useState } from 'react'
import { Button, DemoGrid, DemoPanel, useToast } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { check } from './ability'
import { AskPanel, type Question } from './AskPanel'
import { AuditTimeline } from './AuditTimeline'
import { Matrix } from './Matrix'
import { SEED_RESOURCES, SEED_ROLES, rolesSchema, userById, type Role } from './model'
import { RulesEditor } from './RulesEditor'
import { OPERATIONS, revertSteps, runTx, type TxRecord } from './tx'
import { TxPanel, type TxDraft } from './TxPanel'

export { notes } from './notes'

export default function Demo(_props: DemoProps) {
  const toast = useToast()
  const [stored, setStored] = useLocalStorage<unknown>('rbac-audit-lab:roles', SEED_ROLES)
  const parsed = useMemo(() => rolesSchema.safeParse(stored), [stored])
  const roles: Role[] = parsed.success ? parsed.data : SEED_ROLES
  const storageBad = !parsed.success

  const [q, setQ] = useState<Question>({ userId: 'u-rev-n', action: 'approve', resourceId: 'rep-w' })
  const [roleId, setRoleId] = useState('reviewer')
  const [resources, setResources] = useState(SEED_RESOURCES)
  const [txs, setTxs] = useState<TxRecord[]>([])
  const [seq, setSeq] = useState(1)
  const [draft, setDraft] = useState<TxDraft>({ opId: OPERATIONS[0]?.id ?? '', actorId: 'u-rev-n', failAt: 'none' })
  const [changed, setChanged] = useState<Set<string>>(new Set())
  const [announce, setAnnounce] = useState('')

  const user = userById(q.userId)
  const role = roles.find((r) => r.id === user.roleId)
  const resource = resources.find((r) => r.id === q.resourceId) ?? resources[0]
  const decision = resource ? check(role, user, q.action, resource) : null

  const updateRole = (next: Role) => setStored(roles.map((r) => (r.id === next.id ? next : r)))

  const commit = (tx: TxRecord, next: typeof resources) => {
    setSeq((s) => s + tx.events.length)
    setChanged(new Set(tx.outcome === 'committed' ? tx.events.flatMap((e) => (e.kind === 'write' && e.resourceId ? [e.resourceId] : [])) : []))
    setResources(next)
    const msg = tx.outcome === 'committed' ? `${tx.id} committed.` : tx.outcome === 'denied' ? `${tx.id} denied and rolled back.` : `${tx.id} failed and rolled back; no rows changed.`
    setAnnounce(msg)
    toast(msg, { tone: tx.outcome === 'committed' ? 'ok' : tx.outcome === 'denied' ? 'danger' : 'warn' })
  }

  const run = () => {
    const op = OPERATIONS.find((o) => o.id === draft.opId)
    if (!op) return
    const actor = userById(draft.actorId)
    const out = runTx({ roles, resources, user: actor, label: op.label, steps: op.steps(resources), failAt: draft.failAt === 'none' ? null : Number(draft.failAt), nextSeq: seq })
    setTxs((t) => [out.tx, ...t].slice(0, 30))
    commit(out.tx, out.resources)
  }

  const revert = (target: TxRecord) => {
    const actor = userById(draft.actorId)
    const out = runTx({ roles, resources, user: actor, label: `Revert ${target.id} · ${target.label}`, steps: revertSteps(target), failAt: null, nextSeq: seq, revertOf: target.id })
    setTxs((t) => [out.tx, ...t.map((x) => (x.id === target.id && out.tx.outcome === 'committed' ? { ...x, revertedBy: out.tx.id } : x))].slice(0, 30))
    commit(out.tx, out.resources)
  }

  const resetData = () => {
    setResources(SEED_RESOURCES)
    setTxs([])
    setSeq(1)
    setChanged(new Set())
    setAnnounce('Data and audit log reset.')
  }

  return (
    <div className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoGrid
        aside={
          <DemoPanel title="Rules" meta="CASL-style">
            {storageBad ? <p className="m-0 mb-3 text-0 text-warn">Saved rules could not be read, so the defaults are shown.</p> : null}
            <RulesEditor
              roles={roles}
              roleId={roleId}
              onRole={setRoleId}
              onChange={updateRole}
              onReset={() => { setStored(SEED_ROLES); setAnnounce('Rules reset to defaults.') }}
            />
          </DemoPanel>
        }
      >
        <DemoPanel title="Ask" meta={role ? `role: ${role.label}` : undefined}>
          {decision ? (
            <AskPanel q={q} onChange={(n) => { setQ(n); const u = userById(n.userId); setRoleId(u.roleId) }} resources={resources} decision={decision} roleLabel={role?.label ?? 'none'} />
          ) : null}
        </DemoPanel>
        <DemoPanel title="Matrix" meta={user.label}>
          <Matrix user={user} role={role} resources={resources} active={q} onPick={(action, resourceId) => setQ({ ...q, action, resourceId })} />
        </DemoPanel>
      </DemoGrid>

      <div className="grid gap-4 lg:grid-cols-2 items-start min-w-0">
        <DemoPanel title="Transaction" actions={<Button size="sm" variant="ghost" icon="refresh" onClick={resetData}>Reset data</Button>}>
          <TxPanel draft={draft} onDraft={setDraft} onRun={run} roles={roles} resources={resources} changed={changed} />
        </DemoPanel>
        <DemoPanel title="Audit log" meta={`${txs.reduce((n, t) => n + t.events.length, 0)} rows · append-only`}>
          <AuditTimeline txs={txs} onRevert={revert} newestId={txs[0]?.id ?? null} />
        </DemoPanel>
      </div>
    </div>
  )
}
