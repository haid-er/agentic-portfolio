import { describe, expect, it } from 'vitest'
import { crand, newMatch, step, type Innings, type Match } from './engine'

/** A chase where the CPU (team 1) needs one run and you are bowling. */
function chaseNeedingOne(rng: number): Match {
  const m = newMatch({ overs: 2, wickets: 2, level: 'county', seed: 1, teams: ['A', 'B'] })
  const inn = (team: 0 | 1, runs: number): Innings => ({
    team,
    batters: [0, 1, 2].map((i) => ({ name: `${team}-${i}`, runs: 0, balls: 0, fours: 0, sixes: 0, out: null })),
    bowlers: [0, 1, 2, 3, 4].map((i) => ({ name: `b${i}`, balls: 0, runs: 0, wickets: 0, maidens: 0 })),
    striker: 0, nonStriker: 1, nextIn: 2, runs, wickets: 0, legal: 3,
    extras: { wd: 0, nb: 0 }, fow: [], balls: [], freeHit: false, overRuns: 0,
  })
  return { ...m, rng, phase: 'innings', innings: [inn(0, 10), inn(1, 10)] }
}

/** A seed whose second roll (after the commentary pick) is under the wide threshold (14 of 100). */
function wideSeed(): number {
  for (let s = 1; s < 10_000; s++) {
    const [, afterFirst] = crand(s)
    if (crand(afterFirst)[0] % 100 < 14) return s
  }
  throw new Error('no seed')
}

describe('bowlBall', () => {
  it('ends the match when a wide wins the chase', () => {
    const m = step(chaseNeedingOne(wideSeed()), { type: 'bowl', delivery: 'wide' })
    const chase = m.innings[1]
    expect(chase?.extras.wd).toBe(1)
    expect(chase?.runs).toBe(11)
    expect(m.phase).toBe('done')
    expect(m.winner).toBe(1)
  })
})
