'use client'
/** What the selected file looks like at this step: raw text, a typed table, JSON or CSV. */
import { Badge, Table, TableWrap, Td, Th } from '@/components/ui'
import { COLUMNS, RATE } from './data'
import { toCsv, type Entry } from './pipeline'

const fmt = (v: number, i: number) => (i === 0 ? v.toFixed(2) : v.toFixed(3))

function Code({ children, label }: { children: string; label: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label={label}
      className="m-0 p-3 overflow-x-auto bg-bg border border-rule-soft rounded-1 font-mono text-00 leading-[1.6] text-ink whitespace-pre"
    >
      {children}
    </pre>
  )
}

export function Preview({ entry, step }: { entry: Entry | undefined; step: number }) {
  if (!entry) return <p className="m-0 text-0 text-ink-2">This file is not part of the dataset any more.</p>

  if (entry.lines) {
    const L = entry.lines
    const truncatedLast = step < 3
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge>semicolon text</Badge>
          <Badge>{L.length} lines</Badge>
          {truncatedLast ? <Badge tone="danger">last line truncated</Badge> : <Badge tone="ok">last line removed</Badge>}
        </div>
        <Code label={`First and last lines of ${entry.path}`}>
          {[...L.slice(0, 3), '…', ...L.slice(-2).map((l, i, a) => (truncatedLast && i === a.length - 1 ? `${l}   ← truncated` : l))].join('\n')}
        </Code>
      </div>
    )
  }

  const rows = entry.rows ?? []
  if (step <= 4 || entry.kind === 'recording') {
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">typed columns</Badge>
          <Badge>{rows.length} rows</Badge>
        </div>
        <TableWrap label={`First rows of ${entry.path}`}>
          <Table>
            <thead><tr>{COLUMNS.map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
            <tbody>
              {rows.slice(0, 5).map((r, i) => (
                <tr key={i}>{r.map((v, j) => <Td key={j}>{fmt(v, j)}</Td>)}</tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </div>
    )
  }

  if (step === 5) {
    const col = (k: number) => `[${rows.slice(0, 3).map((r) => r[k].toFixed(2)).join(', ')}, … ${rows.length} values]`
    const json = [
      '{',
      `  "subject": "${entry.subject}",`,
      `  "activity": "${entry.activity}",`,
      `  "window": ${entry.span?.index ?? 1},`,
      `  "start_s": ${entry.span?.start.toFixed(2) ?? 0},`,
      `  "rate_hz": ${RATE},`,
      ...COLUMNS.slice(1).map((c, i) => `  "${c}": ${col(i + 1)}${i < COLUMNS.length - 2 ? ',' : ''}`),
      '}',
    ].join('\n')
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2"><Badge tone="accent">atomic window · JSON</Badge><Badge>{rows.length} rows</Badge></div>
        <Code label={`JSON for ${entry.path}`}>{json}</Code>
      </div>
    )
  }

  const csv = toCsv(rows).split('\n')
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Badge tone="accent">CSV</Badge>
        <Badge>{rows.length} rows</Badge>
        {entry.dataset ? <Badge tone={entry.dataset === 'fall' ? 'danger' : 'ok'}>{entry.dataset === 'fall' ? 'Fall dataset' : 'ADL dataset'}</Badge> : null}
      </div>
      <Code label={`CSV for ${entry.path}`}>{[...csv.slice(0, 4), `… ${rows.length - 3} more rows`].join('\n')}</Code>
    </div>
  )
}
