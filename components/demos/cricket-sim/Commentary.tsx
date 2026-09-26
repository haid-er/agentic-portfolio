'use client'
/** Ball-by-ball commentary, newest first. */
import { useState } from 'react'
import { Button } from '@/components/ui'
import type { Match } from './engine'
import { BallChip } from './Scoreboard'

export function Commentary({ m }: { m: Match }) {
  const [all, setAll] = useState(false)
  const balls = m.innings.flatMap((inn, k) => inn.balls.map((b) => ({ b, k, team: m.config.teams[inn.team] }))).reverse()
  const shown = all ? balls : balls.slice(0, 12)
  if (!balls.length) return <p className="m-0 text-0 text-ink-2">Commentary starts with the first ball.</p>
  return (
    <div className="grid gap-3">
      <ol role="log" aria-live="polite" aria-label="Ball-by-ball commentary" className="m-0 p-0 list-none grid">
        {shown.map(({ b, k }, i) => (
          <li key={`${k}-${balls.length - i}`} className="grid grid-cols-[3.25rem_auto_minmax(0,1fr)] gap-3 items-start py-2 border-b border-rule-soft">
            <span className="font-mono text-00 nums text-ink-3 pt-2">{b.result.kind === 'extra' ? `${b.over}.${b.ball + 1}` : `${b.over}.${b.ball}`}</span>
            <BallChip b={b} />
            <p className="m-0 text-0 pt-1">{b.text}</p>
          </li>
        ))}
      </ol>
      {balls.length > 12 ? (
        <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>{all ? 'Show latest 12' : `Show all ${balls.length} balls`}</Button>
      ) : null}
    </div>
  )
}
