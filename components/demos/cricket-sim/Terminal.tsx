'use client'
/**
 * Terminal mode: the same match as a console program would print it.
 * Lines come straight from the engine's `console`; you type what scanf() would read.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DELIVERIES, prompt, scorecardText, SHOTS, userBatting, type Action, type Match } from './engine'

const HELP = [
  '  Commands:',
  '    1-6      play a shot when batting (1 leave .. 6 loft)',
  '    1-5      choose a delivery when bowling',
  '    h / t    call heads or tails at the toss',
  '    card     print the scorecard',
  '    clear    clear the screen',
  '    new      start a new match with a fresh seed',
  '',
]

export function Terminal({ m, dispatch, onNew }: { m: Match; dispatch: (a: Action) => void; onNew: () => void }) {
  const [value, setValue] = useState('')
  const [from, setFrom] = useState(0)
  const screen = useRef<HTMLDivElement | null>(null)
  const input = useRef<HTMLInputElement | null>(null)
  const lines = m.console.slice(Math.min(from, m.console.length))

  useEffect(() => {
    const el = screen.current
    if (el) el.scrollTop = el.scrollHeight
  }, [m.console.length, from])

  const run = (raw: string) => {
    const cmd = raw.trim().toLowerCase()
    const echo = (...extra: string[]) => dispatch({ type: 'print', lines: [`> ${raw}`, ...extra] })
    if (cmd === 'help' || cmd === '?') return echo(...HELP)
    if (cmd === 'card') return echo(...scorecardText(m))
    if (cmd === 'clear') { setFrom(m.console.length); return }
    if (cmd === 'new') { onNew(); setFrom(0); return }
    switch (m.phase) {
      case 'toss':
        if (cmd === '1' || cmd === 'h' || cmd === 'heads') return dispatch({ type: 'toss', call: 'heads' })
        if (cmd === '2' || cmd === 't' || cmd === 'tails') return dispatch({ type: 'toss', call: 'tails' })
        break
      case 'choose':
        if (cmd === '1' || cmd === 'bat') return dispatch({ type: 'choose', bat: true })
        if (cmd === '2' || cmd === 'bowl') return dispatch({ type: 'choose', bat: false })
        break
      case 'break':
        return dispatch({ type: 'next' })
      case 'innings': {
        const n = Number(cmd)
        if (userBatting(m)) {
          const s = SHOTS[n - 1]
          if (Number.isInteger(n) && s) { dispatch({ type: 'print', lines: [`> ${n} (${s.label.toLowerCase()})`] }); return dispatch({ type: 'bat', shot: s.value, timing: 'none' }) }
        } else {
          const d = DELIVERIES[n - 1]
          if (Number.isInteger(n) && d) { dispatch({ type: 'print', lines: [`> ${n} (${d.label.toLowerCase()})`] }); return dispatch({ type: 'bowl', delivery: d.value }) }
        }
        break
      }
      case 'done':
        break
    }
    echo(`  Invalid input "${raw.trim()}". Type help for commands.`)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim() && m.phase !== 'break') return
    run(value || '')
    setValue('')
  }

  return (
    <div className="grid gap-2">
      <div
        ref={screen}
        onClick={() => input.current?.focus()}
        className="h-[min(60vh,480px)] overflow-y-auto p-3 xs:p-4 bg-bg-2 border border-rule rounded-1 font-mono text-00 leading-[1.7] text-ink [background-image:var(--pattern)]"
      >
        <div role="log" aria-live="polite" aria-label="Terminal output" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          {lines.map((l, i) => (
            <div key={from + i} className={l.startsWith('>') || l.startsWith('$') ? 'text-accent-ink' : l.includes('OUT!') ? 'text-danger' : undefined}>
              {l || ' '}
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-baseline gap-2 flex-wrap">
          <label htmlFor="cs-term" className="text-ink-2 whitespace-pre-wrap">{prompt(m)}</label>
          <input
            id="cs-term"
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 24))}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            inputMode={m.phase === 'innings' || m.phase === 'toss' || m.phase === 'choose' ? 'numeric' : 'text'}
            className="flex-1 min-w-[6ch] min-h-tap bg-transparent border-0 border-b border-rule text-ink font-mono text-00 caret-[var(--accent)] rounded-0 px-1"
          />
        </form>
      </div>
      <p className="m-0 text-00 text-ink-3">Type <code className="font-mono">help</code> for commands. Terminal mode has no timing: shots are played as a console program would read them.</p>
    </div>
  )
}
