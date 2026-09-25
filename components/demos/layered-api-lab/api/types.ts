/**
 * Shared types for the layered API lab. The same mini app runs in the Next route handler
 * (app/api/demos/lab/[...path]) and, when the server is unreachable, in the browser.
 */

/** The layers a request passes through, top to bottom. */
export type Layer = 'router' | 'middleware' | 'controller' | 'service' | 'repository' | 'error-handler'

export const LAYERS: readonly Layer[] = ['router', 'middleware', 'controller', 'service', 'repository', 'error-handler']

export type StepOutcome = 'ok' | 'threw' | 'handled'

export interface TraceStep {
  layer: Layer
  /** e.g. "SitesController.create" */
  label: string
  /** One-line note: a query, a validation summary, the error name. */
  detail?: string
  /** Wall time inside this step, including nested steps (measured, not simulated). */
  ms: number
  outcome: StepOutcome
  /** Nesting depth: the controller calls the service, which calls the repository. */
  depth: number
}

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug'

/** A Winston-style structured log line (JSON format transport). */
export interface LogLine {
  timestamp: string
  level: LogLevel
  message: string
  requestId: string
  layer: Layer
  meta?: Record<string, unknown>
}

export interface LabRequest {
  method: string
  /** Path after /api/demos/lab, e.g. "/sites/1" */
  path: string
  query: Record<string, string>
  /** Raw body text (the body-parser middleware parses it). */
  rawBody: string
  requestId: string
}

export interface LabResult {
  status: number
  headers: Record<string, string>
  /** The REST body a real client would get. */
  body: unknown
  trace: TraceStep[]
  logs: LogLine[]
  durationMs: number
}

export interface Site {
  id: number
  name: string
  country: string
  scope: 1 | 2 | 3
  emissionsTCO2e: number
  reportingYear: number
  updatedAt: string
}

/** The whole "database" for one session. */
export interface LabDb {
  rows: Map<number, Site>
  seq: number
}

/** Wire envelope: the REST body plus a demo-only `_debug` block with trace and logs. */
export interface LabWire {
  body: unknown
  _debug: { trace: TraceStep[]; logs: LogLine[]; durationMs: number; runtime: 'server' | 'browser'; coldStart?: boolean }
}
