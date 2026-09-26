/** Messages between the judge (main thread) and the sandbox worker. */
import type { Args } from './problems'

export interface RunRequest {
  type: 'run'
  code: string
  tests: Args[]
  /** Capture console output (sample runs only). */
  captureLogs: boolean
}

export type WorkerMessage =
  | { type: 'compiled' }
  | { type: 'compile-error'; message: string }
  | { type: 'start'; index: number }
  | { type: 'result'; index: number; ok: true; value: unknown; ms: number; logs: string[] }
  | { type: 'result'; index: number; ok: false; error: string; ms: number; logs: string[] }
  | { type: 'end' }
