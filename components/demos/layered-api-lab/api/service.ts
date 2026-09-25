/** Service layer: business rules. Knows nothing about HTTP; throws typed errors. */
import { ConflictError, NotFoundError, UnprocessableError } from './errors'
import { MAX_ROWS, type SitesRepository } from './repository'
import type { CreateSiteDto, ListQueryDto, UpdateSiteDto } from './schemas'
import type { Site } from './types'

type Log = (message: string, meta?: Record<string, unknown>) => void

export class SitesService {
  constructor(private readonly repo: SitesRepository, private readonly log: Log = () => {}) {}

  list(q: ListQueryDto): Site[] {
    return this.repo.findMany(q)
  }

  get(id: number): Site {
    const site = this.repo.findById(id)
    if (!site) throw new NotFoundError(`Site ${id}`)
    return site
  }

  create(dto: CreateSiteDto): Site {
    if (this.repo.findByName(dto.name, dto.country)) {
      throw new ConflictError(`A site named "${dto.name}" already exists in ${dto.country}`)
    }
    if (this.repo.count() >= MAX_ROWS) throw new UnprocessableError(`This sandbox holds at most ${MAX_ROWS} sites; delete one first`)
    const row = this.repo.insert(dto)
    this.log('site created', { siteId: row.id, country: row.country })
    return row
  }

  update(id: number, dto: UpdateSiteDto): Site {
    const cur = this.get(id)
    const name = dto.name ?? cur.name
    const country = dto.country ?? cur.country
    const clash = this.repo.findByName(name, country)
    if (clash && clash.id !== id) throw new ConflictError(`A site named "${name}" already exists in ${country}`)
    const next = this.repo.update(id, dto)
    if (!next) throw new NotFoundError(`Site ${id}`)
    this.log('site updated', { siteId: id, fields: Object.keys(dto) })
    return next
  }

  remove(id: number): void {
    this.get(id)
    this.repo.delete(id)
    this.log('site deleted', { siteId: id })
  }

  /** Deliberately broken: shows what the error handler does with an unexpected error. */
  crash(): never {
    const report = undefined as unknown as { totals: { scope1: number } }
    // A classic bug: reading a property of undefined.
    return report.totals.scope1 as never
  }
}
