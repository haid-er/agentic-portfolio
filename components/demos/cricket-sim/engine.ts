/**
 * Cricket engine, written the way you would write it in C:
 *  - plain data (struct-like interfaces, no classes, no closures in state)
 *  - enums as string unions plus lookup tables for outcomes
 *  - the ANSI C sample rand() (a 32-bit LCG) seeded with srand(seed)
 *  - one pure `step(match, action)` function, like a game loop's update().
 * The state is serialisable, so a match resumes after a reload and a seed replays exactly.
 * The engine also "prints" console lines, which the terminal view shows verbatim.
 */

/* ------------------------------------------------------------------ */
/* types (the "structs")                                               */
/* ------------------------------------------------------------------ */

export type Delivery = 'yorker' | 'good' | 'short' | 'full' | 'wide'
export type Shot = 'leave' | 'defend' | 'nudge' | 'drive' | 'pull' | 'loft'
export type Timing = 'perfect' | 'good' | 'early' | 'late' | 'none'
export type Level = 'gentle' | 'county' | 'test'
export type Phase = 'toss' | 'choose' | 'innings' | 'break' | 'done'
export type HowOut = 'bowled' | 'lbw' | 'caught' | 'runout' | 'stumped'

export interface Config {
  overs: number
  wickets: number
  level: Level
  seed: number
  teams: [string, string] // [user, cpu]
}

export interface BatterCard { name: string; runs: number; balls: number; fours: number; sixes: number; out: string | null }
export interface BowlerCard { name: string; balls: number; runs: number; wickets: number; maidens: number }

export type Result =
  | { kind: 'runs'; runs: number }
  | { kind: 'wicket'; how: HowOut; where: string }
  | { kind: 'extra'; type: 'wd' | 'nb'; runs: number }

export interface Ball {
  over: number // 0-based over index
  ball: number // legal balls bowled in the over after this one (label: over.ball)
  delivery: Delivery
  shot: Shot | null
  timing: Timing
  result: Result
  striker: string
  bowler: string
  text: string
  /** Direction of the shot in degrees (0 = straight down the ground), for the wagon wheel. */
  angle: number | null
  total: number
  wickets: number
}

export interface Innings {
  team: 0 | 1
  batters: BatterCard[]
  bowlers: BowlerCard[]
  striker: number
  nonStriker: number
  nextIn: number
  runs: number
  wickets: number
  legal: number
  extras: { wd: number; nb: number }
  fow: { runs: number; wicket: number; over: string; batter: string }[]
  balls: Ball[]
  freeHit: boolean
  overRuns: number // runs conceded in the current over (for maidens)
}

export interface Match {
  v: 1
  config: Config
  rng: number
  phase: Phase
  tossWinner: 0 | 1 | null
  innings: Innings[]
  result: string | null
  winner: 0 | 1 | null // null with phase 'done' = tie
  console: string[]
}

export type Action =
  | { type: 'toss'; call: 'heads' | 'tails' }
  | { type: 'choose'; bat: boolean }
  | { type: 'bat'; shot: Shot; timing: Timing }
  | { type: 'bowl'; delivery: Delivery }
  | { type: 'next' }
  | { type: 'print'; lines: string[] }

/* ------------------------------------------------------------------ */
/* rand(): the ANSI C sample implementation                            */
/* ------------------------------------------------------------------ */

export const RAND_MAX = 32767

/** next = next * 1103515245 + 12345; return (next / 65536) % 32768. Returns [value, nextState]. */
export function crand(state: number): [number, number] {
  const next = (Math.imul(state >>> 0, 1103515245) + 12345) >>> 0
  return [Math.floor(next / 65536) % 32768, next]
}

/** Tiny RNG view over the match: mutates m.rng like C's hidden static. */
function rand(m: Match): number {
  const [v, next] = crand(m.rng)
  m.rng = next
  return v
}
const randInt = (m: Match, n: number) => rand(m) % n
const pickOf = <T,>(m: Match, xs: readonly T[]): T => xs[randInt(m, xs.length)] as T

function weighted(m: Match, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = (rand(m) / (RAND_MAX + 1)) * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0
    if (r < 0) return i
  }
  return weights.length - 1
}

/* ------------------------------------------------------------------ */
/* tables                                                              */
/* ------------------------------------------------------------------ */

export const DELIVERIES: { value: Delivery; label: string; key: string; hint: string }[] = [
  { value: 'yorker', label: 'Yorker', key: '1', hint: 'At the toes. Hard to score off, easy to miss.' },
  { value: 'good', label: 'Good length', key: '2', hint: 'The safe default. Asks a question every ball.' },
  { value: 'short', label: 'Bouncer', key: '3', hint: 'Short and fast: invites the pull, and the top edge.' },
  { value: 'full', label: 'Full toss', key: '4', hint: 'A gift if it lands wrong. Risk of a no-ball.' },
  { value: 'wide', label: 'Wide line', key: '5', hint: 'Outside off: tempts the drive, risks a wide.' },
]

export const SHOTS: { value: Shot; label: string; key: string; hint: string }[] = [
  { value: 'leave', label: 'Leave', key: '1', hint: 'No shot. Safe unless it is on the stumps.' },
  { value: 'defend', label: 'Defend', key: '2', hint: 'Block it. A single at most.' },
  { value: 'nudge', label: 'Nudge', key: '3', hint: 'Work it into a gap for one or two.' },
  { value: 'drive', label: 'Drive', key: '4', hint: 'Along the ground, through the covers.' },
  { value: 'pull', label: 'Pull', key: '5', hint: 'Across the line. Loves short balls.' },
  { value: 'loft', label: 'Loft', key: '6', hint: 'Over the top for six, or caught in the deep.' },
]

/** Outcome weights: [dot, 1, 2, 3, 4, 6, W], by delivery then shot. */
const OUTCOMES: Record<Delivery, Record<Shot, readonly number[]>> = {
  yorker: { leave: [62, 0, 0, 0, 0, 0, 38], defend: [70, 15, 0, 0, 0, 0, 15], nudge: [40, 40, 8, 0, 2, 0, 10], drive: [35, 20, 8, 1, 16, 0, 20], pull: [30, 10, 5, 0, 10, 0, 45], loft: [25, 10, 5, 0, 8, 12, 40] },
  good: { leave: [86, 0, 0, 0, 0, 0, 14], defend: [70, 25, 2, 0, 0, 0, 3], nudge: [30, 45, 15, 2, 3, 0, 5], drive: [25, 20, 15, 3, 25, 2, 10], pull: [30, 15, 10, 2, 20, 5, 18], loft: [20, 10, 8, 2, 15, 20, 25] },
  short: { leave: [96, 0, 0, 0, 0, 0, 4], defend: [65, 25, 5, 0, 0, 0, 5], nudge: [30, 40, 20, 2, 3, 0, 5], drive: [30, 15, 10, 2, 15, 0, 28], pull: [10, 10, 10, 3, 40, 15, 12], loft: [15, 8, 6, 2, 15, 30, 24] },
  full: { leave: [72, 0, 0, 0, 0, 0, 28], defend: [55, 35, 5, 0, 3, 0, 2], nudge: [20, 40, 25, 3, 8, 0, 4], drive: [8, 10, 12, 4, 50, 6, 10], pull: [25, 15, 10, 2, 25, 3, 20], loft: [8, 6, 6, 2, 18, 45, 15] },
  wide: { leave: [98, 0, 0, 0, 0, 0, 2], defend: [75, 20, 3, 0, 0, 0, 2], nudge: [35, 35, 15, 2, 5, 0, 8], drive: [15, 15, 12, 3, 35, 2, 18], pull: [15, 12, 12, 3, 40, 3, 15], loft: [15, 8, 8, 2, 15, 22, 30] },
}
const RUNS = [0, 1, 2, 3, 4, 6] as const
const W = 6

/** Chance of a wide / no-ball, out of 100, by delivery. */
const EXTRAS: Record<Delivery, { wd: number; nb: number }> = {
  yorker: { wd: 1, nb: 3 }, good: { wd: 1, nb: 1 }, short: { wd: 3, nb: 2 }, full: { wd: 1, nb: 8 }, wide: { wd: 14, nb: 1 },
}

/** CPU bowler's delivery mix by level. */
const CPU_BOWL: Record<Level, readonly number[]> = {
  gentle: [10, 25, 20, 30, 15],
  county: [20, 36, 20, 11, 13],
  test: [26, 44, 15, 5, 10],
}

/** The shot that suits each delivery best, used by the CPU batter. */
const BEST: Record<Delivery, readonly Shot[]> = {
  yorker: ['defend', 'nudge'], good: ['nudge', 'drive', 'defend'], short: ['pull', 'leave'], full: ['drive', 'loft'], wide: ['leave', 'drive'],
}

const LEVEL = {
  gentle: { w: 0.7, b: 1.2, iq: 0.45 },
  county: { w: 1.0, b: 1.0, iq: 0.6 },
  test: { w: 1.35, b: 0.85, iq: 0.75 },
} as const

const TIMING = {
  perfect: { dot: 0.8, b: 1.9, w: 0.35 },
  good: { dot: 0.95, b: 1.25, w: 0.8 },
  early: { dot: 1.3, b: 0.5, w: 1.6 },
  late: { dot: 1.3, b: 0.5, w: 1.7 },
  none: { dot: 1, b: 1, w: 1 },
} as const

/** Where a dismissal happens, by shot. */
const DISMISSALS: Record<Shot, readonly { how: HowOut; where: string }[]> = {
  leave: [{ how: 'bowled', where: '' }, { how: 'lbw', where: '' }],
  defend: [{ how: 'bowled', where: '' }, { how: 'lbw', where: '' }, { how: 'caught', where: 'short leg' }],
  nudge: [{ how: 'caught', where: 'the keeper' }, { how: 'lbw', where: '' }, { how: 'runout', where: '' }],
  drive: [{ how: 'caught', where: 'cover' }, { how: 'bowled', where: '' }, { how: 'caught', where: 'the keeper' }, { how: 'caught', where: 'slip' }],
  pull: [{ how: 'caught', where: 'deep square leg' }, { how: 'caught', where: 'fine leg' }, { how: 'lbw', where: '' }],
  loft: [{ how: 'caught', where: 'long-on' }, { how: 'caught', where: 'deep midwicket' }, { how: 'stumped', where: '' }, { how: 'caught', where: 'long-off' }],
}

/** Shot direction ranges in degrees (0 = straight, +90 = leg side), per shot. */
const ANGLES: Record<Shot, [number, number]> = {
  leave: [0, 0], defend: [-25, 25], nudge: [40, 150], drive: [-80, -5], pull: [70, 120], loft: [-40, 60],
}

/* ------------------------------------------------------------------ */
/* commentary                                                          */
/* ------------------------------------------------------------------ */

const DEL_TEXT: Record<Delivery, readonly string[]> = {
  yorker: ['Full and fast at the toes', 'Right in the blockhole', 'Searing yorker'],
  good: ['Good length outside off', 'On a length, nipping back', 'Back of a length'],
  short: ['Short and sharp', 'Bouncer, head high', 'Banged in short'],
  full: ['Full toss', 'Low full toss', 'Overpitched, waist high'],
  wide: ['Wide of off stump', 'Angled across, well wide', 'Floated wide'],
}

const LINES: Record<string, readonly string[]> = {
  dot_leave: ['left alone, sensible', 'shoulders arms and watches it go', 'no shot offered'],
  dot_defend: ['solid defence, no run', 'blocked back to the bowler', 'dead bat, drops at the feet'],
  dot: ['straight to the fielder', 'beaten! Just past the edge', 'played and missed', 'mistimed, no run'],
  '1': ['worked away for a single', 'pushed into the gap, they scamper one', 'dropped at their feet, quick single'],
  '2': ['into the deep, they come back for two', 'placed wide of long-on, two runs', 'good running, two'],
  '3': ['chased down inside the rope, three taken', 'hit into the gap, they run three'],
  '4': ['FOUR! Races away to the rope', 'FOUR! Pierces the field', 'FOUR! Crunched, no need to run'],
  '6': ['SIX! Into the stands', 'SIX! That has gone miles', 'SIX! Clean as a whistle'],
  wd: ['wide called', 'the umpire stretches both arms: wide'],
  nb: ['no-ball! Free hit coming up', 'overstepped: no-ball, and a free hit'],
}

const SHOT_TEXT: Record<Shot, string> = {
  leave: 'leaves it', defend: 'defends', nudge: 'nudges', drive: 'drives', pull: 'pulls', loft: 'goes aerial',
}

const TIMING_TEXT: Record<Timing, string> = { perfect: ' (timed to perfection)', good: '', early: ' (early on the shot)', late: ' (late on it)', none: '' }

const HOW_TEXT: Record<HowOut, string> = {
  bowled: 'OUT! Bowled, the stumps are a mess',
  lbw: 'OUT! Plumb in front, given LBW',
  caught: 'OUT! Caught',
  runout: 'OUT! Run out, a mix-up in the middle',
  stumped: 'OUT! Down the track, missed it, stumped',
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export const oversText = (legal: number) => `${Math.floor(legal / 6)}.${legal % 6}`
export const wicketLimit = (c: Config) => Math.min(10, Math.max(1, c.wickets))
export const bowlerCount = 5

function newInnings(m: Match, team: 0 | 1): Innings {
  const other = team === 0 ? 1 : 0
  const bat = m.config.teams[team]
  const bowl = m.config.teams[other]
  return {
    team,
    batters: Array.from({ length: wicketLimit(m.config) + 1 }, (_, i) => ({ name: `${bat} ${i + 1}`, runs: 0, balls: 0, fours: 0, sixes: 0, out: null })),
    bowlers: Array.from({ length: bowlerCount }, (_, i) => ({ name: `${bowl} ${String.fromCharCode(65 + i)}`, balls: 0, runs: 0, wickets: 0, maidens: 0 })),
    striker: 0,
    nonStriker: 1,
    nextIn: 2,
    runs: 0,
    wickets: 0,
    legal: 0,
    extras: { wd: 0, nb: 0 },
    fow: [],
    balls: [],
    freeHit: false,
    overRuns: 0,
  }
}

export const current = (m: Match): Innings | null => m.innings[m.innings.length - 1] ?? null
export const userBatting = (m: Match) => current(m)?.team === 0
export const target = (m: Match) => (m.innings.length >= 2 ? (m.innings[0]?.runs ?? 0) + 1 : null)

function print(m: Match, ...lines: string[]) {
  m.console.push(...lines)
  if (m.console.length > 600) m.console.splice(0, m.console.length - 600)
}

function scoreLine(m: Match, inn: Innings) {
  const t = target(m)
  const need = t !== null ? `  need ${Math.max(0, t - inn.runs)} off ${m.config.overs * 6 - inn.legal}` : ''
  return `  ${m.config.teams[inn.team]} ${inn.runs}/${inn.wickets} (${oversText(inn.legal)} ov)${need}`
}

/** The prompt a console version would print next. */
export function prompt(m: Match): string {
  switch (m.phase) {
    case 'toss': return 'Call the toss. Enter 1 for heads, 2 for tails: '
    case 'choose': return 'You won the toss. Enter 1 to bat, 2 to bowl: '
    case 'innings': return userBatting(m)
      ? 'Your shot? 1 leave 2 defend 3 nudge 4 drive 5 pull 6 loft: '
      : 'Your delivery? 1 yorker 2 good 3 bouncer 4 full toss 5 wide line: '
    case 'break': return 'Innings over. Press Enter to start the chase: '
    case 'done': return 'Match over. Type "new" to play again: '
  }
}

/* ------------------------------------------------------------------ */
/* new match                                                           */
/* ------------------------------------------------------------------ */

export function newMatch(config: Config): Match {
  const m: Match = { v: 1, config, rng: config.seed >>> 0, phase: 'toss', tossWinner: null, innings: [], result: null, winner: null, console: [] }
  print(m,
    `$ ./cricket --overs ${config.overs} --wickets ${wicketLimit(config)} --level ${config.level} --seed ${config.seed}`,
    '',
    '  ===========================',
    '     C R I C K E T   v1.0',
    '  ===========================',
    `  ${config.teams[0]} vs ${config.teams[1]}, ${config.overs} over${config.overs === 1 ? '' : 's'} a side`,
    `  srand(${config.seed});`,
    '',
  )
  return m
}

/* ------------------------------------------------------------------ */
/* the update function                                                 */
/* ------------------------------------------------------------------ */

export function step(prev: Match, action: Action): Match {
  const m: Match = structuredClone(prev)
  switch (action.type) {
    case 'print':
      print(m, ...action.lines)
      return m
    case 'toss': {
      if (m.phase !== 'toss') return prev
      const coin = randInt(m, 2) === 0 ? 'heads' : 'tails'
      const won = coin === action.call
      m.tossWinner = won ? 0 : 1
      print(m, `> ${action.call}`, `  The coin lands ${coin}. ${won ? 'You win the toss.' : `${m.config.teams[1]} win the toss.`}`)
      if (won) m.phase = 'choose'
      else {
        const cpuBats = randInt(m, 2) === 0
        print(m, `  ${m.config.teams[1]} choose to ${cpuBats ? 'bat' : 'bowl'}.`, '')
        startInnings(m, cpuBats ? 1 : 0)
      }
      return m
    }
    case 'choose':
      if (m.phase !== 'choose') return prev
      print(m, `> ${action.bat ? 'bat' : 'bowl'}`, `  You choose to ${action.bat ? 'bat' : 'bowl'}.`, '')
      startInnings(m, action.bat ? 0 : 1)
      return m
    case 'next': {
      if (m.phase !== 'break') return prev
      const first = m.innings[0]
      if (!first) return prev
      startInnings(m, first.team === 0 ? 1 : 0)
      return m
    }
    case 'bat': {
      if (m.phase !== 'innings' || !userBatting(m)) return prev
      const delivery = DELIVERIES[weighted(m, CPU_BOWL[m.config.level])]?.value ?? 'good'
      bowlBall(m, delivery, action.shot, action.timing)
      return m
    }
    case 'bowl': {
      if (m.phase !== 'innings' || userBatting(m)) return prev
      bowlBall(m, action.delivery, null, 'none')
      return m
    }
  }
}

function startInnings(m: Match, team: 0 | 1) {
  const inn = newInnings(m, team)
  m.innings.push(inn)
  m.phase = 'innings'
  const t = target(m)
  print(m, `  --- Innings ${m.innings.length}: ${m.config.teams[team]} batting ---`)
  if (t !== null) print(m, `  Target: ${t} off ${m.config.overs * 6} balls.`)
  print(m, `  ${inn.batters[0]?.name} and ${inn.batters[1]?.name} walk out. ${inn.bowlers[0]?.name} has the ball.`, '')
}

/** CPU batter: reads the delivery (better at higher levels) and the chase. */
function cpuShot(m: Match, inn: Innings, delivery: Delivery): Shot {
  const iq = LEVEL[m.config.level].iq
  const t = target(m)
  const ballsLeft = m.config.overs * 6 - inn.legal
  const wktsLeft = wicketLimit(m.config) - inn.wickets
  let aggression = 0.35
  if (t !== null) {
    const rrr = ((t - inn.runs) / Math.max(1, ballsLeft)) * 6
    aggression = Math.min(0.95, Math.max(0.1, rrr / 14))
  } else if (ballsLeft <= 6) aggression = 0.7
  if (wktsLeft <= 1) aggression *= 0.6
  if ((rand(m) / RAND_MAX) < iq) {
    const best = BEST[delivery]
    const safe = best[best.length - 1] ?? 'defend'
    return (rand(m) / RAND_MAX) < aggression ? (best[0] ?? 'drive') : safe
  }
  // A misread: anything goes, weighted by intent.
  const a = aggression
  return SHOTS[weighted(m, [10 * (1 - a), 25 * (1 - a), 25, 20 * a + 5, 12 * a + 3, 18 * a])]?.value ?? 'defend'
}

function bowlBall(m: Match, delivery: Delivery, userShot: Shot | null, timing: Timing) {
  const inn = current(m)
  if (!inn) return
  const over = Math.floor(inn.legal / 6)
  const bowlerIdx = over % bowlerCount
  const bowler = inn.bowlers[bowlerIdx]
  const striker = inn.batters[inn.striker]
  if (!bowler || !striker) return
  const label = (legal: number) => `${Math.floor(legal / 6)}.${legal % 6}`
  const next = (legal: number) => `${Math.floor(legal / 6)}.${(legal % 6) + 1}`
  const delText = pickOf(m, DEL_TEXT[delivery])

  // 1. Extras decided at the crease, before the shot.
  const ex = EXTRAS[delivery]
  const roll = randInt(m, 100)
  if (roll < ex.wd) {
    inn.runs += 1; inn.extras.wd += 1; bowler.runs += 1; inn.overRuns += 1
    const text = `${delText}: ${pickOf(m, LINES.wd ?? [])}.`
    pushBall(m, inn, { over, ball: inn.legal % 6, delivery, shot: null, timing: 'none', result: { kind: 'extra', type: 'wd', runs: 1 }, striker: striker.name, bowler: bowler.name, text, angle: null })
    print(m, `  ${next(inn.legal)}  ${bowler.name} to ${striker.name}: ${text}  +1 wd`)
    return
  }
  const noBall = roll < ex.wd + ex.nb
  const freeHit = inn.freeHit
  inn.freeHit = noBall

  // 2. The shot.
  const shot = userShot ?? cpuShot(m, inn, delivery)
  const lv = LEVEL[m.config.level]
  const tm = TIMING[timing]
  const weights = (OUTCOMES[delivery][shot] ?? [1, 0, 0, 0, 0, 0, 0]).map((wt, i) => {
    if (i === W) return (freeHit || noBall) ? 0 : wt * lv.w * tm.w
    if (i === 4 || i === 5) return wt * lv.b * tm.b
    if (i === 0) return wt * tm.dot
    return wt
  })
  const outcome = weighted(m, weights)
  const [lo, hi] = ANGLES[shot]
  const angle = shot === 'leave' ? null : lo + randInt(m, Math.max(1, hi - lo + 1))
  const prefix = `${delText}, ${striker.name} ${SHOT_TEXT[shot]}${TIMING_TEXT[timing]}:`

  if (!noBall) { inn.legal += 1; bowler.balls += 1; striker.balls += 1 }
  else { inn.runs += 1; inn.extras.nb += 1; bowler.runs += 1; inn.overRuns += 1; striker.balls += 1 }

  if (outcome === W) {
    const d = pickOf(m, DISMISSALS[shot])
    const how = d.how === 'caught' && d.where === 'the keeper' ? 'OUT! Edged and taken by the keeper' : d.how === 'caught' ? `${HOW_TEXT.caught} at ${d.where}` : HOW_TEXT[d.how]
    striker.out = d.how === 'bowled' ? `b ${bowler.name}` : d.how === 'lbw' ? `lbw b ${bowler.name}` : d.how === 'caught' ? `c ${d.where === 'the keeper' ? '†keeper' : d.where} b ${bowler.name}` : d.how === 'stumped' ? `st †keeper b ${bowler.name}` : 'run out'
    if (d.how !== 'runout') bowler.wickets += 1
    inn.wickets += 1
    inn.fow.push({ runs: inn.runs, wicket: inn.wickets, over: oversText(inn.legal), batter: striker.name })
    const text = `${prefix} ${how}. ${striker.name} ${striker.runs} (${striker.balls})`
    pushBall(m, inn, { over, ball: inn.legal % 6 || 6, delivery, shot, timing, result: { kind: 'wicket', how: d.how, where: d.where }, striker: striker.name, bowler: bowler.name, text, angle })
    print(m, `  ${label(inn.legal)}  ${bowler.name} to ${striker.name}: ${text}  W`, scoreLine(m, inn))
    if (inn.wickets < wicketLimit(m.config)) {
      inn.striker = inn.nextIn
      inn.nextIn += 1
      print(m, `  ${inn.batters[inn.striker]?.name} comes to the crease.`)
    }
  } else {
    const runs = RUNS[outcome] ?? 0
    striker.runs += runs
    if (runs === 4) striker.fours += 1
    if (runs === 6) striker.sixes += 1
    inn.runs += runs; bowler.runs += runs; inn.overRuns += runs
    const key = runs === 0 ? (shot === 'leave' ? 'dot_leave' : shot === 'defend' ? 'dot_defend' : 'dot') : String(runs)
    const nb = noBall ? ` ${pickOf(m, LINES.nb ?? [])}.` : ''
    const text = `${prefix} ${pickOf(m, LINES[key] ?? [])}.${nb}${freeHit ? ' (free hit)' : ''}`
    pushBall(m, inn, {
      over, ball: noBall ? inn.legal % 6 : inn.legal % 6 || 6, delivery, shot, timing,
      result: noBall ? { kind: 'extra', type: 'nb', runs: runs + 1 } : { kind: 'runs', runs },
      striker: striker.name, bowler: bowler.name, text, angle: runs > 0 ? angle : null,
    })
    print(m, `  ${noBall ? next(inn.legal) : label(inn.legal)}  ${bowler.name} to ${striker.name}: ${text}  ${noBall ? `+${runs} nb` : runs ? `+${runs}` : '.'}`)
    if (runs % 2 === 1) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker]
  }

  // 3. End of over: maidens, change ends, new bowler.
  if (!noBall && inn.legal % 6 === 0 && inn.legal > 0) {
    if (inn.overRuns === 0) bowler.maidens += 1
    inn.overRuns = 0
    ;[inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker]
    const endOfInnings = inn.legal >= m.config.overs * 6
    print(m, `  End of over ${inn.legal / 6}.${scoreLine(m, inn)}`)
    if (!endOfInnings && !isInningsOver(m, inn)) {
      print(m, `  ${inn.bowlers[(inn.legal / 6) % bowlerCount]?.name} to bowl.`, '')
    }
  }

  // 4. Innings / match end.
  if (isInningsOver(m, inn)) endInnings(m, inn)
}

function pushBall(m: Match, inn: Innings, b: Omit<Ball, 'total' | 'wickets'>) {
  inn.balls.push({ ...b, total: inn.runs, wickets: inn.wickets })
}

function isInningsOver(m: Match, inn: Innings) {
  const t = target(m)
  return inn.wickets >= wicketLimit(m.config) || inn.legal >= m.config.overs * 6 || (t !== null && inn.runs >= t)
}

function endInnings(m: Match, inn: Innings) {
  const name = m.config.teams[inn.team]
  print(m, '', `  ${name} finish on ${inn.runs}/${inn.wickets} (${oversText(inn.legal)} ov).`)
  if (m.innings.length === 1) {
    m.phase = 'break'
    print(m, `  ${m.config.teams[inn.team === 0 ? 1 : 0]} need ${inn.runs + 1} to win.`, '')
    return
  }
  const first = m.innings[0]
  if (!first) return
  const t = first.runs + 1
  m.phase = 'done'
  if (inn.runs >= t) {
    const left = wicketLimit(m.config) - inn.wickets
    const balls = m.config.overs * 6 - inn.legal
    m.winner = inn.team
    m.result = `${name} won by ${left} wicket${left === 1 ? '' : 's'}${balls ? ` with ${balls} ball${balls === 1 ? '' : 's'} to spare` : ''}.`
  } else if (inn.runs === t - 1) {
    m.winner = null
    m.result = 'Match tied.'
  } else {
    const by = t - 1 - inn.runs
    m.winner = first.team
    m.result = `${m.config.teams[first.team]} won by ${by} run${by === 1 ? '' : 's'}.`
  }
  print(m, `  RESULT: ${m.result}`, '  return 0;', '')
}

/* ------------------------------------------------------------------ */
/* derived views                                                       */
/* ------------------------------------------------------------------ */

/** Runs per over for the Manhattan chart. */
export function runsPerOver(inn: Innings, overs: number): number[] {
  const out = Array.from({ length: overs }, () => 0)
  for (const b of inn.balls) {
    const r = b.result.kind === 'runs' ? b.result.runs : b.result.kind === 'extra' ? b.result.runs : 0
    if (b.over < overs) out[b.over] = (out[b.over] ?? 0) + r
  }
  return out
}

/** Short symbol for a ball: ".", "1", "4", "6", "W", "wd", "nb". */
export function ballSymbol(b: Ball): string {
  if (b.result.kind === 'wicket') return 'W'
  if (b.result.kind === 'extra') return b.result.type === 'wd' ? 'wd' : `${b.result.runs - 1 || ''}nb`
  return b.result.runs === 0 ? '•' : String(b.result.runs)
}

/** Balls of the over in progress (or the last completed over). */
export function thisOver(inn: Innings): Ball[] {
  const last = inn.balls[inn.balls.length - 1]
  if (!last) return []
  return inn.balls.filter((b) => b.over === last.over)
}

export function runRate(inn: Innings) {
  return inn.legal ? (inn.runs / inn.legal) * 6 : 0
}

/** Plain-text scorecard for the terminal ("card" command). */
export function scorecardText(m: Match): string[] {
  const out: string[] = []
  m.innings.forEach((inn, i) => {
    out.push(`  ${m.config.teams[inn.team]}, innings ${i + 1}`)
    out.push(`  ${'Batter'.padEnd(16)}${'How out'.padEnd(26)}${'R'.padStart(4)}${'B'.padStart(4)}`)
    for (const b of inn.batters) {
      if (!b.balls && !b.out && inn.batters.indexOf(b) > Math.max(inn.striker, inn.nonStriker)) continue
      out.push(`  ${b.name.padEnd(16)}${(b.out ?? 'not out').padEnd(26)}${String(b.runs).padStart(4)}${String(b.balls).padStart(4)}`)
    }
    out.push(`  Extras ${inn.extras.wd + inn.extras.nb} (wd ${inn.extras.wd}, nb ${inn.extras.nb})`)
    out.push(`  TOTAL ${inn.runs}/${inn.wickets} (${oversText(inn.legal)} ov)`, '')
  })
  if (!out.length) out.push('  No balls bowled yet.', '')
  return out
}
