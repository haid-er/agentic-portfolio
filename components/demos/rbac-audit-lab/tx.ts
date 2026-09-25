/**
 * Transactions with an audit trail. Each operation runs inside BEGIN … COMMIT: every step is
 * permission-checked against the resource as it is at that moment, then written together with
 * its audit row. On a denial or a failure the whole transaction rolls back — including the audit
 * rows written inside it — and a separate out-of-transaction row records the attempt, which is
 * how you keep a truthful log without logging writes that never happened.
 */
import { check } from './ability'
import type { Action, Attr, Resource, Role, User } from './model'

export type EventKind = 'tx.begin' | 'write' | 'tx.commit' | 'tx.rollback' | 'access.denied'
/** committed: kept with the transaction. discarded: rolled back with it. independent: written outside it. */
export type EventState = 'committed' | 'discarded' | 'independent'

export interface AuditEvent {
  seq: number
  txId: string
  at: string
  actorId: string
  kind: EventKind
  state: EventState
  action?: Action
  resourceId?: string
  before?: Record<string, Attr>
  after?: Record<string, Attr>
  note: string
}

export interface TxRecord {
  id: string
  label: string
  actorId: string
  outcome: 'committed' | 'rolled-back' | 'denied'
  events: AuditEvent[]
  revertOf?: string
  revertedBy?: string
}

export interface OpStep { action: Action; resourceId: string; set: Record<string, Attr>; label: string }

export interface Operation {
  id: string
  label: string
  description: string
  steps: (resources: Resource[]) => OpStep[]
}

const val = (resources: Resource[], id: string, key: string) => resources.find((r) => r.id === id)?.attrs[key]

export const OPERATIONS: Operation[] = [
  {
    id: 'approve-north',
    label: 'Approve + publish GHG report · North',
    description: 'Approve the report, lock both North emission lines, then publish. Four writes in one transaction.',
    steps: (): OpStep[] => [
      { action: 'approve', resourceId: 'rep-n', set: { status: 'approved' }, label: 'Approve report' },
      { action: 'update', resourceId: 'em-n2', set: { locked: true }, label: 'Lock Scope 2 line' },
      { action: 'update', resourceId: 'em-n1', set: { locked: true }, label: 'Lock Scope 1 line' },
      { action: 'update', resourceId: 'rep-n', set: { status: 'published' }, label: 'Publish report' },
    ],
  },
  {
    id: 'approve-water',
    label: 'Approve Water report · North',
    description: 'Owned by the North reviewer, so the four-eyes rule should stop that reviewer approving it.',
    steps: (): OpStep[] => [
      { action: 'approve', resourceId: 'rep-w', set: { status: 'approved' }, label: 'Approve report' },
      { action: 'update', resourceId: 'rep-w', set: { status: 'published' }, label: 'Publish report' },
    ],
  },
  {
    id: 'correct-scope2',
    label: 'Correct Scope 2 value · North',
    description: 'A single update. Denied for analysts once the line is locked by an approval.',
    steps: (rs): OpStep[] => {
      const cur = Number(val(rs, 'em-n2', 'tCO2e') ?? 0)
      return [{ action: 'update', resourceId: 'em-n2', set: { tCO2e: Math.round((cur * 0.98) * 10) / 10 }, label: 'Apply a 2% correction' }]
    },
  },
  {
    id: 'submit-south',
    label: 'Submit GHG report · South',
    description: 'Moves the South draft to submitted. Only its owner (or an admin) may.',
    steps: (): OpStep[] => [{ action: 'update', resourceId: 'rep-s', set: { status: 'submitted' }, label: 'Submit report' }],
  },
  {
    id: 'purge-log',
    label: 'Purge audit log · North',
    description: 'Should never be allowed. Note that "manage all" lets an admin do it unless you add a cannot rule.',
    steps: (): OpStep[] => [{ action: 'delete', resourceId: 'log-n', set: { purged: true }, label: 'Delete audit rows' }],
  },
]

export const SIMULATED_FAILURE = 'ERROR 40001: could not serialize access due to concurrent update (simulated)'

interface RunArgs {
  roles: Role[]
  resources: Resource[]
  user: User
  label: string
  steps: OpStep[]
  /** Throw a simulated DB error just before this step index (0-based). */
  failAt: number | null
  nextSeq: number
  revertOf?: string
}

export function runTx({ roles, resources, user, label, steps, failAt, nextSeq, revertOf }: RunArgs): { resources: Resource[]; tx: TxRecord } {
  const txId = `tx-${nextSeq.toString().padStart(3, '0')}`
  let seq = nextSeq
  const events: AuditEvent[] = []
  const at = () => new Date().toISOString()
  const push = (e: Omit<AuditEvent, 'seq' | 'txId' | 'at' | 'actorId'>) => events.push({ seq: seq++, txId, at: at(), actorId: user.id, ...e })
  const role = roles.find((r) => r.id === user.roleId)
  // Work on a copy: this is the transaction's private view until COMMIT.
  let working: Resource[] = resources.map((r) => ({ ...r, attrs: { ...r.attrs } }))

  const rollback = (why: string, outcome: TxRecord['outcome']) => {
    for (const e of events) if (e.state === 'committed') e.state = 'discarded'
    push({ kind: 'tx.rollback', state: 'independent', note: why })
    return { resources, tx: { id: txId, label, actorId: user.id, outcome, events, revertOf } }
  }

  push({ kind: 'tx.begin', state: 'committed', note: `BEGIN · ${label}` })

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as OpStep
    const target = working.find((r) => r.id === step.resourceId)
    if (!target) return rollback(`Resource ${step.resourceId} does not exist`, 'rolled-back')
    const decision = check(role, user, step.action, target)
    if (!decision.allowed) {
      push({ kind: 'access.denied', state: 'independent', action: step.action, resourceId: target.id, note: `${step.label}: ${decision.reason}` })
      return rollback(`ROLLBACK · permission denied at step ${i + 1}`, 'denied')
    }
    if (failAt === i) return rollback(`ROLLBACK · ${SIMULATED_FAILURE} at step ${i + 1}`, 'rolled-back')
    const before = Object.fromEntries(Object.keys(step.set).map((k) => [k, target.attrs[k] as Attr]))
    working = working.map((r) => (r.id === target.id ? { ...r, attrs: { ...r.attrs, ...step.set } } : r))
    push({ kind: 'write', state: 'committed', action: step.action, resourceId: target.id, before, after: { ...step.set }, note: step.label })
  }

  push({ kind: 'tx.commit', state: 'committed', note: `COMMIT · ${steps.length} write${steps.length === 1 ? '' : 's'}` })
  return { resources: working, tx: { id: txId, label, actorId: user.id, outcome: 'committed', events, revertOf } }
}

/** Compensating steps for a committed transaction: restore each "before", newest first. */
export function revertSteps(tx: TxRecord): OpStep[] {
  return tx.events
    .filter((e) => e.kind === 'write' && e.state === 'committed' && e.resourceId && e.before)
    .reverse()
    .map((e) => ({ action: 'update' as Action, resourceId: e.resourceId as string, set: e.before as Record<string, Attr>, label: `Undo: ${e.note}` }))
}
