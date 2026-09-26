'use client'
/**
 * Runs a submission in a fresh sandbox worker and turns worker messages into verdicts.
 * Time limits: the worker reports its own wall time per test; a watchdog on this thread
 * terminates the worker if a test runs well past the limit (infinite loops).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { buildTests, expectedFor, isCorrect, type Problem } from './problems'
import type { RunRequest, WorkerMessage } from './protocol'

export type Verdict = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE'
export type TestVerdict = Verdict | 'pending' | 'running' | 'skipped'

export interface TestResult {
  label: string
  kind: 'sample' | 'hidden'
  verdict: TestVerdict
  ms?: number
  got?: unknown
  expected?: unknown
  error?: string
  logs?: string[]
  args?: unknown[]
}

export interface JudgeState {
  status: 'idle' | 'running' | 'done' | 'failed'
  mode: 'samples' | 'submit'
  results: TestResult[]
  verdict?: Verdict
  compileError?: string
  /** Why the judge itself could not run (no worker support, etc.). */
  crash?: string
  maxMs?: number
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  AC: 'Accepted',
  WA: 'Wrong answer',
  TLE: 'Time limit exceeded',
  RE: 'Runtime error',
  CE: 'Compile error',
}

const IDLE: JudgeState = { status: 'idle', mode: 'samples', results: [] }

export function useJudge() {
  const [state, setState] = useState<JudgeState>(IDLE)
  const worker = useRef<Worker | null>(null)
  const watchdog = useRef<number | undefined>(undefined)
  const port = useRef<MessagePort | null>(null)

  const stop = useCallback(() => {
    window.clearTimeout(watchdog.current)
    worker.current?.terminate()
    worker.current = null
    port.current?.close()
    port.current = null
  }, [])

  useEffect(() => stop, [stop])

  const clear = useCallback(() => { stop(); setState(IDLE) }, [stop])

  const run = useCallback((problem: Problem, code: string, mode: 'samples' | 'submit') => {
    stop()
    const tests = buildTests(problem, mode)
    const expected = tests.map((t) => expectedFor(problem, t.args))
    const results: TestResult[] = tests.map((t) => ({
      label: t.label,
      kind: t.kind,
      verdict: 'pending',
      args: t.kind === 'sample' ? t.args : undefined,
    }))
    const limit = problem.timeLimitMs
    let finished = false
    setState({ status: 'running', mode, results: results.slice() })

    const finish = (patch: Partial<JudgeState>) => {
      if (finished) return
      finished = true
      stop()
      for (const r of results) if (r.verdict === 'pending' || r.verdict === 'running') r.verdict = 'skipped'
      const first = results.find((r) => r.verdict !== 'AC' && r.verdict !== 'skipped')
      // Accepted only when every test actually passed; a skipped test with no failure means the
      // sandbox stopped early, which is never a pass.
      const unfinished = !first && results.find((r) => r.verdict === 'skipped')
      if (unfinished) {
        unfinished.verdict = 'RE'
        unfinished.error = 'The sandbox stopped before this test finished.'
      }
      const times = results.map((r) => r.ms ?? 0)
      setState({
        status: 'done',
        mode,
        results: results.slice(),
        verdict: first ? (first.verdict as Verdict) : unfinished ? 'RE' : 'AC',
        maxMs: times.length ? Math.max(...times) : 0,
        ...patch,
      })
    }

    let w: Worker
    try {
      w = new Worker(new URL('./judge.worker.ts', import.meta.url), { name: 'code-judge-sandbox' })
    } catch (e) {
      setState({ ...IDLE, status: 'failed', crash: e instanceof Error ? e.message : 'Web Workers are not available in this browser.' })
      return
    }
    worker.current = w

    w.onerror = (e) => {
      e.preventDefault()
      if (finished) return
      finished = true
      stop()
      setState({ ...IDLE, status: 'failed', mode, crash: e.message || 'The sandbox worker failed to start.' })
    }

    // Results arrive only on a private port; anything posted on the worker's global channel
    // (which user code can reach) is ignored.
    w.onmessage = null
    const channel = new MessageChannel()
    port.current = channel.port1
    channel.port1.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data
      if (finished) return
      if (m.type === 'compile-error') {
        for (const r of results) r.verdict = 'skipped'
        finish({ verdict: 'CE', compileError: m.message })
        return
      }
      if (m.type === 'start') {
        results[m.index].verdict = 'running'
        setState((s) => ({ ...s, results: results.slice() }))
        window.clearTimeout(watchdog.current)
        watchdog.current = window.setTimeout(() => {
          results[m.index].verdict = 'TLE'
          results[m.index].ms = undefined
          results[m.index].error = `Still running after ${(limit * 2 / 1000).toFixed(1)} s; the sandbox was terminated.`
          finish({})
        }, Math.max(limit * 2, limit + 800))
        return
      }
      if (m.type === 'result') {
        window.clearTimeout(watchdog.current)
        const r = results[m.index]
        r.ms = m.ms
        r.logs = m.logs
        if (!m.ok) {
          r.verdict = 'RE'
          r.error = m.error
        } else if (m.ms > limit) {
          r.verdict = 'TLE'
        } else {
          const ok = isCorrect(problem, tests[m.index].args, m.value, expected[m.index])
          r.verdict = ok ? 'AC' : 'WA'
          if (tests[m.index].kind === 'sample') { r.got = m.value; r.expected = expected[m.index] }
        }
        // A judge stops at the first failing test on submit; sample runs show every sample.
        if (mode === 'submit' && r.verdict !== 'AC') { finish({}); return }
        setState((s) => ({ ...s, results: results.slice() }))
        return
      }
      if (m.type === 'end') finish({})
    }

    const req: RunRequest = { type: 'run', code, tests: tests.map((t) => t.args), captureLogs: mode === 'samples' }
    w.postMessage(req, [channel.port2])
  }, [stop])

  const abort = useCallback(() => {
    stop()
    setState((s) => (s.status === 'running' ? { ...IDLE, mode: s.mode } : s))
  }, [stop])

  return { state, run, abort, clear }
}
