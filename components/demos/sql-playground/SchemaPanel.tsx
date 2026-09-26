'use client'
/** Schema viewer: live tables and columns (PK / FK / NOT NULL), raw DDL, or the Drizzle equivalent. */
import { useMemo, useState } from 'react'
import { Badge, Button, Segmented, useToast } from '@/components/ui'
import { drizzleSchema } from './drizzle'
import type { TableInfo } from './protocol'

type View = 'tables' | 'ddl' | 'drizzle'
const VIEWS = [{ value: 'tables', label: 'Tables' }, { value: 'ddl', label: 'DDL' }, { value: 'drizzle', label: 'Drizzle' }] as const

export function SchemaPanel({ tables, onPreview }: { tables: TableInfo[]; onPreview: (table: string) => void }) {
  const [view, setView] = useState<View>('tables')
  const toast = useToast()
  const drizzle = useMemo(() => drizzleSchema(tables), [tables])
  const ddl = useMemo(() => tables.map((t) => `${t.sql};`).join('\n\n'), [tables])

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${what} copied`, { tone: 'ok' })
    } catch {
      toast('Copy failed: select the text and copy it manually.', { tone: 'danger' })
    }
  }

  return (
    <div className="grid gap-3 min-w-0">
      <Segmented<View> label="Show" options={VIEWS} value={view} onChange={setView} />

      {view === 'tables' ? (
        <ul className="m-0 p-0 list-none grid gap-2">
          {tables.map((t) => (
            <li key={t.name}>
              <details className="group border border-rule-soft rounded-1 bg-surface" open={t.name === 'orders'}>
                <summary className="cursor-pointer min-h-tap flex items-center justify-between gap-2 px-3 font-mono text-0">
                  <span className="font-semibold text-ink">{t.name}</span>
                  <span className="text-00 text-ink-3 nums">{t.rows} rows · {t.columns.length} cols</span>
                </summary>
                <div className="px-3 pb-3 grid gap-2">
                  <ul className="m-0 p-0 list-none grid gap-1">
                    {t.columns.map((c) => (
                      <li key={c.name} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-00 border-b border-rule-soft pb-1">
                        <span className="text-ink">{c.name}</span>
                        <span className="text-ink-3">{c.type.toLowerCase()}</span>
                        {c.pk ? <Badge tone="accent">pk</Badge> : null}
                        {c.references ? <Badge tone="neutral">→ {c.references.table}.{c.references.column}</Badge> : null}
                        {c.notNull && !c.pk ? <span className="text-ink-3">not null</span> : null}
                      </li>
                    ))}
                  </ul>
                  <Button variant="secondary" size="sm" icon="play" className="justify-self-start" onClick={() => onPreview(t.name)}>Preview rows</Button>
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-2 min-w-0">
          {view === 'drizzle' ? (
            <p className="m-0 text-0 text-ink-2">The same tables declared with Drizzle ORM for PostgreSQL, generated from the live schema.</p>
          ) : null}
          <pre className="m-0 p-3 max-h-[26rem] overflow-auto bg-bg-2 border border-rule-soft rounded-1 font-mono text-00 leading-[1.55] text-ink" tabIndex={0} aria-label={view === 'ddl' ? 'SQLite DDL' : 'Drizzle schema'}>
            {view === 'ddl' ? ddl : drizzle}
          </pre>
          <Button variant="secondary" size="sm" icon="copy" className="justify-self-start" onClick={() => copy(view === 'ddl' ? ddl : drizzle, view === 'ddl' ? 'DDL' : 'Drizzle schema')}>Copy</Button>
        </div>
      )}
    </div>
  )
}
