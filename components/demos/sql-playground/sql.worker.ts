/**
 * sql.js worker: SQLite compiled to WebAssembly, off the main thread so a heavy query never
 * freezes the page (the UI terminates and restarts this worker on a timeout).
 */
import initSqlJs from 'sql.js'
import type { Cell, ColumnInfo, Envelope, ExecOutcome, Reply, Request, ResultSet, TableInfo } from './protocol'

type SqlStatic = Awaited<ReturnType<typeof initSqlJs>>
type Db = InstanceType<SqlStatic['Database']>

const scope = self as unknown as DedicatedWorkerGlobalScope
const MAX_ROWS = 500

let SQL: SqlStatic | null = null
let db: Db | null = null
let seedSql = ''

function reply(id: number, r: Reply) {
  if (r.ok && r.type === 'export') scope.postMessage({ ...r, id }, [r.bytes.buffer])
  else scope.postMessage({ ...r, id })
}

async function loadWasm(urls: string[]): Promise<{ bytes: ArrayBuffer; source: string }> {
  let last = 'no source configured'
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) { last = `${url}: HTTP ${res.status}`; continue }
      const bytes = await res.arrayBuffer()
      const magic = new Uint8Array(bytes, 0, 4)
      // Every WebAssembly binary starts with "\0asm".
      if (magic[0] !== 0 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) { last = `${url}: not a wasm file`; continue }
      return { bytes, source: url }
    } catch (e) {
      last = `${url}: ${e instanceof Error ? e.message : 'network error'}`
    }
  }
  throw new Error(`Could not load the SQLite engine (${last}).`)
}

function freshDb(): Db {
  if (!SQL) throw new Error('SQLite is not loaded yet.')
  const d = new SQL.Database()
  d.exec('PRAGMA foreign_keys = ON;')
  d.exec(seedSql)
  return d
}

function toCell(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' || typeof v === 'string') return v
  if (v instanceof Uint8Array) return `<blob ${v.length} bytes>`
  return String(v)
}

/** Run every statement in `sql`, keeping at most MAX_ROWS rows per result set. */
function run(target: Db, sql: string): ExecOutcome {
  const t0 = performance.now()
  const sets: ResultSet[] = []
  let statements = 0
  let changes = 0
  for (const stmt of target.iterateStatements(sql)) {
    statements++
    try {
      const columns = stmt.getColumnNames()
      const rows: Cell[][] = []
      let truncated = false
      while (stmt.step()) {
        if (rows.length >= MAX_ROWS) { truncated = true; break }
        rows.push((stmt.get() as unknown[]).map(toCell))
      }
      if (columns.length) sets.push({ columns, rows, truncated })
      else changes = target.getRowsModified()
    } finally {
      stmt.free()
    }
  }
  return { sets, changes, statements, ms: performance.now() - t0 }
}

function schema(target: Db): TableInfo[] {
  const res = target.exec("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")
  const list = res[0]?.values ?? []
  return list.map(([name, sql]) => {
    const t = String(name)
    const quoted = `"${t.replace(/"/g, '""')}"`
    const cols = target.exec(`PRAGMA table_info(${quoted})`)[0]?.values ?? []
    const fks = target.exec(`PRAGMA foreign_key_list(${quoted})`)[0]?.values ?? []
    const rows = Number(target.exec(`SELECT COUNT(*) FROM ${quoted}`)[0]?.values[0]?.[0] ?? 0)
    const columns: ColumnInfo[] = cols.map((c) => {
      // table_info: cid, name, type, notnull, dflt_value, pk
      const colName = String(c[1])
      // foreign_key_list: id, seq, table, from, to, ...
      const fk = fks.find((f) => String(f[3]) === colName)
      return {
        name: colName,
        type: String(c[2] || 'ANY'),
        notNull: Number(c[3]) === 1,
        pk: Number(c[5]),
        references: fk ? { table: String(fk[2]), column: String(fk[4] ?? 'id') } : undefined,
      }
    })
    return { name: t, rows, columns, sql: String(sql ?? '') }
  })
}

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

scope.onmessage = async (e: MessageEvent<Envelope<Request>>) => {
  const req = e.data
  try {
    switch (req.type) {
      case 'init': {
        seedSql = req.seedSql
        const { bytes, source } = await loadWasm(req.wasmUrls)
        SQL = await initSqlJs({ wasmBinary: bytes })
        db = freshDb()
        const version = String(db.exec('SELECT sqlite_version()')[0]?.values[0]?.[0] ?? '')
        reply(req.id, { ok: true, type: 'init', source, version })
        return
      }
      case 'exec': {
        if (!db) throw new Error('The database is not ready.')
        reply(req.id, { ok: true, type: 'exec', outcome: run(db, req.sql) })
        return
      }
      case 'check': {
        // Both queries run on their own pristine copy, so a DELETE in one cannot affect the other.
        const refDb = freshDb()
        const userDb = freshDb()
        try {
          const expected = run(refDb, req.refSql)
          let user: ExecOutcome | { error: string }
          try { user = run(userDb, req.userSql) } catch (err) { user = { error: message(err) } }
          reply(req.id, { ok: true, type: 'check', user, expected })
        } finally {
          refDb.close()
          userDb.close()
        }
        return
      }
      case 'schema': {
        if (!db) throw new Error('The database is not ready.')
        reply(req.id, { ok: true, type: 'schema', tables: schema(db) })
        return
      }
      case 'reset': {
        db?.close()
        db = freshDb()
        reply(req.id, { ok: true, type: 'reset' })
        return
      }
      case 'export': {
        if (!db) throw new Error('The database is not ready.')
        const bytes = db.export()
        db.exec('PRAGMA foreign_keys = ON;') // export() re-opens the database and resets pragmas
        reply(req.id, { ok: true, type: 'export', bytes })
        return
      }
    }
  } catch (err) {
    reply(req.id, { ok: false, error: message(err) })
  }
}
