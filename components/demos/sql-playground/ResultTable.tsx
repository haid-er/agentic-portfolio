/** A result set as a scrollable table: NULL is spelled out, numbers are right-aligned. */
import { EmptyState, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { Cell, ResultSet } from './protocol'

function CellView({ v }: { v: Cell }) {
  if (v === null) return <span className="font-mono text-00 text-ink-3 italic">NULL</span>
  return <>{typeof v === 'number' ? (Number.isInteger(v) ? v : Number(v.toFixed(6))) : v}</>
}

export function ResultTable({ set, label, maxRows = 200, tone }: { set: ResultSet; label: string; maxRows?: number; tone?: 'danger' | 'ok' }) {
  if (!set.columns.length) return null
  if (!set.rows.length) {
    return (
      <EmptyState title="No rows">
        <span className="font-mono">{set.columns.join(' · ')}</span>
      </EmptyState>
    )
  }
  const rows = set.rows.slice(0, maxRows)
  const numeric = set.columns.map((_, c) => rows.every((r) => r[c] === null || typeof r[c] === 'number'))
  return (
    <div className="grid gap-1 min-w-0">
      <TableWrap label={label} className={cx('max-h-[22rem] overflow-y-auto border border-rule-soft rounded-1', tone === 'danger' && 'border-danger', tone === 'ok' && 'border-ok')}>
        <Table>
          <thead className="sticky top-0 bg-surface">
            <tr>{set.columns.map((c, i) => <Th key={i} className={cx(numeric[i] && 'text-right')}>{c}</Th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => <Td key={j} className={cx('whitespace-nowrap', numeric[j] && 'text-right')}><CellView v={v} /></Td>)}
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      <p className="m-0 mono text-ink-3">
        {set.rows.length} row{set.rows.length === 1 ? '' : 's'}
        {set.truncated ? ' (stopped at 500)' : ''}
        {set.rows.length > maxRows ? ` · showing first ${maxRows}` : ''}
      </p>
    </div>
  )
}
