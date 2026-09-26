/** Messages between the SQL playground UI and its sql.js worker. */

export type Cell = number | string | null

export interface ResultSet {
  columns: string[]
  rows: Cell[][]
  /** More rows existed than were returned. */
  truncated: boolean
}

export interface ExecOutcome {
  sets: ResultSet[]
  /** Rows changed by the last write statement, if any. */
  changes: number
  statements: number
  ms: number
}

export interface ColumnInfo {
  name: string
  type: string
  notNull: boolean
  pk: number
  references?: { table: string; column: string }
}

export interface TableInfo {
  name: string
  rows: number
  columns: ColumnInfo[]
  sql: string
}

export type Request =
  | { type: 'init'; wasmUrls: string[]; seedSql: string }
  | { type: 'exec'; sql: string }
  | { type: 'check'; userSql: string; refSql: string }
  | { type: 'schema' }
  | { type: 'reset' }
  | { type: 'export' }

export type Reply =
  | { ok: true; type: 'init'; source: string; version: string }
  | { ok: true; type: 'exec'; outcome: ExecOutcome }
  | { ok: true; type: 'check'; user: ExecOutcome | { error: string }; expected: ExecOutcome }
  | { ok: true; type: 'schema'; tables: TableInfo[] }
  | { ok: true; type: 'reset' }
  | { ok: true; type: 'export'; bytes: Uint8Array }
  | { ok: false; error: string }

export type Envelope<T> = T & { id: number }
