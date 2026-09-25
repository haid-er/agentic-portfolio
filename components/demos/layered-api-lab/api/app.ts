/**
 * The mini app: router -> middleware (body parser, Zod validation) -> controller -> service
 * -> repository, with one error handler at the end. Pure TypeScript: the Next route handler
 * and the in-browser fallback both call `handle()`.
 */
import type { ZodType } from 'zod'
import { SitesController, type ControllerResult, type Validated } from './controller'
import { HttpError, MalformedJsonError, MethodNotAllowedError, NotFoundError, PayloadTooLargeError, ValidationError, type IssueOut } from './errors'
import { createRequestLogger } from './logger'
import { SitesRepository } from './repository'
import { createSiteBody, idParams, listQuery, updateSiteBody } from './schemas'
import { SitesService } from './service'
import { Tracer, round, traced } from './trace'
import type { LabDb, LabRequest, LabResult } from './types'

export const MAX_BODY_BYTES = 4096

type Handler = Exclude<keyof SitesController, 'constructor'>

interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  pattern: string
  handler: Handler
  schemas: { params?: ZodType; query?: ZodType; body?: ZodType }
}

/** The route table, as `router.get('/sites', validate({ query: listQuery }), ctrl.list)` would declare it. */
export const ROUTES: readonly Route[] = [
  { method: 'GET', pattern: '/sites', handler: 'list', schemas: { query: listQuery } },
  { method: 'POST', pattern: '/sites', handler: 'create', schemas: { body: createSiteBody } },
  { method: 'GET', pattern: '/sites/:id', handler: 'get', schemas: { params: idParams } },
  { method: 'PATCH', pattern: '/sites/:id', handler: 'update', schemas: { params: idParams, body: updateSiteBody } },
  { method: 'DELETE', pattern: '/sites/:id', handler: 'remove', schemas: { params: idParams } },
  { method: 'GET', pattern: '/debug/crash', handler: 'crash', schemas: {} },
]

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean)
  const b = path.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    const p = a[i] as string
    const v = b[i] as string
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(v)
    else if (p !== v) return null
  }
  return params
}

function route(method: string, path: string): { route: Route; params: Record<string, string> } {
  const hits = ROUTES.map((r) => ({ route: r, params: matchPattern(r.pattern, path) })).filter((h) => h.params)
  const hit = hits.find((h) => h.route.method === method)
  if (hit?.params) return { route: hit.route, params: hit.params }
  if (hits.length) throw new MethodNotAllowedError(method, hits.map((h) => h.route.method))
  throw new NotFoundError(`Route ${method} ${path}`)
}

const byteLength = (s: string) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length)

export function handle(req: LabRequest, db: LabDb): LabResult {
  const t0 = clock()
  const tracer = new Tracer()
  const logger = createRequestLogger(req.requestId)
  const method = req.method.toUpperCase()
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'x-request-id': req.requestId }
  let status = 500
  let body: unknown = null

  logger.log('info', 'router', 'request received', { method, path: req.path })

  try {
    const { route: r, params } = tracer.step('router', `${method} ${req.path}`, (note) => {
      const m = route(method, req.path)
      note(`matched ${m.route.method} ${m.route.pattern} -> SitesController.${m.route.handler}`)
      return m
    })

    const parsed = tracer.step('middleware', 'express.json()', (note) => {
      if (!r.schemas.body) {
        note('no body expected; skipped')
        return undefined
      }
      const size = byteLength(req.rawBody)
      if (size > MAX_BODY_BYTES) throw new PayloadTooLargeError(MAX_BODY_BYTES)
      if (!req.rawBody.trim()) {
        note('empty body -> {}')
        return {}
      }
      try {
        const v: unknown = JSON.parse(req.rawBody)
        note(`parsed ${size} bytes`)
        return v
      } catch (e) {
        throw new MalformedJsonError(e instanceof Error ? e.message : 'unexpected token')
      }
    })

    const input: Validated = tracer.step('middleware', 'validate(zod)', (note) => {
      const issues: IssueOut[] = []
      const out: Validated = { params, query: req.query, body: parsed }
      const checked: string[] = []
      const failed: string[] = []
      for (const part of ['params', 'query', 'body'] as const) {
        const schema = r.schemas[part]
        if (!schema) continue
        const res = schema.safeParse(part === 'params' ? params : part === 'query' ? req.query : parsed)
        if (res.success) {
          out[part] = res.data
          checked.push(`${part} ok`)
        } else {
          checked.push(`${part}: ${res.error.issues.length} issue${res.error.issues.length > 1 ? 's' : ''}`)
          failed.push(part)
          for (const i of res.error.issues) {
            issues.push({ path: [part, ...i.path.map(String)].join('.'), message: i.message, code: i.code })
          }
        }
      }
      note(checked.length ? checked.join(' · ') : 'nothing to validate')
      if (issues.length) throw new ValidationError(failed.join(' + '), issues)
      return out
    })

    const repo = new SitesRepository(db)
    const tracedRepo = traced(repo, 'repository', 'SitesRepository', tracer, (note) =>
      repo.withNote((sql) => {
        note(sql)
        logger.log('debug', 'repository', 'query', { sql })
      }),
    )
    const service = traced(
      new SitesService(tracedRepo, (message, meta) => logger.log('info', 'service', message, meta)),
      'service', 'SitesService', tracer,
    )
    const controller = new SitesController(service)

    const result: ControllerResult = tracer.step('controller', `SitesController.${r.handler}`, (note) => {
      const res = controller[r.handler](input)
      note(`-> ${res.status}`)
      return res
    })
    status = result.status
    body = result.body
    Object.assign(headers, result.headers)
  } catch (err) {
    // The error handler: the ONLY place errors become HTTP responses.
    if (err instanceof HttpError) {
      status = err.status
      body = { error: { code: err.code, message: err.message, ...(err.details?.issues ? { issues: err.details.issues } : {}) } }
      if (err.details?.allow) headers.allow = err.details.allow.join(', ')
      logger.log('warn', 'error-handler', err.message, { name: err.name, code: err.code, status })
    } else {
      status = 500
      const e = err instanceof Error ? err : new Error(String(err))
      body = { error: { code: 'INTERNAL', message: 'Something went wrong. Quote the request id when reporting it.', requestId: req.requestId } }
      logger.log('error', 'error-handler', e.message, { name: e.name, stack: shortStack(e) })
    }
    tracer.add({
      layer: 'error-handler',
      label: 'errorHandler(err, req, res, next)',
      detail: `${err instanceof Error ? err.name : 'Error'} -> ${status}${status >= 500 ? ' (details logged, not leaked)' : ''}`,
      ms: 0,
      outcome: 'handled',
    })
  }

  const durationMs = round(clock() - t0)
  headers['x-response-time'] = `${durationMs}ms`
  logger.log('http', 'router', `${method} ${req.path} ${status} - ${durationMs} ms`, { status, durationMs })
  return { status, headers, body: status === 204 ? null : body, trace: tracer.steps, logs: logger.lines, durationMs }
}

/** First frames of a stack with file paths removed, so logs never reveal the server's layout. */
function shortStack(e: Error): string {
  const [head = e.message, ...frames] = (e.stack ?? '').split('\n').map((l) => l.trim())
  const clean = frames.slice(0, 2).map((f) => (/^at [\w$.<>]+ \(/.test(f) ? f.replace(/\s*\(.*\)$/, '') : 'at <anonymous>'))
  return [head, ...clean].join(' | ')
}

/** A short, sortable request id (what express-request-id / nestjs-cls would attach). */
export function requestId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `req_${Date.now().toString(36)}${rand}`
}
