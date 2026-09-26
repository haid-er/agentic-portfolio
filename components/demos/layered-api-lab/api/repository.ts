/**
 * Repository layer: the only code that touches storage. Here storage is an in-memory Map, and each
 * method reports the SQL a Drizzle/Postgres repository would run, so the trace reads like a real one.
 */
import type { CreateSiteDto, ListQueryDto, UpdateSiteDto } from './schemas'
import type { LabDb, Site } from './types'

export const MAX_ROWS = 40

export class SitesRepository {
  constructor(private readonly db: LabDb, private readonly note: (sql: string) => void = () => {}) {}

  withNote(note: (sql: string) => void) {
    return new SitesRepository(this.db, note)
  }

  findMany(q: ListQueryDto): Site[] {
    const where = [q.country ? 'country = $1' : '', q.scope ? `scope = $${q.country ? 2 : 1}` : ''].filter(Boolean)
    this.note(`SELECT * FROM sites${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id LIMIT ${q.limit}`)
    return [...this.db.rows.values()]
      .filter((s) => (!q.country || s.country === q.country) && (!q.scope || s.scope === q.scope))
      .sort((a, b) => a.id - b.id)
      .slice(0, q.limit)
  }

  findById(id: number): Site | undefined {
    this.note(`SELECT * FROM sites WHERE id = $1 LIMIT 1 -- [${id}]`)
    return this.db.rows.get(id)
  }

  findByName(name: string, country: string): Site | undefined {
    this.note(`SELECT id FROM sites WHERE lower(name) = lower($1) AND country = $2`)
    return [...this.db.rows.values()].find((s) => s.name.toLowerCase() === name.toLowerCase() && s.country === country)
  }

  count(): number {
    return this.db.rows.size
  }

  insert(dto: CreateSiteDto): Site {
    this.db.seq += 1
    const row: Site = { id: this.db.seq, ...dto, updatedAt: new Date().toISOString() }
    this.note(`INSERT INTO sites (name, country, scope, emissions_tco2e, reporting_year) VALUES ($1..$5) RETURNING * -- id ${row.id}`)
    this.db.rows.set(row.id, row)
    return row
  }

  update(id: number, dto: UpdateSiteDto): Site | undefined {
    const cur = this.db.rows.get(id)
    this.note(`UPDATE sites SET ${Object.keys(dto).map((k, i) => `${snake(k)} = $${i + 1}`).join(', ')} WHERE id = $${Object.keys(dto).length + 1} RETURNING *`)
    if (!cur) return undefined
    const next: Site = { ...cur, ...dto, updatedAt: new Date().toISOString() }
    this.db.rows.set(id, next)
    return next
  }

  delete(id: number): boolean {
    this.note(`DELETE FROM sites WHERE id = $1 -- [${id}]`)
    return this.db.rows.delete(id)
  }
}

const COLUMNS: Record<string, string> = { name: 'name', country: 'country', scope: 'scope', emissionsTCO2e: 'emissions_tco2e', reportingYear: 'reporting_year' }
const snake = (k: string) => COLUMNS[k] ?? k
