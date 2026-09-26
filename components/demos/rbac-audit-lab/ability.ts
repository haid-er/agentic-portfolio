/**
 * A small CASL-compatible ability check. Semantics match @casl/ability:
 *  - `manage` matches every action, `all` matches every subject;
 *  - rules are read from last to first, and the first one whose conditions match decides;
 *  - an inverted rule (`cannot`) denies; if no rule matches, the answer is deny.
 */
import type { Action, Attr, Condition, Resource, Role, Rule, User } from './model'

export interface Considered {
  rule: Rule
  index: number
  /** Why this rule did or didn't decide. */
  result: 'decided' | 'skipped-action' | 'skipped-subject' | 'conditions-failed' | 'not-reached'
  failed?: { condition: Condition; actual: Attr | undefined; expected: string }
}

export interface Decision {
  allowed: boolean
  rule: Rule | null
  index: number
  reason: string
  considered: Considered[]
}

export function resolveValue(raw: string, user: User): string {
  return raw.replace(/\{\{\s*user\.id\s*\}\}/g, user.id).replace(/\{\{\s*user\.orgId\s*\}\}/g, user.orgId)
}

const same = (actual: Attr | undefined, expected: string) => actual !== undefined && String(actual) === expected

export function conditionHolds(cond: Condition, attrs: Record<string, Attr>, user: User): { ok: boolean; expected: string } {
  const expected = resolveValue(cond.value, user)
  const actual = attrs[cond.field]
  if (cond.op === 'eq') return { ok: same(actual, expected), expected }
  if (cond.op === 'ne') return { ok: !same(actual, expected), expected }
  const list = expected.split(',').map((s) => s.trim()).filter(Boolean)
  return { ok: list.some((v) => same(actual, v)), expected: `[${list.join(', ')}]` }
}

export function check(role: Role | undefined, user: User, action: Action, resource: Resource): Decision {
  const rules = role?.rules ?? []
  const considered: Considered[] = []
  let decided: Considered | null = null
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i] as Rule
    if (decided) { considered.push({ rule, index: i, result: 'not-reached' }); continue }
    if (rule.action !== 'manage' && rule.action !== action) { considered.push({ rule, index: i, result: 'skipped-action' }); continue }
    if (rule.subject !== 'all' && rule.subject !== resource.subject) { considered.push({ rule, index: i, result: 'skipped-subject' }); continue }
    let failed: Considered['failed']
    for (const cond of rule.conditions) {
      const r = conditionHolds(cond, resource.attrs, user)
      if (!r.ok) { failed = { condition: cond, actual: resource.attrs[cond.field], expected: r.expected }; break }
    }
    if (failed) { considered.push({ rule, index: i, result: 'conditions-failed', failed }); continue }
    decided = { rule, index: i, result: 'decided' }
    considered.push(decided)
  }
  if (!decided) {
    return { allowed: false, rule: null, index: -1, reason: 'No rule matched, so the default is deny.', considered }
  }
  const allowed = !decided.rule.inverted
  const reason = allowed
    ? `Rule #${decided.index + 1} (${describeRule(decided.rule)}) matched.`
    : decided.rule.reason ?? `Rule #${decided.index + 1} (${describeRule(decided.rule)}) forbids it.`
  return { allowed, rule: decided.rule, index: decided.index, reason, considered }
}

export function describeCondition(c: Condition): string {
  const sym = c.op === 'eq' ? '=' : c.op === 'ne' ? '≠' : 'in'
  return `${c.field} ${sym} ${c.op === 'in' ? `[${c.value}]` : c.value}`
}

export function describeRule(r: Rule): string {
  const head = `${r.inverted ? 'cannot' : 'can'} ${r.action} ${r.subject}`
  return r.conditions.length ? `${head} where ${r.conditions.map(describeCondition).join(' and ')}` : head
}

/** Convert a rule to CASL's raw JSON (Mongo-style conditions, `${user.x}` placeholders). */
export function toCasl(r: Rule): Record<string, unknown> {
  const tpl = (v: string) => v.replace(/\{\{\s*user\.(\w+)\s*\}\}/g, '${user.$1}')
  const lit = (v: string): Attr => (v === 'true' ? true : v === 'false' ? false : v !== '' && !Number.isNaN(Number(v)) && !v.includes('{') ? Number(v) : tpl(v))
  const conditions = Object.fromEntries(r.conditions.map((c) => [
    c.field,
    c.op === 'eq' ? lit(c.value) : c.op === 'ne' ? { $ne: lit(c.value) } : { $in: c.value.split(',').map((s) => lit(s.trim())) },
  ]))
  return {
    action: r.action,
    subject: r.subject,
    ...(r.conditions.length ? { conditions } : {}),
    ...(r.inverted ? { inverted: true } : {}),
    ...(r.reason ? { reason: r.reason } : {}),
  }
}

/** The same rules as a defineAbility() builder, for reading. */
export function toBuilder(role: Role): string {
  const lines = role.rules.map((r) => {
    const conds = r.conditions.length ? `, ${JSON.stringify(toCasl(r).conditions).replace(/"\$\{(user\.\w+)\}"/g, '$1')}` : ''
    const reason = r.inverted && r.reason ? `.because(${JSON.stringify(r.reason)})` : ''
    return `  ${r.inverted ? 'cannot' : 'can'}('${r.action}', '${r.subject}'${conds})${reason}`
  })
  return `// ${role.label}\nconst ability = defineAbility((can, cannot) => {\n${lines.join('\n') || '  // no rules: everything is denied'}\n})`
}
