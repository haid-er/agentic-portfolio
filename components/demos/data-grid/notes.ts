import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'The table reads pages through a small React-Query-style cache written for this lab, so each rule can be seen working. Every page and filter is its own cache key: data stays fresh for staleTime, turns stale afterwards, and stale data stays on screen while a background refetch runs. Pages you leave become inactive and are garbage-collected after gcTime. Identical requests share one in-flight fetch, failures retry with exponential backoff, and focusing the window refetches only stale pages that are on screen. Starring a row or changing its status patches the cache first, then calls PATCH /api/demos/items; if the server refuses, the snapshot is restored and the cache is invalidated.',
  limits: [
    'The specimens are synthetic, generated from a seed. Every 15 seconds one row in eight gets a new moisture reading so refetches have something to show.',
    'Edits made through the server API live in the serverless instance memory: they reset when it recycles, and other visitors on the same instance may see them.',
    'The in-browser transport runs the same generator inside the tab. It is used automatically when the browser goes offline.',
    'This is a teaching implementation of the caching ideas, not the TanStack Query library itself.',
  ],
  stack: ['React 19 (useSyncExternalStore)', 'Next.js route handler', 'Zod', 'TypeScript'],
}
