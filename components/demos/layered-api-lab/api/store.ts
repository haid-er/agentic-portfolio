/** Seed data and the per-session in-memory "database". Sample rows only: not real sites. */
import type { LabDb, Site } from './types'

const SEED: Omit<Site, 'updatedAt'>[] = [
  { id: 1, name: 'North Plant', country: 'GB', scope: 1, emissionsTCO2e: 1240.5, reportingYear: 2024 },
  { id: 2, name: 'Harbour Warehouse', country: 'GB', scope: 2, emissionsTCO2e: 310.2, reportingYear: 2024 },
  { id: 3, name: 'Riverside Office', country: 'PK', scope: 2, emissionsTCO2e: 88.9, reportingYear: 2025 },
  { id: 4, name: 'Fleet Depot', country: 'DE', scope: 1, emissionsTCO2e: 612, reportingYear: 2025 },
]

export function seedDb(): LabDb {
  const stamp = '2025-01-01T00:00:00.000Z'
  return { rows: new Map(SEED.map((s) => [s.id, { ...s, updatedAt: stamp }])), seq: SEED.length }
}

/** Server-side session store with a TTL and a hard cap, so memory stays bounded. */
export class SessionStore {
  private readonly dbs = new Map<string, { db: LabDb; touched: number }>()

  constructor(private readonly maxSessions = 300, private readonly ttlMs = 30 * 60_000) {}

  get(sessionId: string, now = Date.now()): { db: LabDb; fresh: boolean } {
    this.prune(now)
    const hit = this.dbs.get(sessionId)
    if (hit) {
      hit.touched = now
      return { db: hit.db, fresh: false }
    }
    if (this.dbs.size >= this.maxSessions) {
      const oldest = [...this.dbs.entries()].sort((a, b) => a[1].touched - b[1].touched)[0]
      if (oldest) this.dbs.delete(oldest[0])
    }
    const db = seedDb()
    this.dbs.set(sessionId, { db, touched: now })
    return { db, fresh: true }
  }

  /** True when this session already has live data (does not create or touch it). */
  has(sessionId: string, now = Date.now()): boolean {
    const hit = this.dbs.get(sessionId)
    return !!hit && now - hit.touched <= this.ttlMs
  }

  reset(sessionId: string) {
    this.dbs.delete(sessionId)
  }

  private prune(now: number) {
    for (const [k, v] of this.dbs) if (now - v.touched > this.ttlMs) this.dbs.delete(k)
  }
}
