import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'A seeded, synthetic export of eight phone IMU recordings (accelerometer and gyroscope at 50 Hz) is generated in your browser, complete with hand-typed folder names, truncated last lines and stray files. Each of the eight steps is a pure TypeScript function over the previous step’s file list, mirroring what a pandas script would do: standardise names, drop the broken row, parse typed columns, cut atomic 5-second windows, export CSVs, remove unwanted files and finally re-cut fall recordings around the impact to split Fall and ADL datasets. A zero-phase low-pass filter shows how gravity is separated from body acceleration.',
  limits: [
    'All recordings are synthetic. No participant data is included.',
    'The pandas snippets are illustrative equivalents, not the original scripts.',
    'Fall detection here is a single peak-magnitude threshold, a teaching simplification.',
  ],
  stack: ['TypeScript', 'SVG', 'React 19', 'pandas concepts'],
}
