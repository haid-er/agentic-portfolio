import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'A seeded generator lays out a day: jobs with a skill, a duration and a window in which service must start, and four technicians with skills, shifts and a home base. The greedy dispatcher takes jobs in window order and gives each to the qualified technician who can start it soonest, which is fast but short-sighted. The optimiser starts from that plan and runs a first-improvement local search: insert unassigned jobs, relocate a job, swap two jobs between technicians, and reverse a stretch of a route (2-opt), accepting only moves that lower a cost of drive time, waiting and penalties without adding lateness or overtime. Pinning a job to a technician or putting it on hold overrides both, and any assigned job previews its invoice.',
  limits: [
    'Travel is straight-line distance times a road factor at a fixed speed, not a real road network or live traffic.',
    'Jobs, technicians, addresses, rates, parts and tax are synthetic and illustrative.',
    'Local search finds a good plan, not a proven optimum; the cost chart shows how far it moved from greedy.',
    'Small map pins are backed by full-size rows in the jobs table for touch and keyboard use.',
  ],
  stack: ['React 19', 'TypeScript (greedy + local search, no libraries)', 'SVG map and Gantt', 'Clipboard API'],
}
