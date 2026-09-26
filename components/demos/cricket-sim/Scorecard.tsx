'use client'
/** Batting and bowling cards for each innings, plus a Manhattan of runs per over. */
import { useState } from 'react'
import { EmptyState, Segmented, Table, TableWrap, Td, Th } from '@/components/ui'
import { oversText, runsPerOver, type Innings, type Match } from './engine'

function Manhattan({ m }: { m: Match }) {
  const overs = m.config.overs
  const series = m.innings.map((inn) => runsPerOver(inn, overs))
  const wkts = m.innings.map((inn) => {
    const out = Array.from({ length: overs }, () => 0)
    for (const b of inn.balls) if (b.result.kind === 'wicket' && b.over < overs) out[b.over] = (out[b.over] ?? 0) + 1
    return out
  })
  const max = Math.max(6, ...series.flat())
  const W = 300, H = 120, pad = 18
  const slot = (W - pad) / overs
  const bw = Math.min(14, (slot - 4) / 2)
  const y = (v: number) => H - pad - (v / max) * (H - pad - 10)
  return (
    <figure className="m-0 grid gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Runs per over. ${m.innings.map((inn, i) => `${m.config.teams[inn.team]}: ${series[i]?.join(', ')}`).join('. ')}`}>
        {[0, Math.round(max / 2), max].map((v) => (
          <g key={v}>
            <line x1={pad} x2={W} y1={y(v)} y2={y(v)} stroke="var(--rule-soft)" strokeWidth="0.6" />
            <text x={pad - 4} y={y(v) + 3} textAnchor="end" fontSize="7" className="font-mono" fill="var(--ink-3)">{v}</text>
          </g>
        ))}
        {series.map((s, k) => s.map((v, i) => {
          const x = pad + i * slot + slot / 2 - bw + k * bw
          const w = wkts[k]?.[i] ?? 0
          return (
            <g key={`${k}-${i}`}>
              <rect x={x} y={y(v)} width={bw - 1} height={H - pad - y(v)} fill={k === 0 ? 'var(--data-1)' : 'var(--data-2)'} />
              {w ? <text x={x + (bw - 1) / 2} y={y(v) - 3} textAnchor="middle" fontSize="7" className="font-mono" fill="var(--danger)">{'W'.repeat(Math.min(3, w))}</text> : null}
            </g>
          )
        }))}
        {Array.from({ length: overs }, (_, i) => (
          <text key={i} x={pad + i * slot + slot / 2} y={H - 5} textAnchor="middle" fontSize="7" className="font-mono" fill="var(--ink-3)">{i + 1}</text>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 mono text-ink-3">
        {m.innings.map((inn, k) => (
          <span key={k} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-3" style={{ background: k === 0 ? 'var(--data-1)' : 'var(--data-2)' }} />
            {m.config.teams[inn.team]}
          </span>
        ))}
        <span>W = wicket in the over</span>
      </figcaption>
    </figure>
  )
}

function Card({ m, inn }: { m: Match; inn: Innings }) {
  const inPlay = new Set([inn.striker, inn.nonStriker])
  const batted = inn.batters.filter((b, i) => b.balls > 0 || b.out || inPlay.has(i))
  const yet = inn.batters.filter((b, i) => !(b.balls > 0 || b.out || inPlay.has(i)))
  const bowled = inn.bowlers.filter((b) => b.balls > 0 || b.runs > 0)
  return (
    <div className="grid gap-4">
      <TableWrap label={`${m.config.teams[inn.team]} batting`}>
        <Table>
          <thead>
            <tr><Th>Batter</Th><Th>How out</Th><Th className="text-right">R</Th><Th className="text-right">B</Th><Th className="text-right">4s</Th><Th className="text-right">6s</Th><Th className="text-right">SR</Th></tr>
          </thead>
          <tbody>
            {batted.map((b) => (
              <tr key={b.name}>
                <Td className="whitespace-nowrap">{b.name}</Td>
                <Td className="whitespace-nowrap text-ink-2">{b.out ?? 'not out'}</Td>
                <Td className="text-right font-semibold">{b.runs}</Td>
                <Td className="text-right">{b.balls}</Td>
                <Td className="text-right">{b.fours}</Td>
                <Td className="text-right">{b.sixes}</Td>
                <Td className="text-right">{b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : '–'}</Td>
              </tr>
            ))}
            <tr>
              <Td colSpan={2}>Extras <span className="text-ink-3">(wd {inn.extras.wd}, nb {inn.extras.nb})</span></Td>
              <Td className="text-right">{inn.extras.wd + inn.extras.nb}</Td>
              <Td colSpan={4} />
            </tr>
            <tr>
              <Td colSpan={2} className="font-semibold">Total <span className="font-normal text-ink-3">({oversText(inn.legal)} ov, RR {inn.legal ? ((inn.runs / inn.legal) * 6).toFixed(2) : '0.00'})</span></Td>
              <Td className="text-right font-semibold">{inn.runs}/{inn.wickets}</Td>
              <Td colSpan={4} />
            </tr>
          </tbody>
        </Table>
      </TableWrap>
      {yet.length ? <p className="m-0 text-0 text-ink-2"><span className="mono text-ink-3">Yet to bat </span>{yet.map((b) => b.name).join(', ')}</p> : null}
      {inn.fow.length ? (
        <p className="m-0 text-0 text-ink-2">
          <span className="mono text-ink-3">Fall of wickets </span>
          {inn.fow.map((f) => `${f.runs}-${f.wicket} (${f.batter}, ${f.over} ov)`).join(', ')}
        </p>
      ) : null}
      <TableWrap label={`${m.config.teams[inn.team === 0 ? 1 : 0]} bowling`}>
        <Table>
          <thead>
            <tr><Th>Bowler</Th><Th className="text-right">O</Th><Th className="text-right">M</Th><Th className="text-right">R</Th><Th className="text-right">W</Th><Th className="text-right">Econ</Th></tr>
          </thead>
          <tbody>
            {bowled.length ? bowled.map((b) => (
              <tr key={b.name}>
                <Td className="whitespace-nowrap">{b.name}</Td>
                <Td className="text-right">{oversText(b.balls)}</Td>
                <Td className="text-right">{b.maidens}</Td>
                <Td className="text-right">{b.runs}</Td>
                <Td className="text-right font-semibold">{b.wickets}</Td>
                <Td className="text-right">{b.balls ? ((b.runs / b.balls) * 6).toFixed(2) : '–'}</Td>
              </tr>
            )) : (
              <tr><Td colSpan={6} className="text-ink-3">No overs bowled yet.</Td></tr>
            )}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  )
}

export function Scorecard({ m }: { m: Match }) {
  const [pick, setPick] = useState<string>('latest')
  if (!m.innings.length) return <EmptyState title="No balls bowled yet">The scorecard fills in ball by ball once the toss is done.</EmptyState>
  const idx = pick === 'latest' ? m.innings.length - 1 : Number(pick)
  const inn = m.innings[Math.min(idx, m.innings.length - 1)]
  return (
    <div className="grid gap-5">
      {m.innings.length > 1 ? (
        <Segmented
          label="Innings"
          value={String(Math.min(idx, m.innings.length - 1))}
          onChange={setPick}
          options={m.innings.map((x, i) => ({ value: String(i), label: m.config.teams[x.team] }))}
        />
      ) : null}
      {inn ? <Card m={m} inn={inn} /> : null}
      <Manhattan m={m} />
    </div>
  )
}
