'use client'
/** Free query mode: any SQL against the shared in-browser database, with examples and history. */
import { useEffect, useId, useState } from 'react'
import { Button, DemoPanel, DemoToolbar, ErrorState, Loading } from '@/components/ui'
import { useLocalStorage } from '@/lib/hooks'
import { errorText, type Engine } from './engine'
import type { ExecOutcome } from './protocol'
import { ResultTable } from './ResultTable'
import { SqlEditor } from './SqlEditor'

export const EXAMPLES: Array<{ label: string; sql: string }> = [
  {
    label: 'Join',
    sql: `SELECT o.id, c.name, o.ordered_at, o.status
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.ordered_at DESC
LIMIT 10;`,
  },
  {
    label: 'Aggregate',
    sql: `SELECT p.category,
       COUNT(DISTINCT i.order_id) AS orders,
       SUM(i.quantity) AS units,
       ROUND(SUM(i.quantity * i.unit_price), 2) AS revenue
FROM order_items i
JOIN products p ON p.id = i.product_id
GROUP BY p.category
ORDER BY revenue DESC;`,
  },
  {
    label: 'Window',
    sql: `SELECT name, department_id, salary,
       RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rank_in_dept,
       salary - AVG(salary) OVER (PARTITION BY department_id) AS vs_dept_avg
FROM employees
ORDER BY department_id, rank_in_dept;`,
  },
  {
    label: 'Recursive CTE',
    sql: `-- Walk the reporting chain from each head down
WITH RECURSIVE chain(id, name, depth, path) AS (
  SELECT id, name, 0, name FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, c.depth + 1, c.path || ' > ' || e.name
  FROM employees e JOIN chain c ON e.manager_id = c.id
)
SELECT depth, path FROM chain ORDER BY path;`,
  },
  {
    label: 'Query plan',
    sql: `-- Does SQLite use the index on orders(customer_id)?
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE customer_id = 7;`,
  },
  {
    label: 'Transaction',
    sql: `-- Writes are fine: Reset database restores the seed.
BEGIN;
UPDATE products SET price = ROUND(price * 1.1, 2) WHERE category = 'Prints';
SELECT name, price FROM products WHERE category = 'Prints';
ROLLBACK;`,
  },
]

export function FreeQuery({ engine, ready, sql, setSql, autoRun, onAutoRun, onReset, onExport }: {
  engine: Engine
  ready: boolean
  sql: string
  setSql: (v: string) => void
  /** Set by the parent (schema "Preview rows"): run the current SQL once, then call onAutoRun. */
  autoRun: boolean
  onAutoRun: () => void
  onReset: () => Promise<void>
  onExport: () => Promise<void>
}) {
  const [history, setHistory] = useLocalStorage<string[]>('sql-playground:history', [])
  const [outcome, setOutcome] = useState<ExecOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const examplesId = useId()

  const run = async (text = sql) => {
    if (busy || !ready || !text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const o = await engine.exec(text)
      setOutcome(o)
      setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 8))
    } catch (e) {
      setOutcome(null)
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!autoRun || !ready) return
    onAutoRun()
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when a run is requested
  }, [autoRun, ready])

  return (
    <div className="grid gap-4 min-w-0">
      <DemoPanel title="Query" meta="SQLite dialect">
        <div className="grid gap-3 min-w-0">
          <div className="flex flex-col gap-1">
            <span className="mono text-ink-2" id={examplesId}>Examples</span>
            <div role="group" aria-labelledby={examplesId} className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <Button key={ex.label} variant="secondary" size="sm" onClick={() => { setSql(ex.sql); void run(ex.sql) }} disabled={!ready || busy}>
                  {ex.label}
                </Button>
              ))}
            </div>
          </div>
          <SqlEditor label="SQL" value={sql} onChange={setSql} onRun={() => run()} rows={9} />
          <DemoToolbar>
            <Button variant="primary" icon="play" onClick={() => run()} disabled={!ready || busy}>Run</Button>
            <Button variant="ghost" size="sm" icon="refresh" onClick={() => { void onReset().then(() => { setOutcome(null); setError(null) }) }} disabled={!ready || busy}>Reset database</Button>
            <Button variant="ghost" size="sm" icon="download" onClick={() => void onExport()} disabled={!ready || busy}>Download .sqlite</Button>
          </DemoToolbar>
        </div>
      </DemoPanel>

      <DemoPanel title="Output" meta={outcome ? <span className="nums">{outcome.statements} stmt · {outcome.ms.toFixed(1)} ms</span> : undefined}>
        <div aria-live="polite" className="grid gap-4 min-w-0">
          {busy ? <Loading label="Running" /> : null}
          {!busy && error ? (
            <ErrorState title="SQLite returned an error"><pre className="m-0 font-mono text-00 whitespace-pre-wrap [overflow-wrap:anywhere]">{error}</pre></ErrorState>
          ) : null}
          {!busy && !error && !outcome ? <p className="m-0 text-0 text-ink-2">Pick an example or write your own query, then run it.</p> : null}
          {!busy && outcome && outcome.sets.length === 0 ? (
            <p className="m-0 text-0">Done: {outcome.statements} statement{outcome.statements === 1 ? '' : 's'}, {outcome.changes} row{outcome.changes === 1 ? '' : 's'} changed by the last write.</p>
          ) : null}
          {!busy && outcome ? outcome.sets.slice(-3).map((s, i) => <ResultTable key={i} set={s} label={`Result set ${i + 1}`} />) : null}
          {!busy && outcome && outcome.sets.length > 3 ? <p className="m-0 mono text-ink-3">Showing the last 3 of {outcome.sets.length} result sets.</p> : null}
        </div>
      </DemoPanel>

      {history.length ? (
        <DemoPanel title="History" meta="this browser only" actions={<Button variant="ghost" size="sm" onClick={() => setHistory([])}>Clear</Button>}>
          <ol className="m-0 p-0 list-none grid gap-1">
            {history.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setSql(h)}
                  className="w-full min-h-tap text-left px-2 py-1 font-mono text-00 text-ink-2 hover:bg-bg-2 border-b border-rule-soft truncate"
                  title={h}
                >
                  {h.replace(/\s+/g, ' ').slice(0, 120)}
                </button>
              </li>
            ))}
          </ol>
        </DemoPanel>
      ) : null}
    </div>
  )
}
