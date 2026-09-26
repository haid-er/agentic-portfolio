/**
 * Result checker: compares the user's last result set with the expected one, the way online
 * judges do: same number of columns, same rows (as a multiset, or in order when order matters).
 * Numbers are compared to 2 decimal places so float noise never fails a correct answer.
 * Column names are reported but not enforced.
 */
import type { Cell, ResultSet } from './protocol'

export interface CheckReport {
  pass: boolean
  reasons: string[]
  notes: string[]
  missing: Cell[][]
  extra: Cell[][]
}

const key = (v: Cell) => (v === null ? '∅' : typeof v === 'number' ? `n${Math.round(v * 100) / 100}` : `s${v}`)
const rowKey = (r: Cell[]) => r.map(key).join('\u0001')

export function compareSets(user: ResultSet | undefined, expected: ResultSet, ordered: boolean): CheckReport {
  const report: CheckReport = { pass: false, reasons: [], notes: [], missing: [], extra: [] }
  if (!user) {
    report.reasons.push('Your SQL did not return a result set. The last statement must be a SELECT (or WITH … SELECT).')
    return report
  }
  if (user.truncated) report.notes.push('Your result was cut off at 500 rows; the check used those rows only.')
  if (user.columns.length !== expected.columns.length) {
    report.reasons.push(`Expected ${expected.columns.length} column${expected.columns.length === 1 ? '' : 's'} (${expected.columns.join(', ')}), got ${user.columns.length} (${user.columns.join(', ') || 'none'}).`)
    return report
  }
  const renamed = expected.columns.filter((c, i) => c.toLowerCase() !== (user.columns[i] ?? '').toLowerCase())
  if (renamed.length) report.notes.push(`Column names differ from the spec (${expected.columns.join(', ')}); values are what count here.`)

  if (user.rows.length !== expected.rows.length) {
    report.reasons.push(`Expected ${expected.rows.length} row${expected.rows.length === 1 ? '' : 's'}, got ${user.rows.length}.`)
  }

  // Multiset difference.
  const counts = new Map<string, number>()
  for (const r of expected.rows) counts.set(rowKey(r), (counts.get(rowKey(r)) ?? 0) + 1)
  for (const r of user.rows) {
    const k = rowKey(r)
    const n = counts.get(k) ?? 0
    if (n > 0) counts.set(k, n - 1); else report.extra.push(r)
  }
  for (const r of expected.rows) {
    const k = rowKey(r)
    const n = counts.get(k) ?? 0
    if (n > 0) { report.missing.push(r); counts.set(k, n - 1) }
  }
  if (report.missing.length || report.extra.length) {
    report.reasons.push(`${report.missing.length} expected row${report.missing.length === 1 ? ' is' : 's are'} missing and ${report.extra.length} row${report.extra.length === 1 ? ' is' : 's are'} unexpected.`)
    return report
  }

  if (ordered) {
    const firstOff = expected.rows.findIndex((r, i) => rowKey(r) !== rowKey(user.rows[i]))
    if (firstOff !== -1) {
      report.reasons.push(`The rows are right but the order is not: row ${firstOff + 1} is out of place. Check your ORDER BY.`)
      return report
    }
  }
  report.pass = report.reasons.length === 0
  return report
}
