/** Records which layer ran, for how long, and where an error was thrown. */
import type { Layer, TraceStep } from './types'

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export const round = (ms: number) => Math.round(ms * 1000) / 1000

export class Tracer {
  readonly steps: TraceStep[] = []
  private depth = 0

  /** Runs `fn` as one traced step. Nested calls get a deeper `depth`. Errors are recorded and rethrown. */
  step<T>(layer: Layer, label: string, fn: (note: (detail: string) => void) => T): T {
    const entry: TraceStep = { layer, label, ms: 0, outcome: 'ok', depth: this.depth }
    this.steps.push(entry)
    const t0 = clock()
    this.depth += 1
    try {
      return fn((detail) => { entry.detail = detail })
    } catch (e) {
      entry.outcome = 'threw'
      if (!entry.detail) entry.detail = e instanceof Error ? `${e.name}: ${e.message}` : 'threw'
      throw e
    } finally {
      this.depth -= 1
      entry.ms = round(clock() - t0)
    }
  }

  /** A step recorded after the fact (the error handler). */
  add(step: Omit<TraceStep, 'depth'>) {
    this.steps.push({ ...step, depth: 0 })
  }
}

/**
 * Wraps every method of `target` so each call becomes a trace step in `layer`
 * (what a NestJS interceptor or an OpenTelemetry auto-instrumentation would do).
 */
export function traced<T extends object>(target: T, layer: Layer, name: string, tracer: Tracer, withNote?: (note: (d: string) => void) => T): T {
  return new Proxy(target, {
    get(obj, prop, recv) {
      const value = Reflect.get(obj, prop, recv) as unknown
      if (typeof value !== 'function' || typeof prop !== 'string' || prop === 'withNote' || prop === 'constructor') return value
      return (...args: unknown[]) =>
        tracer.step(layer, `${name}.${prop}`, (note) => {
          const self = withNote ? withNote(note) : obj
          return (Reflect.get(self, prop) as (...a: unknown[]) => unknown).apply(self, args)
        })
    },
  })
}
