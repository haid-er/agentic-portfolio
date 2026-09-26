'use client'
/** Challenge mode: prompt, editor, Run (shared database) and Check (two fresh copies, compared). */
import { useState } from 'react'
import { Badge, Button, DemoPanel, DemoToolbar, ErrorState, Loading, Select, useToast } from '@/components/ui'
import { useLocalStorage } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { CHALLENGES } from './challenges'
import { compareSets, type CheckReport } from './compare'
import { errorText, lastSet, type Engine } from './engine'
import type { ExecOutcome, ResultSet } from './protocol'
import { ResultTable } from './ResultTable'
import { SqlEditor } from './SqlEditor'

type Outcome =
  | { kind: 'run'; outcome: ExecOutcome }
  | { kind: 'check'; report: CheckReport; user?: ResultSet; expected?: ResultSet; ms: number }
  | { kind: 'error'; message: string }

const starter = (title: string, cols: string[]) => `-- ${title}\n-- return: ${cols.join(', ')}\nSELECT\n  \nFROM `

export function ChallengeView({ engine, ready }: { engine: Engine; ready: boolean }) {
  const [id, setId] = useLocalStorage('sql-playground:challenge', CHALLENGES[0].id)
  const [drafts, setDrafts] = useLocalStorage<Record<string, string>>('sql-playground:drafts', {})
  const [solved, setSolved] = useLocalStorage<Record<string, boolean>>('sql-playground:solved', {})
  const [result, setResult] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState<'run' | 'check' | null>(null)
  const [hint, setHint] = useState(false)
  const toast = useToast()

  const ch = CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0]
  const sql = drafts[ch.id] ?? starter(ch.title, ch.columns)
  const setSql = (v: string) => setDrafts((d) => ({ ...d, [ch.id]: v }))
  const solvedCount = CHALLENGES.filter((c) => solved[c.id]).length

  const choose = (next: string) => { setId(next); setResult(null); setHint(false) }

  const run = async () => {
    if (busy || !ready) return
    setBusy('run')
    try { setResult({ kind: 'run', outcome: await engine.exec(sql) }) }
    catch (e) { setResult({ kind: 'error', message: errorText(e) }) }
    finally { setBusy(null) }
  }

  const check = async () => {
    if (busy || !ready) return
    setBusy('check')
    try {
      const { user, expected } = await engine.check(sql, ch.solution)
      if ('error' in user) { setResult({ kind: 'error', message: user.error }); return }
      const exp = lastSet(expected)
      if (!exp) throw new Error('The reference query returned nothing; this is a bug in the challenge.')
      const mine = lastSet(user)
      const report = compareSets(mine, exp, ch.ordered)
      setResult({ kind: 'check', report, user: mine, expected: exp, ms: user.ms })
      if (report.pass && !solved[ch.id]) {
        setSolved((s) => ({ ...s, [ch.id]: true }))
        toast(`Solved: ${ch.title}`, { tone: 'ok' })
      }
    } catch (e) {
      setResult({ kind: 'error', message: errorText(e) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4 min-w-0">
      <DemoPanel title="Challenge" meta={<span className="nums">{solvedCount}/{CHALLENGES.length} solved</span>}>
        <div className="grid gap-3 min-w-0">
          <Select label="Choose a challenge" value={ch.id} onChange={(e) => choose(e.target.value)} wrapperClassName="max-w-md">
            {CHALLENGES.map((c, i) => (
              <option key={c.id} value={c.id}>
                {String(i + 1).padStart(2, '0')} · {c.title} ({c.difficulty}){solved[c.id] ? ' · solved' : ''}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="display text-3 m-0 leading-tight">{ch.title}</h3>
            {solved[ch.id] ? <Badge tone="ok">solved</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={ch.difficulty === 'Easy' ? 'accent' : ch.difficulty === 'Medium' ? 'warn' : 'danger'}>{ch.difficulty}</Badge>
            {ch.concepts.map((c) => <Badge key={c}>{c}</Badge>)}
          </div>
          <p className="m-0 measure">{ch.prompt}</p>
          <p className="m-0 font-mono text-00 text-ink-2">
            <span className="text-ink-3 uppercase tracking-[.08em]">Columns </span>{ch.columns.join(', ')}
            <span className="text-ink-3"> · {ch.ordered ? 'row order is checked' : 'any row order'}</span>
          </p>

          <SqlEditor label="Your query" value={sql} onChange={setSql} onRun={check} rows={9} />
          <DemoToolbar>
            <Button variant="secondary" icon="play" onClick={run} disabled={!ready || busy !== null}>Run</Button>
            <Button variant="primary" icon="check" onClick={check} disabled={!ready || busy !== null}>Check answer</Button>
            <Button variant="ghost" size="sm" onClick={() => setHint((h) => !h)} aria-expanded={hint}>{hint ? 'Hide hint' : 'Hint'}</Button>
            <Button variant="ghost" size="sm" icon="refresh" onClick={() => { setSql(starter(ch.title, ch.columns)); setResult(null) }}>Reset</Button>
          </DemoToolbar>
          {hint ? <p className="m-0 p-3 border-l-4 border-accent-2 bg-bg-2 text-0 measure">{ch.hint}</p> : null}
          <p className="m-0 text-00 text-ink-3">Ctrl/⌘ + Enter checks your answer. Check runs your query and the reference on two fresh copies of the data.</p>
        </div>
      </DemoPanel>

      <DemoPanel title="Result" meta={result?.kind === 'run' ? <span className="nums">{result.outcome.ms.toFixed(1)} ms</span> : result?.kind === 'check' ? <span className="nums">{result.ms.toFixed(1)} ms</span> : undefined}>
        <div aria-live="polite" className="grid gap-3 min-w-0">
          {busy ? <Loading label={busy === 'check' ? 'Checking on fresh copies' : 'Running'} /> : null}
          {!busy && !result ? <p className="m-0 text-0 text-ink-2">Run to see your rows, or check to compare them with the expected result.</p> : null}
          {!busy && result?.kind === 'error' ? (
            <ErrorState title="SQLite returned an error"><pre className="m-0 font-mono text-00 whitespace-pre-wrap [overflow-wrap:anywhere]">{result.message}</pre></ErrorState>
          ) : null}
          {!busy && result?.kind === 'run' ? <RunOutput outcome={result.outcome} /> : null}
          {!busy && result?.kind === 'check' ? <CheckOutput r={result} /> : null}
        </div>
      </DemoPanel>

      <DemoPanel title="Solution and dialects">
        <details className="group">
          <summary className="cursor-pointer min-h-tap flex items-center mono text-accent-ink">Reveal (spoiler)</summary>
          <div className="grid gap-3 mt-2 min-w-0">
            <Code label="SQLite (reference)" text={ch.solution} />
            <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setSql(ch.solution)}>Copy into editor</Button>
            <Note label="PostgreSQL" text={ch.postgres} />
            <Note label="MySQL" text={ch.mysql} />
            <Code label="Drizzle ORM" text={ch.drizzle} />
          </div>
        </details>
      </DemoPanel>
    </div>
  )
}

function RunOutput({ outcome }: { outcome: ExecOutcome }) {
  const set = lastSet(outcome)
  if (!set) {
    return <p className="m-0 text-0">Ran {outcome.statements} statement{outcome.statements === 1 ? '' : 's'}; {outcome.changes} row{outcome.changes === 1 ? '' : 's'} changed. Nothing to show.</p>
  }
  return <ResultTable set={set} label="Your rows" />
}

function CheckOutput({ r }: { r: Extract<Outcome, { kind: 'check' }> }) {
  const { report } = r
  return (
    <div className="grid gap-3 min-w-0">
      <div className={cx('inline-flex flex-col gap-1 self-start px-4 py-2 border-[3px] rounded-1 -rotate-1 bg-surface motion-safe:animate-[settle_var(--dur-med)_var(--ease-out)_both]', report.pass ? 'border-ok text-ok' : 'border-danger text-danger')}>
        <span className="display text-3 leading-none uppercase">{report.pass ? 'Accepted' : 'Not yet'}</span>
        <span className="mono">{report.pass ? 'rows match the expected result' : 'see what differs below'}</span>
      </div>
      {report.reasons.length ? (
        <ul className="m-0 pl-5 text-0">{report.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
      ) : null}
      {report.notes.length ? (
        <ul className="m-0 pl-5 text-0 text-ink-2">{report.notes.map((x) => <li key={x}>{x}</li>)}</ul>
      ) : null}
      {r.expected && report.missing.length ? (
        <div className="grid gap-1"><p className="m-0 mono text-danger">Missing rows</p><ResultTable set={{ columns: r.expected.columns, rows: report.missing.slice(0, 20), truncated: false }} label="Rows you are missing" tone="danger" /></div>
      ) : null}
      {r.user && report.extra.length ? (
        <div className="grid gap-1"><p className="m-0 mono text-danger">Unexpected rows</p><ResultTable set={{ columns: r.user.columns, rows: report.extra.slice(0, 20), truncated: false }} label="Rows that should not be there" tone="danger" /></div>
      ) : null}
      {r.user ? (
        <div className="grid gap-1"><p className="m-0 mono text-ink-3">Your result</p><ResultTable set={r.user} label="Your result" tone={report.pass ? 'ok' : undefined} /></div>
      ) : null}
    </div>
  )
}

function Code({ label, text }: { label: string; text: string }) {
  return (
    <div className="grid gap-1 min-w-0">
      <p className="m-0 mono text-ink-3">{label}</p>
      <pre className="m-0 p-3 overflow-x-auto bg-bg-2 border border-rule-soft rounded-1 font-mono text-00 leading-[1.55] text-ink" tabIndex={0} aria-label={label}>{text}</pre>
    </div>
  )
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <p className="m-0 text-0 measure"><span className="mono text-ink-3">{label} · </span>{text}</p>
  )
}
