import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Each run builds a job graph from your settings: eslint and typecheck in parallel, a Node 20/22 unit matrix plus Playwright e2e, next build, a Docker image pushed to a registry (AWS only) and a preview or production deploy. A scheduler hands jobs to a limited pool of runners in dependency order, so queue time and parallelism show up on the timeline. Caches are keyed on the lockfile and live in a store that survives between runs: the first run misses and saves, later jobs and later runs restore them, and changing package-lock.json invalidates every key. Injected faults fail a step; auto-retry re-queues it once after a backoff, a manual re-run gives it a new attempt, and a real lint error keeps failing until you push a fix. Runs on main stop at a production approval gate.',
  limits: [
    'A simulation: nothing is built, pushed or deployed, and no cloud account is touched. Step durations are illustrative and time runs faster than real (the scale is shown).',
    'The workflow YAML matches the settings and uses real action names, but it is not executed here.',
    'Cache contents and run history are kept only in this browser (localStorage).',
  ],
  stack: ['TypeScript DAG scheduler', 'React 19', 'CSS timeline', 'GitHub Actions YAML generator'],
}
