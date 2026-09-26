import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'A small model of a BullMQ queue and one worker runs in simulated time in your browser. Jobs move waiting → active → completed or failed; a failed attempt is retried after a fixed or exponential backoff (delay × 2^(attemptsMade − 1)) until its attempts run out. Delayed jobs wait in the delayed set, a job scheduler adds its next instance each time the current one starts, and a flow keeps its parent in waiting-children until every child completes (one permanent child failure fails the parent). Crash the worker to see active jobs stall: once their lock expires, the next running worker moves them back to waiting, and a job that stalls twice fails.',
  limits: [
    'A deterministic simulation of BullMQ semantics, not BullMQ itself: there is no Redis and nothing runs on a server.',
    'Lock and stall timings are shortened to seconds so they can be watched; production defaults are longer.',
    'The code panel shows equivalent BullMQ calls for the current settings; it is not executed.',
  ],
  stack: ['TypeScript queue model (BullMQ semantics)', 'React 19', 'CSS timeline'],
}
