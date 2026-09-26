/**
 * A deterministic CI/CD run model. Jobs form a DAG (`needs`), run on a limited pool of runners,
 * restore and save caches in a store that survives between runs, fail on injected faults,
 * auto-retry with backoff, and wait at an approval gate before production.
 * Time is simulated seconds; the UI scales it for watching.
 */
import { seeded } from '@/lib/utils'

export type StageId = 'lint' | 'test' | 'build' | 'docker' | 'deploy'
export type Target = 'aws' | 'vercel'
export type Branch = 'feature' | 'main'
export type Fault = 'none' | 'flaky-e2e' | 'lint-error' | 'push-timeout'
export type JobStatus = 'waiting' | 'queued' | 'running' | 'retrying' | 'approval' | 'success' | 'failed' | 'skipped' | 'cancelled'
export type RunResult = 'running' | 'success' | 'failed' | 'cancelled'

export const STAGES: { id: StageId; label: string }[] = [
  { id: 'lint', label: 'Lint' },
  { id: 'test', label: 'Test' },
  { id: 'build', label: 'Build' },
  { id: 'docker', label: 'Docker' },
  { id: 'deploy', label: 'Deploy' },
]

export interface RunConfig {
  branch: Branch
  target: Target
  fault: Fault
  runners: number
  autoRetry: boolean
  /** Bumped by "change package-lock.json"; part of every cache key. */
  lockVersion: number
}

interface StepCtx { hit: boolean; attempt: number; cfg: RunConfig; sha: string; rand: () => number }

interface StepDef {
  name: string
  cmd?: string
  /** Base duration in simulated seconds (cache miss). */
  dur: number
  /** Cache this step restores; `hitDur` replaces `dur` on a hit. */
  cache?: { kind: 'npm' | 'next' | 'docker'; hitDur: number }
  /** Speeds up when a cache the job restored earlier was a hit (npm ci after a restored npm cache). */
  fasterWith?: { kind: 'npm' | 'next' | 'docker'; hitDur: number }
  logs?: (c: StepCtx) => string[]
  /** Returns an error line when the step should fail on this attempt. */
  fails?: (c: StepCtx) => string | null
  /** Saves the cache of this kind if it was a miss and the job succeeded (post step). */
  saves?: 'npm' | 'next' | 'docker'
}

export interface JobDef {
  id: string
  name: string
  stage: StageId
  needs: string[]
  steps: StepDef[]
  gate?: string
  /** Shown instead of running: `if:` evaluated false. */
  skipReason?: string
}

export interface StepRun { name: string; dur: number; status: 'pending' | 'running' | 'ok' | 'failed'; cache?: 'hit' | 'miss' }

export interface Span { start: number; end: number | null; kind: 'queued' | 'run' | 'backoff'; failed?: boolean }

export interface JobRun {
  def: JobDef
  status: JobStatus
  attempt: number
  stepIndex: number
  stepElapsed: number
  steps: StepRun[]
  logs: string[]
  spans: Span[]
  /** Simulated seconds of runner time used (billable). */
  runnerSeconds: number
  hits: Set<string>
  backoffLeft: number
  approved: boolean
}

export interface Snapshot {
  number: number
  sha: string
  cfg: RunConfig
  time: number
  result: RunResult
  jobs: JobRun[]
  cacheHits: number
  cacheMisses: number
  runnerSeconds: number
}

const hex = (rand: () => number, n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('')
export const shaFor = (n: number) => hex(seeded(n * 7919 + 17), 7)

function cacheKey(kind: 'npm' | 'next' | 'docker', cfg: RunConfig) {
  const lock = hex(seeded(cfg.lockVersion * 104729 + 3), 12)
  if (kind === 'npm') return `npm-linux-x64-${lock}`
  if (kind === 'next') return `nextjs-${lock}`
  return `buildx-gha-${lock}`
}

// ---- step library ------------------------------------------------------------------------

const setup = (): StepDef[] => [
  { name: 'Set up job', dur: 3, logs: () => ['Runner image: ubuntu-24.04', 'Hosted runner, 4 vCPU'] },
  { name: 'Checkout', cmd: 'actions/checkout@v4', dur: 2, logs: (c) => [`HEAD is now at ${c.sha}`] },
  {
    name: 'Restore npm cache', cmd: 'actions/setup-node@v4 (cache: npm)', dur: 2, cache: { kind: 'npm', hitDur: 4 },
    logs: (c) => (c.hit ? [`Cache restored from key: ${cacheKey('npm', c.cfg)}`, 'Received 212 MB'] : [`Cache not found for input keys: ${cacheKey('npm', c.cfg)}`]),
  },
  {
    name: 'Install', cmd: 'npm ci', dur: 46, fasterWith: { kind: 'npm', hitDur: 11 },
    logs: (c) => [c.hit ? 'added 1204 packages from the restored cache' : 'added 1204 packages from the registry'],
  },
]

const post = (kind: 'npm' | 'next' | 'docker'): StepDef => ({
  name: 'Post: save cache', dur: 6, saves: kind,
  logs: (c) => [`Cache saved with key: ${cacheKey(kind, c.cfg)}`],
})

function buildJobs(cfg: RunConfig): JobDef[] {
  const aws = cfg.target === 'aws'
  const main = cfg.branch === 'main'
  const jobs: JobDef[] = [
    {
      id: 'lint', name: 'eslint', stage: 'lint', needs: [],
      steps: [...setup(), {
        name: 'Lint', cmd: 'npx eslint . --max-warnings 0', dur: 14,
        fails: (c) => (c.cfg.fault === 'lint-error' ? "app/page.tsx  12:7  error  'draft' is assigned a value but never used  no-unused-vars" : null),
        logs: () => ['0 problems'],
      }, post('npm')],
    },
    {
      id: 'typecheck', name: 'typecheck', stage: 'lint', needs: [],
      steps: [...setup(), { name: 'Type check', cmd: 'npx tsc --noEmit', dur: 19, logs: () => ['Found 0 errors.'] }],
    },
    ...[20, 22].map((v): JobDef => ({
      id: `unit-${v}`, name: `unit (node ${v})`, stage: 'test', needs: ['lint', 'typecheck'],
      steps: [...setup(), {
        name: 'Unit tests', cmd: 'npx vitest run --coverage', dur: v === 20 ? 31 : 28,
        logs: () => ['Test Files  38 passed (38)', '     Tests  214 passed (214)'],
      }],
    })),
    {
      id: 'e2e', name: 'e2e (playwright)', stage: 'test', needs: ['lint', 'typecheck'],
      steps: [...setup(), { name: 'Install browsers', cmd: 'npx playwright install --with-deps chromium', dur: 22 }, {
        name: 'E2E tests', cmd: 'npx playwright test', dur: 48,
        fails: (c) => (c.cfg.fault === 'flaky-e2e' && c.attempt === 1
          ? 'checkout.spec.ts:41  expect(locator).toBeVisible() timed out after 5000ms'
          : null),
        logs: (c) => [c.attempt > 1 ? '24 passed (checkout.spec.ts passed on this attempt)' : '24 passed'],
      }],
    },
    {
      id: 'build', name: 'next build', stage: 'build', needs: ['unit-20', 'unit-22', 'e2e'],
      steps: [...setup(), {
        name: 'Restore .next/cache', cmd: 'actions/cache@v4', dur: 1, cache: { kind: 'next', hitDur: 3 },
        logs: (c) => (c.hit ? [`Cache restored from key: ${cacheKey('next', c.cfg)}`] : ['Cache not found; building from scratch']),
      }, {
        name: 'Build', cmd: 'npm run build', dur: 84, fasterWith: { kind: 'next', hitDur: 37 },
        logs: () => ['Compiled successfully', 'Generating static pages (42/42)', 'Route (app) sizes written to .next/'],
      }, { name: 'Upload artifact', cmd: 'actions/upload-artifact@v4', dur: 5, logs: () => ['Artifact "next-build" uploaded'] }, post('next')],
    },
    {
      id: 'docker', name: 'image', stage: 'docker', needs: ['build'],
      skipReason: aws ? undefined : 'Vercel builds from source, so no image is needed (if: target == aws).',
      steps: [
        { name: 'Set up job', dur: 3 },
        { name: 'Checkout', cmd: 'actions/checkout@v4', dur: 2, logs: (c) => [`HEAD is now at ${c.sha}`] },
        { name: 'Set up Buildx', cmd: 'docker/setup-buildx-action@v3', dur: 4 },
        { name: 'Log in to ECR', cmd: 'aws-actions/amazon-ecr-login@v2', dur: 3, logs: () => ['Login Succeeded'] },
        {
          name: 'Restore layer cache', cmd: 'cache-from: type=gha', dur: 1, cache: { kind: 'docker', hitDur: 4 },
          logs: (c) => (c.hit ? ['importing cache manifest from gha'] : ['no cache manifest found (first build for this lockfile)']),
        },
        {
          name: 'Build image', cmd: 'docker buildx build --target runner -t web:$SHA .', dur: 132, fasterWith: { kind: 'docker', hitDur: 26 },
          logs: (c) => c.hit
            ? ['#5 [deps 2/4] COPY package*.json ./  CACHED', '#6 [deps 3/4] RUN npm ci  CACHED', '#9 [builder 4/5] RUN npm run build  CACHED', '#12 [runner 3/3] COPY --from=builder /app/.next/standalone ./']
            : ['#5 [deps 2/4] COPY package*.json ./', '#6 [deps 3/4] RUN npm ci', '#9 [builder 4/5] RUN npm run build', '#12 [runner 3/3] COPY --from=builder /app/.next/standalone ./'],
        },
        {
          name: 'Push image', cmd: 'docker push $ECR_REPO:$SHA', dur: 18,
          fails: (c) => (c.cfg.fault === 'push-timeout' && c.attempt === 1 ? 'error: failed to push: net/http: TLS handshake timeout' : null),
          logs: (c) => [`${c.sha}: digest: sha256:${hex(c.rand, 16)}… size: 2417`],
        },
        post('docker'),
      ],
    },
  ]

  const deployNeeds = aws ? ['docker'] : ['build']
  const deploySteps = (env: 'preview' | 'production'): StepDef[] => aws
    ? [
        { name: 'Set up job', dur: 3 },
        { name: 'Configure AWS credentials', cmd: 'aws-actions/configure-aws-credentials@v4 (OIDC)', dur: 3, logs: () => ['Assumed role deploy-ci via OIDC; no long-lived keys'] },
        { name: 'Render task definition', cmd: 'aws-actions/amazon-ecs-render-task-definition@v1', dur: 2 },
        { name: 'Deploy to ECS', cmd: `aws ecs update-service --cluster ${env} --service web`, dur: 8, logs: () => ['Service update started: rolling, minimum healthy 100%'] },
        { name: 'Wait for stable service', cmd: 'aws ecs wait services-stable', dur: 55, logs: () => ['2/2 tasks healthy on the new task definition'] },
        { name: 'Smoke test', cmd: 'curl -fsS $URL/api/health', dur: 4, logs: () => ['HTTP 200 {"ok":true}'] },
      ]
    : [
        { name: 'Set up job', dur: 3 },
        { name: 'Download artifact', cmd: 'actions/download-artifact@v4', dur: 4 },
        { name: 'Deploy', cmd: `vercel deploy --prebuilt${env === 'production' ? ' --prod' : ''}`, dur: 21, logs: (c) => [`${env === 'production' ? 'Production' : 'Preview'}: https://web-${c.sha}.example.app`] },
        { name: 'Smoke test', cmd: 'curl -fsS $URL/api/health', dur: 4, logs: () => ['HTTP 200 {"ok":true}'] },
      ]

  jobs.push(
    {
      id: 'deploy-preview', name: `preview (${aws ? 'ECS staging' : 'Vercel'})`, stage: 'deploy', needs: deployNeeds,
      skipReason: main ? 'Previews run on feature branches only.' : undefined, steps: deploySteps('preview'),
    },
    {
      id: 'deploy-prod', name: `production (${aws ? 'ECS' : 'Vercel'})`, stage: 'deploy', needs: deployNeeds,
      gate: 'production', skipReason: main ? undefined : 'Production deploys run on main only.', steps: deploySteps('production'),
    },
  )
  return jobs
}

// ---- engine ------------------------------------------------------------------------------

const TERMINAL: JobStatus[] = ['success', 'failed', 'skipped', 'cancelled']
const BACKOFF = 10

export class Pipeline {
  number: number
  sha: string
  cfg: RunConfig
  time = 0
  result: RunResult = 'running'
  jobs: JobRun[]
  private cache: Set<string>
  private rand: () => number

  constructor(number: number, cfg: RunConfig, cache: Set<string>) {
    this.number = number
    this.sha = shaFor(number)
    this.cfg = { ...cfg }
    this.cache = cache
    this.rand = seeded(number * 31 + 7)
    this.jobs = buildJobs(this.cfg).map((def) => ({
      def,
      status: def.skipReason ? 'skipped' : 'waiting',
      attempt: 1,
      stepIndex: 0,
      stepElapsed: 0,
      steps: def.steps.map((s) => ({ name: s.name, dur: s.dur, status: 'pending' })),
      logs: def.skipReason ? [`Skipped: ${def.skipReason}`] : [],
      spans: [],
      runnerSeconds: 0,
      hits: new Set(),
      backoffLeft: 0,
      approved: false,
    }))
  }

  private job(id: string) { return this.jobs.find((j) => j.def.id === id) }
  private stamp() {
    const t = Math.floor(this.time)
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }
  private log(j: JobRun, line: string) { j.logs.push(`${this.stamp()}  ${line}`) }
  private closeSpan(j: JobRun, failed = false) {
    const s = j.spans[j.spans.length - 1]
    if (s && s.end === null) { s.end = this.time; if (failed) s.failed = true }
  }

  private startStep(j: JobRun) {
    const def = j.def.steps[j.stepIndex]
    const run = j.steps[j.stepIndex]
    const jitter = 0.9 + this.rand() * 0.2
    let dur = def.dur
    if (def.cache) {
      const hit = this.cache.has(cacheKey(def.cache.kind, this.cfg))
      run.cache = hit ? 'hit' : 'miss'
      if (hit) { dur = def.cache.hitDur; j.hits.add(def.cache.kind) }
    }
    if (def.fasterWith && j.hits.has(def.fasterWith.kind)) dur = def.fasterWith.hitDur
    if (def.saves && (j.hits.has(def.saves) || this.cache.has(cacheKey(def.saves, this.cfg)))) dur = 1
    run.dur = Math.max(1, Math.round(dur * jitter))
    run.status = 'running'
    j.stepElapsed = 0
    this.log(j, `▸ ${def.name}${def.cmd ? `  $ ${def.cmd}` : ''}`)
  }

  private ctx(j: JobRun, kind?: 'npm' | 'next' | 'docker'): StepCtx {
    return { hit: kind ? j.hits.has(kind) : false, attempt: j.attempt, cfg: this.cfg, sha: this.sha, rand: this.rand }
  }

  /** Finishes the current step; returns false when the job failed. */
  private finishStep(j: JobRun): boolean {
    const def = j.def.steps[j.stepIndex]
    const run = j.steps[j.stepIndex]
    const kind = def.cache?.kind ?? def.fasterWith?.kind
    const c = this.ctx(j, kind)
    const err = def.fails?.(c)
    if (err) {
      run.status = 'failed'
      this.log(j, `  Error: ${err}`)
      this.log(j, `  Process completed with exit code 1 (${run.dur}s)`)
      return false
    }
    if (def.saves) {
      const key = cacheKey(def.saves, this.cfg)
      if (this.cache.has(key) || j.hits.has(def.saves)) {
        this.log(j, `  Cache hit occurred on the primary key ${key}, not saving cache.`)
      } else {
        this.cache.add(key)
        for (const l of def.logs?.(c) ?? []) this.log(j, `  ${l}`)
      }
    } else {
      for (const l of def.logs?.(c) ?? []) this.log(j, `  ${l}`)
    }
    run.status = 'ok'
    this.log(j, `  done in ${run.dur}s`)
    return true
  }

  private resetForAttempt(j: JobRun) {
    j.stepIndex = 0
    j.stepElapsed = 0
    j.hits = new Set()
    j.steps = j.def.steps.map((s) => ({ name: s.name, dur: s.dur, status: 'pending' }))
  }

  /** Advance simulated time by dt seconds. */
  step(dt: number) {
    if (this.result !== 'running') return
    this.time += dt

    // 1. Resolve dependencies.
    for (const j of this.jobs) {
      if (j.status !== 'waiting') continue
      const needs = j.def.needs.map((id) => this.job(id)).filter((n): n is JobRun => Boolean(n) && n?.def.skipReason === undefined)
      if (needs.some((n) => n.status === 'failed' || n.status === 'cancelled' || n.status === 'skipped')) {
        j.status = 'skipped'
        j.logs.push('Skipped: a job it needs did not succeed.')
      } else if (needs.every((n) => n.status === 'success')) {
        if (j.def.gate && !j.approved) {
          j.status = 'approval'
          this.log(j, `Waiting for a reviewer to approve the ${j.def.gate} environment.`)
        } else {
          j.status = 'queued'
          j.spans.push({ start: this.time, end: null, kind: 'queued' })
        }
      }
    }

    // 2. Backoff timers.
    for (const j of this.jobs) {
      if (j.status !== 'retrying') continue
      j.backoffLeft -= dt
      if (j.backoffLeft <= 0) {
        this.closeSpan(j)
        j.status = 'queued'
        j.spans.push({ start: this.time, end: null, kind: 'queued' })
        this.log(j, `Re-queued for attempt ${j.attempt}.`)
      }
    }

    // 3. Hand free runners to queued jobs, in declaration order.
    let busy = this.jobs.filter((j) => j.status === 'running').length
    for (const j of this.jobs) {
      if (busy >= this.cfg.runners) break
      if (j.status !== 'queued') continue
      this.closeSpan(j)
      j.status = 'running'
      j.spans.push({ start: this.time, end: null, kind: 'run' })
      this.log(j, `Job started on runner ${busy + 1} (attempt ${j.attempt})`)
      this.startStep(j)
      busy++
    }

    // 4. Advance running jobs.
    for (const j of this.jobs) {
      if (j.status !== 'running') continue
      j.stepElapsed += dt
      j.runnerSeconds += dt
      while (j.status === 'running' && j.stepElapsed >= j.steps[j.stepIndex].dur) {
        const over = j.stepElapsed - j.steps[j.stepIndex].dur
        if (!this.finishStep(j)) { this.fail(j); break }
        j.stepIndex++
        if (j.stepIndex >= j.steps.length) {
          j.status = 'success'
          this.closeSpan(j)
          this.log(j, `Job succeeded on attempt ${j.attempt}.`)
          break
        }
        this.startStep(j)
        j.stepElapsed = over
      }
    }

    // 5. Is the run over?
    if (this.jobs.every((j) => TERMINAL.includes(j.status))) {
      this.result = this.jobs.some((j) => j.status === 'failed' || j.status === 'cancelled') ? 'failed' : 'success'
    }
  }

  private fail(j: JobRun) {
    this.closeSpan(j, true)
    if (this.cfg.autoRetry && j.attempt === 1) {
      j.attempt = 2
      j.status = 'retrying'
      j.backoffLeft = BACKOFF
      j.spans.push({ start: this.time, end: null, kind: 'backoff' })
      this.resetForAttempt(j)
      this.log(j, `Attempt 1 failed. Retrying once after ${BACKOFF}s backoff.`)
    } else {
      j.status = 'failed'
      this.log(j, `Job failed on attempt ${j.attempt}.`)
    }
  }

  approve(id: string) {
    const j = this.job(id)
    if (!j || j.status !== 'approval') return
    j.approved = true
    j.status = 'queued'
    j.spans.push({ start: this.time, end: null, kind: 'queued' })
    this.log(j, 'Approved by a reviewer. Deployment queued.')
  }

  /** "Re-run failed jobs": failed jobs get a new attempt, and jobs skipped because of them wait again. */
  rerunFailed(): boolean {
    const failed = this.jobs.filter((j) => j.status === 'failed')
    if (!failed.length) return false
    for (const j of failed) {
      j.attempt++
      this.resetForAttempt(j)
      j.status = 'queued'
      j.spans.push({ start: this.time, end: null, kind: 'queued' })
      this.log(j, `Manual re-run: attempt ${j.attempt}.`)
    }
    for (const j of this.jobs) {
      if (j.status === 'skipped' && !j.def.skipReason) { j.status = 'waiting'; j.logs = [] }
    }
    this.result = 'running'
    return true
  }

  cancel() {
    if (this.result !== 'running') return
    for (const j of this.jobs) {
      if (TERMINAL.includes(j.status)) continue
      this.closeSpan(j)
      j.status = 'cancelled'
      this.log(j, 'The run was cancelled.')
    }
    this.result = 'cancelled'
  }

  snapshot(): Snapshot {
    let hits = 0
    let misses = 0
    let runnerSeconds = 0
    for (const j of this.jobs) {
      runnerSeconds += j.runnerSeconds
      for (const s of j.steps) { if (s.cache === 'hit') hits++; else if (s.cache === 'miss') misses++ }
    }
    return {
      number: this.number, sha: this.sha, cfg: this.cfg, time: this.time, result: this.result,
      jobs: this.jobs.map((j) => ({ ...j, steps: j.steps.map((s) => ({ ...s })), logs: [...j.logs], spans: j.spans.map((s) => ({ ...s })) })),
      cacheHits: hits, cacheMisses: misses, runnerSeconds,
    }
  }
}

export function fmt(sec: number): string {
  const t = Math.max(0, Math.round(sec))
  const m = Math.floor(t / 60)
  const s = t % 60
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

export { cacheKey }
