import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'A planner agent splits your goal into independent subtasks, parallel worker agents take one each, and a reviewer scores and merges their outputs, asking for at most one revision. Each agent runs as an activity on a small Temporal-style runtime written for this page: a retry policy with exponential backoff, a start-to-close timeout per attempt, non-retryable errors, cancellation, and an append-only event history. Every step also opens a span, so the trace draws like a Langfuse waterfall while it runs. Chaos switches crash a worker or hang the reviewer, so you can watch the retries and timeouts happen. A finished run replays from its recorded log without calling any model.',
  limits: [
    'The runtime is an in-browser teaching model of Temporal, not Temporal itself: nothing is persisted, and a page reload loses the run.',
    'Retry attempts are listed as history events for clarity; real Temporal keeps them in the pending activity state.',
    'Live mode makes about 5 to 7 calls to free, rate-limited providers; a quota error ends the run and offers simulated agents instead.',
    'Simulated agents return scripted, generic text with seeded latency; they only show the orchestration.',
  ],
  stack: ['React 19', 'TypeScript', 'Zod structured output', 'AI gateway (Groq / Gemini)', 'Temporal-style retries and timeouts', 'Langfuse-style span tree'],
}
