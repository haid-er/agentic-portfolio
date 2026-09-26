import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'The page opens an EventSource on /api/demos/telemetry, an edge function that keeps one HTTP response open and writes a text/event-stream frame for every sample (id, event and data lines), plus a comment ping every 15 seconds. Each reading is a pure function of the scenario, seed and sequence number, so when the function rotates the connection after about 50 seconds the browser reconnects on its own, sends Last-Event-ID, and the stream continues exactly where it stopped. Charts are plain SVG strip charts; thresholds fire an alert only when a series crosses into its alert zone. Freezing the view keeps buffering in the background, and if the stream cannot be reached the same generator can run locally in the tab.',
  limits: [
    'All values are simulated from a seeded generator. No real vehicle or wearable is connected, and nothing is estimated from real data.',
    'Delivery lag compares the server clock with your clock, so clock skew is included in that number.',
    'The stream closes while the demo is off-screen or the tab is hidden, to save resources, and resumes when you return.',
  ],
  stack: ['Server-Sent Events (EventSource)', 'Next.js edge route + ReadableStream', 'Zod query validation', 'SVG', 'React 19'],
}
