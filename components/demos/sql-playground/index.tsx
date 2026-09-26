'use client'
/**
 * SQL playground: SQLite compiled to WebAssembly (sql.js) running in a Web Worker, a live schema
 * viewer with a Drizzle view, a free query console, and LeetCode-style challenges with a checker.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, DemoGrid, DemoPanel, ErrorState, Loading, Segmented, useToast } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { ChallengeView } from './ChallengeView'
import { SqlClient, TimeoutError } from './client'
import type { Engine } from './engine'
import { EXAMPLES, FreeQuery } from './FreeQuery'
import type { TableInfo } from './protocol'
import { SchemaPanel } from './SchemaPanel'

export { notes } from './notes'

type Mode = 'challenges' | 'free'
const MODES = [{ value: 'challenges', label: 'Challenges' }, { value: 'free', label: 'Free query' }] as const
type Status =
  | { state: 'loading' }
  | { state: 'ready'; version: string; source: string }
  | { state: 'error'; message: string }

const WRITES = /\b(create|drop|alter|insert|update|delete|replace|attach|vacuum)\b/i

export default function Demo(_props: DemoProps) {
  const [mode, setMode] = useLocalStorage<Mode>('sql-playground:mode', 'challenges')
  const [freeSql, setFreeSql] = useLocalStorage('sql-playground:free', EXAMPLES[0].sql)
  const [autoRun, setAutoRun] = useState(false)
  const [status, setStatus] = useState<Status>({ state: 'loading' })
  const [tables, setTables] = useState<TableInfo[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const client = useRef<SqlClient | null>(null)
  const generation = useRef(0)
  const toast = useToast()

  const boot = useCallback(async () => {
    const gen = ++generation.current
    client.current?.close()
    client.current = null
    setStatus({ state: 'loading' })
    try {
      const c = new SqlClient()
      client.current = c
      const info = await c.init()
      const schema = await c.schema()
      if (gen !== generation.current) return
      setTables(schema)
      setStatus({ state: 'ready', version: info.version, source: info.source.startsWith('/') ? 'this site' : 'jsDelivr' })
    } catch (e) {
      if (gen !== generation.current) return
      setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  useEffect(() => {
    void boot()
    // Bumping the generation makes any in-flight boot ignore its result.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a counter, not a DOM ref
    return () => { generation.current++; client.current?.close(); client.current = null }
  }, [boot])

  /** Run against the client; a timeout restarts the engine (fresh seed) and is reported. */
  const guard = useCallback(async <T,>(fn: (c: SqlClient) => Promise<T>): Promise<T> => {
    const c = client.current
    if (!c) throw new Error('The database is still starting.')
    try {
      return await fn(c)
    } catch (e) {
      if (e instanceof TimeoutError) { setNotice(e.message); void boot() }
      throw e
    }
  }, [boot])

  const engine = useMemo<Engine>(() => ({
    exec: async (sql) => {
      setNotice(null)
      const out = await guard((c) => c.exec(sql))
      if (WRITES.test(sql)) void guard((c) => c.schema()).then(setTables).catch(() => {})
      return out
    },
    check: (userSql, refSql) => { setNotice(null); return guard((c) => c.check(userSql, refSql)) },
  }), [guard])

  const reset = useCallback(async () => {
    try {
      await guard((c) => c.reset())
      setTables(await guard((c) => c.schema()))
      toast('Database restored to the seed data', { tone: 'ok' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Reset failed', { tone: 'danger' })
    }
  }, [guard, toast])

  const download = useCallback(async () => {
    try {
      const bytes = await guard((c) => c.export())
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.sqlite3' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'playground.sqlite'
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', { tone: 'danger' })
    }
  }, [guard, toast])

  const preview = (table: string) => {
    setFreeSql(`SELECT *\nFROM ${table}\nLIMIT 20;`)
    setMode('free')
    setAutoRun(true)
  }

  const ready = status.state === 'ready'

  if (status.state === 'error') {
    return (
      <ErrorState
        title="SQLite could not start"
        action={<Button variant="secondary" icon="refresh" onClick={() => void boot()}>Try again</Button>}
      >
        <p className="m-0">{status.message}</p>
        <p className="m-0 mt-1">The engine is a WebAssembly file, loaded from this site when available and otherwise from jsDelivr. Nothing was run.</p>
      </ErrorState>
    )
  }

  return (
    <div className="grid gap-4 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Segmented<Mode> label="Mode" options={MODES} value={mode === 'free' ? 'free' : 'challenges'} onChange={setMode} />
        <p className="m-0 mono text-ink-3" aria-live="polite">
          {ready ? `SQLite ${status.version} · WebAssembly · engine from ${status.source}` : 'Starting SQLite…'}
        </p>
      </div>
      {notice ? (
        <ErrorState title="Query stopped"><p className="m-0">{notice}</p></ErrorState>
      ) : null}

      <DemoGrid
        aside={
          <DemoPanel title="Schema" meta={ready ? `${tables.length} tables` : undefined}>
            {ready && tables.length ? <SchemaPanel tables={tables} onPreview={preview} /> : <Loading label="Loading SQLite (about 650 KB of WebAssembly)" />}
          </DemoPanel>
        }
      >
        {mode === 'free' ? (
          <FreeQuery
            engine={engine}
            ready={ready}
            sql={freeSql}
            setSql={setFreeSql}
            autoRun={autoRun}
            onAutoRun={() => setAutoRun(false)}
            onReset={reset}
            onExport={download}
          />
        ) : (
          <ChallengeView engine={engine} ready={ready} />
        )}
      </DemoGrid>
    </div>
  )
}
