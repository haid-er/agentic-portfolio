import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'One seeded stream of requests hits three limiters that share the same budget. The token bucket holds up to "limit" tokens and refills them continuously, so it absorbs a burst and then settles to the average rate. The sliding window keeps the timestamps of accepted requests and allows a new one only while fewer than "limit" fall inside the last window. The fixed window just counts per aligned window, which is why the Boundary pattern slips twice the limit through around a reset. The live panel calls a real edge function that runs the same TypeScript: it answers 200 or 429 with RateLimit-Policy, RateLimit and RateLimit-Remaining/Reset headers, plus Retry-After when you are over the limit.',
  limits: [
    'The simulation runs on simulated time in your browser; traffic is generated, not real.',
    'The edge endpoint keeps its counters in the memory of one edge isolate, so a different isolate or region starts with a fresh budget; production would use a shared store such as Redis.',
    'The endpoint keys on the forwarded client IP, which people behind one network share.',
    '"Worst window" is the most requests allowed in any window-length span so far, the number a downstream service actually has to survive.',
  ],
  stack: ['Next.js edge route handler', 'TypeScript', 'IETF RateLimit header fields', 'SVG', 'requestAnimationFrame', 'React 19'],
}
