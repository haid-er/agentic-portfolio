/**
 * Controller layer: maps HTTP to service calls. Receives already-validated input
 * (the validation middleware ran first), returns { status, body }. No business rules here.
 */
import type { SitesService } from './service'
import type { CreateSiteDto, IdParamsDto, ListQueryDto, UpdateSiteDto } from './schemas'

export interface Validated { params: unknown; query: unknown; body: unknown }
export interface ControllerResult { status: number; body: unknown; headers?: Record<string, string> }

export class SitesController {
  constructor(private readonly service: SitesService) {}

  list({ query }: Validated): ControllerResult {
    const q = query as ListQueryDto
    const data = this.service.list(q)
    return { status: 200, body: { data, meta: { count: data.length, limit: q.limit } } }
  }

  get({ params }: Validated): ControllerResult {
    return { status: 200, body: { data: this.service.get((params as IdParamsDto).id) } }
  }

  create({ body }: Validated): ControllerResult {
    const data = this.service.create(body as CreateSiteDto)
    return { status: 201, body: { data }, headers: { location: `/api/demos/lab/sites/${data.id}` } }
  }

  update({ params, body }: Validated): ControllerResult {
    return { status: 200, body: { data: this.service.update((params as IdParamsDto).id, body as UpdateSiteDto) } }
  }

  remove({ params }: Validated): ControllerResult {
    this.service.remove((params as IdParamsDto).id)
    return { status: 204, body: null }
  }

  crash(_input?: Validated): ControllerResult {
    return { status: 200, body: this.service.crash() }
  }
}
