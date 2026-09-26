import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Place components on the board, wire them (only sensible connections are allowed) and set the load. Four times a second a flow model pushes the offered requests from the clients through the graph: the load balancer spreads them across API instances, reads go to the cache and misses read through to the database, and writes go either straight to the database or onto a queue that workers drain. Each component serves up to its capacity and drops the rest, and its latency grows as it fills up (base / (1 - utilisation), the M/M/1 shape). The busiest component over 70% is flagged as the bottleneck with advice on what fixes it, and a queue keeps its backlog between ticks, so slow workers show up as growing lag instead of errors. The AWS and Azure labels show the managed service each box usually maps to.',
  limits: [
    'A teaching model, not a benchmark: capacities are round illustrative numbers and nothing is deployed or measured.',
    'Mean latency only; there are no tail percentiles, network hops, retries from clients or cold starts.',
    'Best on a wide screen. On a phone the board scrolls sideways, and every action also works from the Inspector and the keyboard.',
  ],
  stack: ['TypeScript flow and queueing model', 'SVG with pointer events', 'React 19'],
}
