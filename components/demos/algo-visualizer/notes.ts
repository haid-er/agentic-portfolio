import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Each algorithm runs once, in full, and records a trace: the order in which cells are expanded and when each one joined the frontier, or every compare, swap and write for the sorts. The player then replays that trace, so Play, Step, Back and the scrubber are exact and cost nothing. Dijkstra and A* share a hand-written binary heap with lazy deletion; A* adds a Manhattan-distance heuristic, which is admissible here because the cheapest move costs 1. Mud cells cost 5, which is where BFS (steps, not cost) and Dijkstra (cost) disagree. The comparison tables re-run every algorithm on the same board or array, so the counters are real, not estimates.',
  limits: [
    'Movement is 4-directional; there are no diagonal moves.',
    'Grids adapt to screen width (15×15 on a phone, up to 37×19 on desktop); resizing past a breakpoint loads a fresh starter board.',
    'Sorting arrays hold at most 64 items so that each bar stays visible.',
    'Quicksort uses the Lomuto scheme with the last element as pivot on purpose, so its worst case on sorted input is visible.',
  ],
  stack: ['TypeScript', 'React 19', 'Canvas 2D', 'Binary heap', 'requestAnimationFrame'],
}
