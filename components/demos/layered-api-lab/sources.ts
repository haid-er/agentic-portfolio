/**
 * Illustrative source for each layer, in Express and NestJS flavours. The Express version
 * mirrors api/*.ts, which is what actually runs; the NestJS version is the equivalent shape.
 */
import type { Layer } from './api/types'

export type Flavour = 'express' | 'nest'

export const LAYER_LABEL: Record<Layer, string> = {
  router: 'Router',
  middleware: 'Middleware',
  controller: 'Controller',
  service: 'Service',
  repository: 'Repository',
  'error-handler': 'Error handler',
}

export const SOURCES: Record<Layer, Record<Flavour, string>> = {
  router: {
    express: `// sites.routes.ts
const router = Router()
router.get('/sites', validate({ query: listQuery }), ctrl.list)
router.post('/sites', validate({ body: createSiteBody }), ctrl.create)
router.get('/sites/:id', validate({ params: idParams }), ctrl.get)
router.patch('/sites/:id', validate({ params: idParams, body: updateSiteBody }), ctrl.update)
router.delete('/sites/:id', validate({ params: idParams }), ctrl.remove)
export default router`,
    nest: `// sites.module.ts
@Module({
  controllers: [SitesController],
  providers: [SitesService, SitesRepository],
})
export class SitesModule {}`,
  },
  middleware: {
    express: `// validate.ts
export const validate = (s: { params?: ZodType; query?: ZodType; body?: ZodType }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const issues = []
    for (const part of ['params', 'query', 'body'] as const) {
      const r = s[part]?.safeParse(req[part])
      if (r && !r.success) issues.push(...r.error.issues.map(toIssue(part)))
      else if (r) req[part] = r.data          // coerced + stripped
    }
    issues.length ? next(new ValidationError(issues)) : next()
  }`,
    nest: `// zod-validation.pipe.ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodType) {}
  transform(value: unknown) {
    const r = this.schema.safeParse(value)
    if (!r.success) throw new ValidationError(r.error.issues.map(toIssue))
    return r.data
  }
}`,
  },
  controller: {
    express: `// sites.controller.ts — HTTP in, HTTP out. No rules here.
export class SitesController {
  constructor(private service: SitesService) {}
  create = (req: Request, res: Response) => {
    const site = this.service.create(req.body)
    res.status(201).location(\`/sites/\${site.id}\`).json({ data: site })
  }
}`,
    nest: `@Controller('sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}
  @Post()
  @HttpCode(201)
  create(@Body(new ZodValidationPipe(createSiteBody)) dto: CreateSiteDto) {
    return { data: this.service.create(dto) }
  }
}`,
  },
  service: {
    express: `// sites.service.ts — business rules. Knows nothing about HTTP.
export class SitesService {
  constructor(private repo: SitesRepository, private log: Logger) {}
  create(dto: CreateSiteDto) {
    if (this.repo.findByName(dto.name, dto.country))
      throw new ConflictError(\`"\${dto.name}" already exists in \${dto.country}\`)
    const site = this.repo.insert(dto)
    this.log.info('site created', { siteId: site.id })
    return site
  }
}`,
    nest: `@Injectable()
export class SitesService {
  private readonly log = new Logger(SitesService.name)
  constructor(private readonly repo: SitesRepository) {}
  async create(dto: CreateSiteDto) {
    if (await this.repo.findByName(dto.name, dto.country))
      throw new ConflictException('Site already exists')
    return this.repo.insert(dto)
  }
}`,
  },
  repository: {
    express: `// sites.repository.ts — the only code that talks to storage.
export class SitesRepository {
  constructor(private db: Db) {}
  findById(id: number) {
    return this.db.select().from(sites).where(eq(sites.id, id)).limit(1)
  }
  insert(dto: CreateSiteDto) {
    return this.db.insert(sites).values(dto).returning()
  }
}`,
    nest: `@Injectable()
export class SitesRepository {
  constructor(@Inject(DB) private readonly db: Database) {}
  findById(id: number) {
    return this.db.query.sites.findFirst({ where: eq(sites.id, id) })
  }
}`,
  },
  'error-handler': {
    express: `// error-handler.ts — registered last: app.use(errorHandler)
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    logger.warn(err.message, { requestId: req.id, code: err.code })
    return res.status(err.status).json({ error: { code: err.code, message: err.message, issues: err.issues } })
  }
  logger.error(String(err), { requestId: req.id, stack: (err as Error).stack })
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong', requestId: req.id } })
}`,
    nest: `@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()
    const status = err instanceof HttpException ? err.getStatus() : 500
    if (status >= 500) this.logger.error(err)
    res.status(status).json(toErrorBody(err, status))
  }
}`,
  },
}
