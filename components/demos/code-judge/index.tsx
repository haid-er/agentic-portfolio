'use client'
/**
 * Code judge: pick a problem, write `solve` in JavaScript, run the samples, then submit against
 * hidden tests in a sandboxed Web Worker with per-test time limits and AC / WA / TLE / RE / CE verdicts.
 */
import { useEffect, useRef } from 'react'
import { Button, DemoGrid, DemoPanel, DemoToolbar, Select, useToast } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { Editor } from './Editor'
import { PROBLEMS } from './problems'
import { Results } from './Results'
import { Statement } from './Statement'
import { useJudge } from './useJudge'

export { notes } from './notes'

export default function Demo(_props: DemoProps) {
  const [problemId, setProblemId] = useLocalStorage('code-judge:problem', PROBLEMS[0].id)
  const [drafts, setDrafts] = useLocalStorage<Record<string, string>>('code-judge:drafts', {})
  const [solved, setSolved] = useLocalStorage<Record<string, boolean>>('code-judge:solved', {})
  const { state, run, abort, clear } = useJudge()
  const toast = useToast()
  const problem = PROBLEMS.find((p) => p.id === problemId) ?? PROBLEMS[0]
  const code = drafts[problem.id] ?? problem.starter
  const running = state.status === 'running'
  const solvedCount = PROBLEMS.filter((p) => solved[p.id]).length

  // Celebrate (once) when a submission is accepted.
  const celebrated = useRef<unknown>(null)
  useEffect(() => {
    if (state.status !== 'done' || state.mode !== 'submit' || state.verdict !== 'AC' || celebrated.current === state) return
    celebrated.current = state
    if (!solved[problem.id]) {
      setSolved((s) => ({ ...s, [problem.id]: true }))
      toast(`Accepted: ${problem.title}`, { tone: 'ok' })
    }
  }, [state, problem, solved, setSolved, toast])

  const setCode = (v: string) => setDrafts((d) => ({ ...d, [problem.id]: v }))
  const choose = (id: string) => { abort(); clear(); setProblemId(id) }

  return (
    <DemoGrid
      aside={
        <DemoPanel title="Verdict" meta={state.mode === 'submit' ? 'hidden tests' : 'samples'} className="mid:sticky mid:top-24">
          <Results state={state} limit={problem.timeLimitMs} />
        </DemoPanel>
      }
    >
      <DemoPanel title="Problem" meta={<span className="nums">{solvedCount}/{PROBLEMS.length} solved</span>}>
        <div className="grid gap-4 min-w-0">
          <Select label="Choose a problem" value={problem.id} onChange={(e) => choose(e.target.value)} wrapperClassName="max-w-md">
            {PROBLEMS.map((p, i) => (
              <option key={p.id} value={p.id}>
                {String(i + 1).padStart(2, '0')} · {p.title} ({p.difficulty}){solved[p.id] ? ' · solved' : ''}
              </option>
            ))}
          </Select>
          <Statement problem={problem} solved={Boolean(solved[problem.id])} />
        </div>
      </DemoPanel>

      <DemoPanel title="Solution" meta="JavaScript · runs in a Web Worker">
        <div className="grid gap-3 min-w-0">
          <Editor label={`solve() for ${problem.title}`} value={code} onChange={setCode} onSubmit={() => !running && run(problem, code, 'submit')} />
          <DemoToolbar>
            <Button variant="secondary" icon="play" disabled={running} onClick={() => run(problem, code, 'samples')}>Run samples</Button>
            <Button variant="primary" arrow disabled={running} onClick={() => run(problem, code, 'submit')}>Submit</Button>
            {running ? <Button variant="danger" size="sm" onClick={abort}>Stop</Button> : null}
          </DemoToolbar>
          <DemoToolbar>
            <Button variant="ghost" size="sm" icon="refresh" disabled={running} onClick={() => { setCode(problem.starter); clear() }}>Reset code</Button>
            <Button variant="ghost" size="sm" disabled={running} onClick={() => { setCode(problem.naive); clear() }}>Load brute force</Button>
          </DemoToolbar>
          <p className="m-0 text-00 text-ink-3">
            “Load brute force” drops in a correct but slow solution, so you can watch the time limit catch it.
          </p>
        </div>
      </DemoPanel>
    </DemoGrid>
  )
}
