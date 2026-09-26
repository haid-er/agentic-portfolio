/**
 * The 8-step preprocessing pipeline as pure functions: each step takes the file list
 * the previous step produced and returns the new list plus a human-readable log.
 * The pandas snippets are illustrative equivalents, not the original scripts.
 */
import { G, RATE, type RawFile } from './data'

export const STANDARD = ['walking', 'jogging', 'squatting', 'sitting_down_from_standing', 'fall_forward', 'fall_backward'] as const

export interface Entry {
  key: string
  source: string
  path: string
  file: string
  subject: string
  activity: string
  kind: 'recording' | 'junk' | 'window' | 'segment'
  lines?: string[]
  /** Parsed rows [t_s, ax, ay, az, gx, gy, gz] (from step 4). */
  rows?: number[][]
  /** Window position inside its source recording, in seconds. */
  span?: { index: number; start: number; end: number }
  dataset?: 'adl' | 'fall'
}

export interface Params { windowSec: number; fallG: number }

export interface Stage {
  entries: Entry[]
  removed: Entry[]
  changed: Set<string>
  log: string[]
  /** Full parsed recordings by source id (available from step 4). */
  sources: Map<string, number[][]>
}

export interface StepDef {
  id: string
  title: string
  what: string
  pandas: string
  run(prev: Stage, p: Params): Omit<Stage, 'sources'> & { sources?: Map<string, number[][]> }
}

const pad = (n: number) => String(n).padStart(2, '0')
const rawPath = (e: Pick<Entry, 'subject' | 'activity' | 'file'>) => ['raw', e.subject, e.activity, e.file].filter(Boolean).join('/')
const tag = (e: Entry) => `${e.subject}/${e.activity || e.file}`

export function normSubject(s: string) {
  const m = s.match(/\d+/)
  return m ? `S${pad(Number(m[0]))}` : s.trim()
}

const ALIASES: Record<string, string> = { walk: 'walking', squat: 'squatting', jog: 'jogging' }
export function normActivity(a: string) {
  const k = a.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return ALIASES[k] ?? k
}

const isStandard = (a: string) => (STANDARD as readonly string[]).includes(a)
export const magnitude = (r: number[]) => Math.hypot(r[1], r[2], r[3])

/** Map each entry, recording which ones changed. */
function mapEntries(prev: Stage, fn: (e: Entry) => Entry) {
  const changed = new Set<string>()
  const entries = prev.entries.map((e) => {
    const n = fn(e)
    if (n.path !== e.path || n !== e) changed.add(n.key)
    return n
  })
  return { entries, changed }
}

export const STEPS: StepDef[] = [
  {
    id: 'subjects',
    title: 'Standardise subject names',
    what: 'Folders were named by hand, so one person appears as “Subject 1” and “subject1”. Every variant is reduced to its number and rewritten as S01, S02…',
    pandas: 'df["subject"] = (df["subject"].str.extract(r"(\\d+)")[0]\n    .astype(int).map("S{:02d}".format))',
    run(prev) {
      const seen = new Map<string, string>()
      const { entries, changed } = mapEntries(prev, (e) => {
        const subject = normSubject(e.subject)
        if (subject === e.subject) return e
        seen.set(e.subject, subject)
        return { ...e, subject, path: rawPath({ ...e, subject }) }
      })
      const log = [...seen].map(([a, b]) => `“${a}” → ${b}`)
      return { entries, changed, removed: [], log: log.length ? log : ['All subject names already standard.'] }
    },
  },
  {
    id: 'activities',
    title: 'Standardise activity names',
    what: 'Activity folders mix case, spaces and short forms. Names are lower-cased, spaces become underscores and known short forms map to the standard vocabulary. Unknown names are flagged, not guessed.',
    pandas: 'df["activity"] = (df["activity"].str.strip().str.lower()\n    .str.replace(r"[\\s-]+", "_", regex=True)\n    .replace({"walk": "walking", "squat": "squatting"}))',
    run(prev) {
      const seen = new Map<string, string>()
      const flagged = new Set<string>()
      const { entries, changed } = mapEntries(prev, (e) => {
        if (e.kind === 'junk') return e
        const activity = normActivity(e.activity)
        if (!isStandard(activity)) flagged.add(activity)
        if (activity === e.activity) return e
        seen.set(e.activity, activity)
        return { ...e, activity, path: rawPath({ ...e, activity }) }
      })
      const log = [...seen].map(([a, b]) => `“${a}” → ${b}`)
      flagged.forEach((a) => log.push(`Flagged: “${a}” is not a standard activity (kept until step 7).`))
      return { entries, changed, removed: [], log }
    },
  },
  {
    id: 'last-row',
    title: 'Delete trailing row',
    what: 'The phone app stops writing mid-line when a recording ends, so the last line of every file is truncated. It is dropped before parsing.',
    pandas: 'df = df.iloc[:-1]  # the writer stopped mid-line',
    run(prev) {
      const log: string[] = []
      const { entries, changed } = mapEntries(prev, (e) => {
        if (e.kind !== 'recording' || !e.lines?.length) return e
        const last = e.lines[e.lines.length - 1]
        log.push(`${tag(e)}: dropped “${last}”`)
        return { ...e, lines: e.lines.slice(0, -1) }
      })
      return { entries, changed, removed: [], log }
    },
  },
  {
    id: 'structure',
    title: 'Structure the data',
    what: 'Semicolon text becomes typed columns. Epoch milliseconds become seconds from the start, and the sampling rate is checked from the timestamps.',
    pandas: 'df = pd.read_csv(path, sep=";",\n    names=["t", "ax", "ay", "az", "gx", "gy", "gz"])\ndf["t_s"] = (df["t"] - df["t"].iloc[0]) / 1000',
    run(prev) {
      const log: string[] = []
      const sources = new Map<string, number[][]>()
      const { entries, changed } = mapEntries(prev, (e) => {
        if (e.kind !== 'recording' || !e.lines) return e
        const parsed = e.lines.map((l) => l.split(';').map(Number)).filter((r) => r.length === 7 && r.every(Number.isFinite))
        const t0 = parsed[0]?.[0] ?? 0
        const rows = parsed.map((r) => [Math.round(r[0] - t0) / 1000, ...r.slice(1)])
        const dur = rows.length > 1 ? rows[rows.length - 1][0] - rows[0][0] : 0
        const hz = dur ? (rows.length - 1) / dur : 0
        log.push(`${tag(e)}: ${rows.length} rows × 7 columns, ${hz.toFixed(1)} Hz, ${dur.toFixed(1)} s`)
        sources.set(e.source, rows)
        return { ...e, lines: undefined, rows }
      })
      return { entries, changed, removed: [], log, sources }
    },
  },
  {
    id: 'atomic',
    title: 'Convert to atomic windows',
    what: 'Each recording is cut into fixed, non-overlapping windows (5 s at 50 Hz is 250 rows). A tail shorter than one window is dropped, so every sample the model sees has the same shape.',
    pandas: 'win = 5 * 50\nwindows = [df.iloc[i:i + win]\n           for i in range(0, len(df) - win + 1, win)]\njson.dump([w.to_dict("list") for w in windows], f)',
    run(prev, p) {
      const log: string[] = []
      const win = Math.round(p.windowSec * RATE)
      const entries: Entry[] = []
      const changed = new Set<string>()
      const removed: Entry[] = []
      for (const e of prev.entries) {
        if (e.kind !== 'recording' || !e.rows) { entries.push(e); continue }
        const count = Math.floor(e.rows.length / win)
        const tail = (e.rows.length - count * win) / RATE
        for (let i = 0; i < count; i++) {
          const key = `${e.source}-w${i + 1}`
          changed.add(key)
          entries.push({
            ...e, key, kind: 'window', file: `w${pad(i + 1)}.json`,
            path: `atomic/${e.subject}/${e.activity}/w${pad(i + 1)}.json`,
            rows: e.rows.slice(i * win, (i + 1) * win),
            span: { index: i + 1, start: (i * win) / RATE, end: ((i + 1) * win) / RATE },
          })
        }
        removed.push(e)
        log.push(`${tag(e)}: ${count} window${count === 1 ? '' : 's'}${tail > 0 ? `, ${tail.toFixed(2)} s tail dropped` : ''}`)
      }
      return { entries, changed, removed, log }
    },
  },
  {
    id: 'csv',
    title: 'Rename and export CSV (raw dataset)',
    what: 'Windows are flattened into one folder with self-describing names (subject_activity_window.csv), which is what training code and spreadsheets expect.',
    pandas: 'for i, w in enumerate(windows, 1):\n    w.to_csv(f"raw_dataset/{subj}_{act}_w{i:02d}.csv", index=False)',
    run(prev) {
      const { entries, changed } = mapEntries(prev, (e) => {
        if (e.kind !== 'window' || !e.span) return e
        const file = `${e.subject}_${e.activity}_w${pad(e.span.index)}.csv`
        return { ...e, file, path: `raw_dataset/${file}` }
      })
      return { entries, changed, removed: [], log: [`${entries.filter((e) => e.kind === 'window').length} CSV files written to raw_dataset/`] }
    },
  },
  {
    id: 'cleanup',
    title: 'Remove unwanted files (final dataset)',
    what: 'System files, notes and recordings whose activity is not in the standard vocabulary are removed. What is left is the final dataset.',
    pandas: 'keep = files[files.activity.isin(STANDARD)\n             & ~files.name.str.startswith(".")]',
    run(prev) {
      const log: string[] = []
      const removed: Entry[] = []
      const entries: Entry[] = []
      const changed = new Set<string>()
      for (const e of prev.entries) {
        if (e.kind === 'junk' || !isStandard(e.activity)) {
          removed.push(e)
          log.push(`Removed ${e.kind === 'junk' ? e.path : e.file}${e.kind === 'junk' ? '' : ` (“${e.activity}” is not standard)`}`)
          continue
        }
        const n = { ...e, path: `final_dataset/${e.file}` }
        changed.add(n.key)
        entries.push(n)
      }
      log.push(`${entries.length} files in final_dataset/`)
      return { entries, changed, removed, log }
    },
  },
  {
    id: 'falls',
    title: 'Fall segmentation (Fall + ADL datasets)',
    what: 'Fixed windows can slice a fall in half. For fall recordings the impact is found (acceleration magnitude above a threshold) and one window is cut centred on it. Everything else becomes the ADL (activities of daily living) dataset.',
    pandas: 'mag = np.sqrt(df.ax**2 + df.ay**2 + df.az**2)\npeak = mag.idxmax()\nif mag[peak] > 2.5 * 9.81:\n    fall = df.loc[peak - win // 2 : peak + win // 2 - 1]',
    run(prev, p) {
      const log: string[] = []
      const removed: Entry[] = []
      const entries: Entry[] = []
      const changed = new Set<string>()
      const win = Math.round(p.windowSec * RATE)
      const done = new Set<string>()
      for (const e of prev.entries) {
        const isFall = e.activity.startsWith('fall')
        if (!isFall) {
          const n: Entry = { ...e, dataset: 'adl', path: `adl_dataset/${e.file}` }
          changed.add(n.key)
          entries.push(n)
          continue
        }
        removed.push(e)
        if (done.has(e.source)) continue
        done.add(e.source)
        const rows = prev.sources.get(e.source) ?? []
        const peak = impactIndex(rows)
        const peakG = peak >= 0 ? magnitude(rows[peak]) / G : 0
        if (peak < 0 || peakG < p.fallG) {
          log.push(`${tag(e)}: peak ${peakG.toFixed(2)} g is below ${p.fallG.toFixed(1)} g. No impact found, left out of both datasets for review.`)
          continue
        }
        const start = Math.max(0, Math.min(rows.length - win, peak - Math.floor(win / 2)))
        const file = `${e.subject}_${e.activity}_impact.csv`
        const key = `${e.source}-impact`
        changed.add(key)
        entries.push({
          ...e, key, kind: 'segment', dataset: 'fall', file, path: `fall_dataset/${file}`,
          rows: rows.slice(start, start + win),
          span: { index: 1, start: start / RATE, end: (start + win) / RATE },
        })
        log.push(`${tag(e)}: impact ${peakG.toFixed(2)} g at ${(peak / RATE).toFixed(2)} s → one centred ${p.windowSec} s segment`)
      }
      const adl = entries.filter((e) => e.dataset === 'adl').length
      const falls = entries.filter((e) => e.dataset === 'fall').length
      log.push(`ADL dataset: ${adl} windows · Fall dataset: ${falls} segment${falls === 1 ? '' : 's'}`)
      return { entries, changed, removed, log }
    },
  },
]

/** Index of the largest acceleration magnitude (-1 when empty). */
export function impactIndex(rows: number[][]) {
  let best = -1, bestV = -Infinity
  rows.forEach((r, i) => { const m = magnitude(r); if (m > bestV) { bestV = m; best = i } })
  return best
}

export function initialStage(raw: RawFile[]): Stage {
  return {
    entries: raw.map((f) => ({
      key: f.id, source: f.id, path: f.path, file: f.path.split('/').pop() ?? '', subject: f.subject, activity: f.activity,
      kind: f.kind, lines: f.lines,
    })),
    removed: [],
    changed: new Set(),
    log: [`${raw.length} files exported from the phone app.`],
    sources: new Map(),
  }
}

/** Run every step once; stages[0] is the raw export, stages[i] is after step i. */
export function runPipeline(raw: RawFile[], p: Params): Stage[] {
  const stages = [initialStage(raw)]
  for (const step of STEPS) {
    const prev = stages[stages.length - 1]
    const out = step.run(prev, p)
    stages.push({ ...out, sources: out.sources ?? prev.sources })
  }
  return stages
}

/**
 * Gravity from an accelerometer: zero-phase low-pass (a first-order filter run forwards
 * then backwards). Body acceleration is what is left after subtracting it.
 */
export function gravitySplit(values: number[], cutoffHz: number): { gravity: number[]; body: number[] } {
  const dt = 1 / RATE
  const rc = 1 / (2 * Math.PI * cutoffHz)
  const a = dt / (rc + dt)
  const fwd: number[] = []
  let y = values[0] ?? 0
  for (const v of values) { y += a * (v - y); fwd.push(y) }
  const out = new Array<number>(fwd.length)
  y = fwd[fwd.length - 1] ?? 0
  for (let i = fwd.length - 1; i >= 0; i--) { y += a * (fwd[i] - y); out[i] = y }
  return { gravity: out, body: values.map((v, i) => v - out[i]) }
}

export function toCsv(rows: number[][]): string {
  return ['t_s,ax,ay,az,gx,gy,gz', ...rows.map((r) => [r[0].toFixed(3), ...r.slice(1).map((v) => v.toFixed(4))].join(','))].join('\n')
}
