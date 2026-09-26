/** What the views need from the database layer (implemented in index.tsx over SqlClient). */
import type { ExecOutcome, ResultSet } from './protocol'

export interface Engine {
  exec: (sql: string) => Promise<ExecOutcome>
  check: (userSql: string, refSql: string) => Promise<{ user: ExecOutcome | { error: string }; expected: ExecOutcome }>
}

export const lastSet = (o: ExecOutcome): ResultSet | undefined => o.sets[o.sets.length - 1]

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
