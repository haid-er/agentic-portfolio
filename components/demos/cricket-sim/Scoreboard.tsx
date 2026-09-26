'use client'
/** The big score, this over's balls and the chase equation. */
import { cx } from '@/lib/utils'
import { ballSymbol, current, oversText, runRate, target, thisOver, type Ball, type Match } from './engine'

export function BallChip({ b, size = 'md' }: { b: Ball; size?: 'md' | 'sm' }) {
  const s = ballSymbol(b)
  const tone =
    b.result.kind === 'wicket' ? 'bg-danger text-bg border-danger'
      : b.result.kind === 'runs' && b.result.runs === 6 ? 'bg-ink text-bg border-ink'
        : b.result.kind === 'runs' && b.result.runs === 4 ? 'bg-accent text-on-accent border-accent'
          : b.result.kind === 'extra' ? 'bg-bg-2 text-ink-2 border-rule border-dashed'
            : 'bg-surface text-ink border-rule'
  return (
    <span
      className={cx(
        'inline-grid place-items-center border rounded-pill font-mono nums shrink-0',
        size === 'md' ? 'min-w-9 h-9 px-1 text-0' : 'min-w-7 h-7 px-1 text-00',
        tone,
      )}
    >
      {s}
    </span>
  )
}

export function Scoreboard({ m }: { m: Match }) {
  const inn = current(m)
  if (!inn) return null
  const t = target(m)
  const ballsLeft = m.config.overs * 6 - inn.legal
  const need = t !== null ? Math.max(0, t - inn.runs) : null
  const over = thisOver(inn)
  const striker = inn.batters[inn.striker]
  const non = inn.batters[inn.nonStriker]
  const bowler = inn.bowlers[Math.floor(inn.legal / 6) % inn.bowlers.length]
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="grid gap-1">
          <span className="mono text-ink-3">{m.config.teams[inn.team]}{inn.team === 0 ? ' · you' : ''}</span>
          <p className="display m-0 text-5 leading-none nums" aria-label={`${inn.runs} for ${inn.wickets}`}>
            {inn.runs}<span className="text-ink-3">/</span>{inn.wickets}
          </p>
        </div>
        <dl className="m-0 grid grid-cols-3 gap-x-5 gap-y-1 text-right">
          <dt className="mono text-ink-3">Overs</dt>
          <dt className="mono text-ink-3">Run rate</dt>
          <dt className="mono text-ink-3">{t !== null ? 'Target' : 'Extras'}</dt>
          <dd className="m-0 font-mono nums text-1">{oversText(inn.legal)}<span className="text-ink-3">/{m.config.overs}</span></dd>
          <dd className="m-0 font-mono nums text-1">{runRate(inn).toFixed(2)}</dd>
          <dd className="m-0 font-mono nums text-1">{t !== null ? t : inn.extras.wd + inn.extras.nb}</dd>
        </dl>
      </div>

      {need !== null && m.phase === 'innings' ? (
        <p className="m-0 text-0 text-ink-2" aria-live="polite">
          Need <strong className="text-ink">{need}</strong> off <strong className="text-ink">{ballsLeft}</strong> ball{ballsLeft === 1 ? '' : 's'}
          {ballsLeft > 0 ? <> · required rate <span className="font-mono nums">{((need / ballsLeft) * 6).toFixed(2)}</span></> : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="mono text-ink-3">This over</span>
        <div className="flex flex-wrap gap-1" aria-label={`This over: ${over.map(ballSymbol).join(' ') || 'no balls yet'}`}>
          {over.length ? over.map((b, i) => <BallChip key={i} b={b} size="sm" />) : <span className="mono text-ink-3">–</span>}
        </div>
      </div>

      <div className="grid gap-1 xs:grid-cols-2 text-0">
        {striker ? <p className="m-0"><span aria-hidden="true" className="text-accent-ink">▸ </span><span className="sr-only">On strike: </span>{striker.name} <span className="font-mono nums">{striker.runs} ({striker.balls})</span></p> : null}
        {non ? <p className="m-0 text-ink-2">{non.name} <span className="font-mono nums">{non.runs} ({non.balls})</span></p> : null}
        {bowler && m.phase === 'innings' ? <p className="m-0 text-ink-2 xs:col-span-2">Bowling: {bowler.name} <span className="font-mono nums">{oversText(bowler.balls)}-{bowler.maidens}-{bowler.runs}-{bowler.wickets}</span></p> : null}
      </div>
    </div>
  )
}
