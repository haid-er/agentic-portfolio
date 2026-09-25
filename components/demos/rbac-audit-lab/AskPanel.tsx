'use client'
/** "Can X do Y on Z?" — the verdict, the deciding rule, and every rule the check read on the way. */
import { Badge, Icon, Select } from '@/components/ui'
import { cx } from '@/lib/utils'
import { describeCondition, describeRule, type Considered, type Decision } from './ability'
import { ACTIONS, USERS, type Action, type Resource } from './model'

export interface Question { userId: string; action: Action; resourceId: string }

function whyText(c: Considered): string {
  switch (c.result) {
    case 'decided': return c.rule.inverted ? 'matches: denies' : 'matches: allows'
    case 'skipped-action': return `action is ${c.rule.action}`
    case 'skipped-subject': return `subject is ${c.rule.subject}`
    case 'not-reached': return 'not reached'
    case 'conditions-failed': {
      const f = c.failed
      if (!f) return 'conditions failed'
      return `${describeCondition(f.condition)} fails: ${f.condition.field} is ${f.actual === undefined ? 'missing' : String(f.actual)}${f.condition.op === 'eq' ? `, needs ${f.expected}` : ''}`
    }
  }
}

export function AskPanel({ q, onChange, resources, decision, roleLabel }: {
  q: Question
  onChange: (q: Question) => void
  resources: Resource[]
  decision: Decision
  roleLabel: string
}) {
  const res = resources.find((r) => r.id === q.resourceId)
  return (
    <div className="grid gap-4 min-w-0">
      <div className="grid gap-2 xs:grid-cols-3 items-end">
        <Select label="Can" value={q.userId} onChange={(e) => onChange({ ...q, userId: e.target.value })}>
          {USERS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </Select>
        <Select label="do" value={q.action} onChange={(e) => onChange({ ...q, action: e.target.value as Action })}>
          {ACTIONS.filter((a) => a !== 'manage').map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select label="on" value={q.resourceId} onChange={(e) => onChange({ ...q, resourceId: e.target.value })}>
          {resources.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>
      </div>

      <div
        aria-live="polite"
        className={cx(
          'grid gap-2 p-4 border-2 rounded-1 bg-bg-2',
          decision.allowed ? 'border-ok' : 'border-danger',
          'almanac:-rotate-[0.4deg]',
        )}
      >
        <p className={cx('m-0 flex items-center gap-2 display text-3 leading-none', decision.allowed ? 'text-ok' : 'text-danger')}>
          <Icon name={decision.allowed ? 'check' : 'close'} size={28} />
          {decision.allowed ? 'Allowed' : 'Denied'}
        </p>
        <p className="m-0 text-0 text-ink">{decision.reason}</p>
        {res ? (
          <p className="m-0 font-mono text-00 text-ink-3 [overflow-wrap:anywhere]">
            {res.subject} {JSON.stringify(res.attrs)} · role {roleLabel}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1 min-w-0">
        <p className="m-0 mono text-ink-3">Evaluation order: last rule first</p>
        {decision.considered.length === 0 ? (
          <p className="m-0 text-0 text-ink-2">This role has no rules, so every check is denied.</p>
        ) : (
          <ol className="m-0 p-0 list-none grid gap-1" aria-label="Rules considered">
            {decision.considered.map((c) => (
              <li
                key={c.rule.id}
                className={cx(
                  'grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-3 py-2 border-l-4 rounded-0',
                  c.result === 'decided' ? (c.rule.inverted ? 'border-danger bg-bg-2' : 'border-ok bg-bg-2') : 'border-rule-soft',
                  c.result === 'not-reached' && 'opacity-60',
                )}
              >
                <span className="font-mono text-00 text-ink-3 nums pt-[2px]">#{c.index + 1}</span>
                <span className="grid gap-[2px] min-w-0">
                  <span className="font-mono text-00 text-ink [overflow-wrap:anywhere]">{describeRule(c.rule)}</span>
                  <span className="flex flex-wrap items-center gap-2 text-00 text-ink-2">
                    {c.result === 'decided' ? <Badge tone={c.rule.inverted ? 'danger' : 'ok'}>decides</Badge> : null}
                    {whyText(c)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
