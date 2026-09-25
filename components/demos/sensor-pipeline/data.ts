/**
 * Synthetic "raw export" for the pipeline demo: a messy folder of phone IMU recordings
 * (accelerometer m/s^2 + gyroscope rad/s at 50 Hz) with the usual problems:
 * inconsistent subject and activity names, a truncated last line, stray files.
 * Everything is generated from a seed. None of it is real participant data.
 */
import { seeded } from '@/lib/utils'

export const RATE = 50 // Hz
export const G = 9.81
const EPOCH = 1733140800000 // arbitrary fixed start time (ms)

export type Motion = 'walking' | 'jogging' | 'squatting' | 'sitting' | 'fall_fwd' | 'fall_back' | 'idle'

export interface RawFile {
  id: string
  path: string
  subject: string
  activity: string
  kind: 'recording' | 'junk'
  lines: string[]
}

interface Spec { id: string; subject: string; activity: string; motion: Motion; seconds: number; file?: string }

const SPECS: Spec[] = [
  { id: 'r1', subject: 'Subject 1', activity: 'Walking', motion: 'walking', seconds: 22 },
  { id: 'r2', subject: 'subj_02', activity: 'walk', motion: 'walking', seconds: 17 },
  { id: 'r3', subject: 'S03', activity: 'Sitting Down From Standing', motion: 'sitting', seconds: 11 },
  { id: 'r4', subject: 'subject1', activity: 'squat', motion: 'squatting', seconds: 16 },
  { id: 'r5', subject: 'Subj-02 ', activity: 'fall forward', motion: 'fall_fwd', seconds: 12 },
  { id: 'r6', subject: 's03', activity: 'Jogging', motion: 'jogging', seconds: 14 },
  { id: 'r7', subject: 'S03', activity: 'Fall_Backward', motion: 'fall_back', seconds: 13 },
  { id: 'r8', subject: 'subj_02', activity: 'test_recording', motion: 'idle', seconds: 7 },
]

type V3 = [number, number, number]
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r())
const bump = (t: number, c: number, w: number) => Math.exp(-((t - c) ** 2) / (2 * w * w))
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

/** One recording as rows [t_ms, ax, ay, az, gx, gy, gz]. */
function synth(motion: Motion, seconds: number, rng: () => number): number[][] {
  const n = Math.round(seconds * RATE)
  const rows: number[][] = []
  const f = motion === 'jogging' ? 2.7 : 1.8 + rng() * 0.3
  const ph = rng() * 6.28
  const fallAt = seconds * (0.45 + rng() * 0.15)
  const sitAt = seconds * 0.4
  let prevTilt = 0
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    let v = 0, side = 0, tilt = 0
    switch (motion) {
      case 'walking':
        v = 2.4 * (Math.sin(2 * Math.PI * f * t + ph) + 0.3 * Math.sin(4 * Math.PI * f * t)); side = 0.9 * Math.sin(Math.PI * f * t); tilt = 0.06 * Math.sin(Math.PI * f * t)
        break
      case 'jogging':
        v = 6 * (2.2 * Math.abs(Math.sin(Math.PI * f * t + ph)) ** 3 - 0.93); side = 1.6 * Math.sin(Math.PI * f * t); tilt = 0.1 * Math.sin(Math.PI * f * t)
        break
      case 'squatting':
        v = 1.8 * Math.cos((2 * Math.PI * t) / 2.6); tilt = 0.14 * (1 - Math.cos((2 * Math.PI * t) / 2.6))
        break
      case 'sitting':
        tilt = 1.35 * smooth((t - sitAt) / 1.2); v = -1.3 * bump(t, sitAt + 0.35, 0.2) + 3 * bump(t, sitAt + 1.05, 0.09)
        break
      case 'fall_fwd':
      case 'fall_back': {
        const walking = t < fallAt
        if (walking) { v = 2.2 * Math.sin(2 * Math.PI * f * t + ph); side = 0.8 * Math.sin(Math.PI * f * t) }
        // free fall dip, then impact, then lying still
        v += -8.2 * bump(t, fallAt + 0.25, 0.12) + 30 * bump(t, fallAt + 0.55, 0.035) + 6 * bump(t, fallAt + 0.7, 0.05)
        tilt = (motion === 'fall_fwd' ? 1 : -1) * 1.5 * smooth((t - fallAt - 0.1) / 0.5)
        break
      }
      case 'idle':
        tilt = 0.03 * Math.sin(t)
        break
    }
    const up: V3 = [0.1, Math.cos(tilt), Math.sin(tilt)]
    const noise = motion === 'jogging' ? 0.35 : 0.12
    const gyro = (tilt - prevTilt) * RATE
    prevTilt = tilt
    rows.push([
      EPOCH + Math.round(t * 1000),
      (G + v) * up[0] + side + noise * gauss(rng),
      (G + v) * up[1] + noise * gauss(rng),
      (G + v) * up[2] + noise * gauss(rng),
      gyro + 0.02 * gauss(rng),
      0.3 * side / 3 + 0.02 * gauss(rng),
      0.02 * gauss(rng),
    ])
  }
  return rows
}

const fmt = (row: number[]) => [String(row[0]), ...row.slice(1).map((v) => v.toFixed(4))].join(';')

/** The raw export, as the phone app might leave it. Deterministic. */
export function rawExport(seed = 2024): RawFile[] {
  const rng = seeded(seed)
  const files: RawFile[] = SPECS.map((s) => {
    const lines = synth(s.motion, s.seconds, rng).map(fmt)
    // the writer was stopped mid-line: the last line is truncated
    const last = lines[lines.length - 1] ?? ''
    lines[lines.length - 1] = last.slice(0, Math.max(14, Math.floor(last.length * 0.4)))
    return { id: s.id, path: `raw/${s.subject}/${s.activity}/imu.txt`, subject: s.subject, activity: s.activity, kind: 'recording' as const, lines }
  })
  files.push(
    { id: 'j1', path: 'raw/Subject 1/.DS_Store', subject: 'Subject 1', activity: '', kind: 'junk', lines: ['(binary)'] },
    { id: 'j2', path: 'raw/S03/notes.txt', subject: 'S03', activity: '', kind: 'junk', lines: ['battery died at the end of the second fall, re-recorded'] },
  )
  return files
}

export const COLUMNS = ['t_s', 'ax', 'ay', 'az', 'gx', 'gy', 'gz'] as const
