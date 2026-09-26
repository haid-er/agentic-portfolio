/**
 * A tiny Winston-shaped logger: `logger.child({ requestId }).info(msg, meta)` produces the same
 * JSON lines winston.format.json() + timestamp() would. Lines are collected per request.
 */
import type { Layer, LogLevel, LogLine } from './types'

export interface RequestLogger {
  log(level: LogLevel, layer: Layer, message: string, meta?: Record<string, unknown>): void
  lines: LogLine[]
}

export function createRequestLogger(requestId: string, now: () => Date = () => new Date()): RequestLogger {
  const lines: LogLine[] = []
  return {
    lines,
    log(level, layer, message, meta) {
      lines.push({ timestamp: now().toISOString(), level, message, requestId, layer, ...(meta ? { meta } : {}) })
    },
  }
}

/** One line as Winston's JSON transport would print it. */
export function formatLogLine(l: LogLine): string {
  const { meta, ...rest } = l
  return JSON.stringify({ ...rest, ...(meta ?? {}) })
}
