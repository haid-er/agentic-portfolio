import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Each combination of toggles rebuilds the resource list of a field-service dashboard: code splitting swaps one monolithic bundle for a vendor chunk and a route chunk, lazy loading moves below-the-fold images and panels after the ready point, compression shrinks text transfers, and dedupe collapses duplicate calls and batches an N+1 pattern. A fluid network model then plays the list in 5 ms steps: six HTTP/1.1 connections, bandwidth shared by active downloads, a round trip plus server time before the first byte, and one main thread that must run every script before the app can call its APIs. The waterfall replays on the baseline’s time scale, so the saving shows up as empty space.',
  limits: [
    'A model, not a measurement: resource sizes, server times and CPU cost are illustrative, not the real product bundle.',
    'The default profile is tuned to land near the reported before and after. Other profiles show how the gap narrows on fast networks.',
    'HTTP/2 multiplexing, caching and CDN effects are not modelled.',
  ],
  stack: ['React 19', 'TypeScript simulation (no libraries)', 'CSS waterfall with requestAnimationFrame replay', 'webpack / React.lazy patterns shown as code'],
}
