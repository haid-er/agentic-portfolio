'use client'
/**
 * CASL-style rule builder for one role: can/cannot, action, subject, conditions, reason.
 * Order matters (later rules win), so rules can be moved up and down.
 */
import { useId, useState } from 'react'
import { Button, Icon, Segmented, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { describeCondition, toBuilder, toCasl } from './ability'
import { ACTIONS, FIELDS, OPS, SUBJECTS, VALUE_HINTS, rid, type Action, type Condition, type Op, type Role, type Rule, type Subject } from './model'

const small = cx(controlClasses, 'w-auto min-w-0 px-2 font-mono text-00')

function ConditionAdder({ subject, onAdd, ruleNo }: { subject: Subject; onAdd: (c: Condition) => void; ruleNo: number }) {
  const fields = FIELDS[subject]
  const [field, setField] = useState(fields[0] ?? 'orgId')
  const [op, setOp] = useState<Op>('eq')
  const [value, setValue] = useState('{{user.orgId}}')
  const list = useId()
  const f = fields.includes(field) ? field : fields[0] ?? 'orgId'
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select aria-label={`Rule ${ruleNo} new condition field`} className={small} value={f} onChange={(e) => setField(e.target.value)}>
        {fields.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <select aria-label={`Rule ${ruleNo} new condition operator`} className={small} value={op} onChange={(e) => setOp(e.target.value as Op)}>
        {OPS.map((x) => <option key={x} value={x}>{x === 'eq' ? '=' : x === 'ne' ? '≠' : 'in'}</option>)}
      </select>
      <input
        aria-label={`Rule ${ruleNo} new condition value`}
        className={cx(small, 'w-[9.5rem]')}
        list={list}
        value={value}
        maxLength={80}
        placeholder={op === 'in' ? 'a,b,c' : 'value'}
        onChange={(e) => setValue(e.target.value)}
      />
      <datalist id={list}>{VALUE_HINTS.map((v) => <option key={v} value={v} />)}</datalist>
      <Button size="sm" variant="secondary" icon="plus" disabled={!value.trim()} onClick={() => onAdd({ field: f, op, value: value.trim() })}>Condition</Button>
    </div>
  )
}

function RuleRow({ rule, index, count, onChange, onMove, onRemove }: {
  rule: Rule
  index: number
  count: number
  onChange: (r: Rule) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
}) {
  const no = index + 1
  return (
    <li className={cx('grid gap-2 p-3 border-l-4 bg-surface border border-rule-soft rounded-0 min-w-0', rule.inverted ? 'border-l-danger' : 'border-l-ok')}>
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-mono text-00 text-ink-3 nums w-7">#{no}</span>
        <select aria-label={`Rule ${no} effect`} className={cx(small, rule.inverted ? 'text-danger' : 'text-ok')} value={rule.inverted ? 'cannot' : 'can'} onChange={(e) => onChange({ ...rule, inverted: e.target.value === 'cannot' })}>
          <option value="can">can</option>
          <option value="cannot">cannot</option>
        </select>
        <select aria-label={`Rule ${no} action`} className={small} value={rule.action} onChange={(e) => onChange({ ...rule, action: e.target.value as Action })}>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          aria-label={`Rule ${no} subject`}
          className={small}
          value={rule.subject}
          onChange={(e) => {
            const subject = e.target.value as Subject
            onChange({ ...rule, subject, conditions: rule.conditions.filter((c) => FIELDS[subject].includes(c.field)) })
          }}
        >
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto flex gap-1">
          <button type="button" className="size-11 inline-flex items-center justify-center border border-rule rounded-0 disabled:opacity-40" aria-label={`Move rule ${no} up`} disabled={index === 0} onClick={() => onMove(-1)}>
            <Icon name="arrow-up-right" size={16} className="-rotate-45" />
          </button>
          <button type="button" className="size-11 inline-flex items-center justify-center border border-rule rounded-0 disabled:opacity-40" aria-label={`Move rule ${no} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
            <Icon name="arrow-up-right" size={16} className="rotate-135" />
          </button>
          <button type="button" className="size-11 inline-flex items-center justify-center border border-danger text-danger rounded-0" aria-label={`Delete rule ${no}`} onClick={onRemove}>
            <Icon name="close" size={16} />
          </button>
        </span>
      </div>

      {rule.conditions.length ? (
        <ul className="m-0 p-0 list-none flex flex-wrap gap-1" aria-label={`Rule ${no} conditions`}>
          {rule.conditions.map((c, i) => (
            <li key={`${c.field}-${i}`} className="inline-flex items-center gap-1 pl-2 border border-rule rounded-pill bg-bg-2 font-mono text-00">
              <span className="[overflow-wrap:anywhere]">{describeCondition(c)}</span>
              <button type="button" className="size-8 inline-flex items-center justify-center rounded-pill hover:bg-surface" aria-label={`Remove condition ${describeCondition(c)} from rule ${no}`} onClick={() => onChange({ ...rule, conditions: rule.conditions.filter((_, j) => j !== i) })}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 font-mono text-00 text-ink-3">no conditions: applies to every {rule.subject === 'all' ? 'resource' : rule.subject}</p>
      )}

      {rule.conditions.length < 4 ? <ConditionAdder subject={rule.subject} ruleNo={no} onAdd={(c) => onChange({ ...rule, conditions: [...rule.conditions, c] })} /> : null}

      {rule.inverted ? (
        <input
          aria-label={`Rule ${no} reason`}
          className={cx(controlClasses, 'text-0')}
          placeholder="Reason shown when this rule denies (optional)"
          maxLength={120}
          value={rule.reason ?? ''}
          onChange={(e) => onChange({ ...rule, reason: e.target.value || undefined })}
        />
      ) : null}
    </li>
  )
}

export function RulesEditor({ roles, roleId, onRole, onChange, onReset }: {
  roles: Role[]
  roleId: string
  onRole: (id: string) => void
  onChange: (role: Role) => void
  onReset: () => void
}) {
  const role = roles.find((r) => r.id === roleId) ?? roles[0]
  if (!role) return null
  const setRules = (rules: Rule[]) => onChange({ ...role, rules })
  const move = (i: number, d: -1 | 1) => {
    const next = [...role.rules]
    const [r] = next.splice(i, 1)
    if (r) next.splice(i + d, 0, r)
    setRules(next)
  }
  return (
    <div className="grid gap-3 min-w-0">
      <Segmented label="Role" options={roles.map((r) => ({ value: r.id, label: r.label }))} value={role.id} onChange={onRole} />
      <p className="m-0 text-00 text-ink-3">Later rules override earlier ones, exactly as in CASL. A cannot rule only bites if it comes after the can rule it narrows.</p>
      {role.rules.length === 0 ? (
        <p className="m-0 p-3 border border-dashed border-rule text-0 text-ink-2">No rules: this role is denied everything.</p>
      ) : (
        <ol className="m-0 p-0 list-none grid gap-2" aria-label={`${role.label} rules`}>
          {role.rules.map((r, i) => (
            <RuleRow
              key={r.id}
              rule={r}
              index={i}
              count={role.rules.length}
              onChange={(nr) => setRules(role.rules.map((x) => (x.id === r.id ? nr : x)))}
              onMove={(d) => move(i, d)}
              onRemove={() => setRules(role.rules.filter((x) => x.id !== r.id))}
            />
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon="plus" disabled={role.rules.length >= 20} onClick={() => setRules([...role.rules, { id: rid(), action: 'read', subject: 'Report', conditions: [], inverted: false }])}>Add can</Button>
        <Button size="sm" variant="secondary" icon="minus" disabled={role.rules.length >= 20} onClick={() => setRules([...role.rules, { id: rid(), action: 'delete', subject: 'all', conditions: [], inverted: true }])}>Add cannot</Button>
        <Button size="sm" variant="ghost" icon="refresh" onClick={onReset}>Reset all roles</Button>
      </div>
      <details>
        <summary className="min-h-tap flex items-center cursor-pointer mono text-ink-2">Export as CASL</summary>
        <pre className="m-0 p-3 bg-bg-2 rounded-0 font-mono text-00 leading-relaxed overflow-auto max-h-72" tabIndex={0} aria-label="defineAbility code">{toBuilder(role)}</pre>
        <pre className="m-0 mt-2 p-3 bg-bg-2 rounded-0 font-mono text-00 leading-relaxed overflow-auto max-h-72" tabIndex={0} aria-label="Raw CASL rules JSON">{JSON.stringify(role.rules.map(toCasl), null, 2)}</pre>
      </details>
    </div>
  )
}
