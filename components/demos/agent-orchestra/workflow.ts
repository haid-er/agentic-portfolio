/**
 * The workflow: planner -> parallel workers -> reviewer (-> one optional revision -> final review).
 * Written like a Temporal workflow function: only orchestration here, all side effects in activities.
 */
import type { Agents, Plan, Review, Task, Work } from './agents'
import { ActivityFailure, CancelledError, runActivity, type Fault, type Recorder, type RetryPolicy } from './engine'

export interface Chaos {
  /** Worker 2 crashes on its first attempt. */
  crashWorker: boolean
  /** The reviewer hangs on its first attempt, so the start-to-close timeout fires. */
  hangReviewer: boolean
}

export interface WorkflowResult {
  goal: string
  plan: Plan
  outputs: Array<{ task: Task; work: Work | null; error?: string }>
  review: Review
  revisions: number
  simulated: boolean
}

export interface WorkflowOptions {
  goal: string
  agents: Agents
  policy: RetryPolicy
  chaos: Chaos
  allowRevision: boolean
  simulated: boolean
  signal: AbortSignal
}

export async function orchestrate(rec: Recorder<WorkflowResult>, o: WorkflowOptions): Promise<WorkflowResult> {
  const wf = rec.start({
    name: 'orchestrate', kind: 'workflow', parentId: null, input: { goal: o.goal },
    attrs: { mode: o.simulated ? 'simulated' : 'live', taskQueue: 'agents', maximumAttempts: o.policy.maximumAttempts },
  })
  rec.event('WorkflowExecutionStarted', `orchestrate(“${o.goal.slice(0, 60)}${o.goal.length > 60 ? '…' : ''}”)`, wf)
  const label = o.simulated ? 'scripted' : 'generation'
  const base = { parentId: wf, policy: o.policy, signal: o.signal, attemptLabel: label }

  try {
    const planned = await runActivity(rec, {
      ...base, name: 'planner', activityType: 'PlanGoal', input: { goal: o.goal },
      fn: (ctx) => o.agents.plan(o.goal, ctx),
    })
    const plan = planned.value
    rec.event('MarkerRecorded', `plan: ${plan.tasks.length} tasks fan out in parallel`, wf)

    const runWorker = (task: Task, i: number, feedback?: string, fault?: Fault) => runActivity(rec, {
      ...base, name: `worker ${i + 1} · ${task.title}${feedback ? ' (revision)' : ''}`, activityType: 'DoSubtask',
      input: { task, ...(feedback ? { feedback } : {}) }, fault,
      fn: (ctx) => o.agents.work(o.goal, task, feedback, ctx),
    })

    const settled = await Promise.allSettled(plan.tasks.map((t, i) => runWorker(t, i, undefined, o.chaos.crashWorker && i === 1 ? { attempt: 1, kind: 'crash' } : undefined)))
    if (o.signal.aborted) throw new CancelledError()
    const outputs: WorkflowResult['outputs'] = settled.map((s, i) => ({
      task: plan.tasks[i] as Task,
      work: s.status === 'fulfilled' ? s.value.value : null,
      ...(s.status === 'rejected' ? { error: s.reason instanceof Error ? s.reason.message : String(s.reason) } : {}),
    }))
    if (!outputs.some((x) => x.work)) {
      // Keep the underlying cause (e.g. quota exhausted) so the UI can offer simulated agents.
      const first = settled.find((s) => s.status === 'rejected')
      const reason: unknown = first?.status === 'rejected' ? first.reason : undefined
      throw new ActivityFailure('every worker', reason instanceof ActivityFailure ? reason.cause : reason)
    }

    const reviewOnce = (final: boolean, fault?: Fault) => runActivity(rec, {
      ...base, name: final ? 'reviewer · final' : 'reviewer', activityType: 'ReviewAndMerge', fault,
      input: { tasks: outputs.map((x) => x.task.id), final },
      fn: (ctx) => o.agents.review(o.goal, plan, outputs.map(({ task, work }) => ({ task, work })), final || !o.allowRevision, ctx),
    })

    let review = (await reviewOnce(false, o.chaos.hangReviewer ? { attempt: 1, kind: 'hang' } : undefined)).value
    let revisions = 0
    const idx = review.verdict === 'revise' ? plan.tasks.findIndex((t) => t.id === review.reviseTaskId) : -1
    if (o.allowRevision && idx >= 0) {
      const task = plan.tasks[idx] as Task
      rec.event('MarkerRecorded', `reviewer asked for a revision of ${task.id} (${task.title}): ${review.notes.slice(0, 90)}`, wf)
      const first = outputs[idx]
      try {
        const redo = await runWorker(task, idx, review.notes)
        outputs[idx] = { task, work: redo.value }
        review = (await reviewOnce(true)).value
        revisions = 1
      } catch (e) {
        // The first review is already a complete result: keep it rather than failing the workflow.
        if (!(e instanceof ActivityFailure) || o.signal.aborted) throw e
        if (first) outputs[idx] = first
        rec.event('MarkerRecorded', `revision failed, keeping first review: ${e.message.slice(0, 90)}`, wf)
      }
    }

    const result: WorkflowResult = { goal: o.goal, plan, outputs, review, revisions, simulated: o.simulated }
    rec.end(wf, 'ok', { output: { score: review.score, verdict: review.verdict, revisions } })
    rec.event('WorkflowExecutionCompleted', `score ${review.score}/10 · ${revisions} revision${revisions === 1 ? '' : 's'}`, wf)
    rec.emit({ type: 'status', status: 'completed', result })
    return result
  } catch (e) {
    if (e instanceof CancelledError || o.signal.aborted) {
      rec.end(wf, 'cancelled')
      rec.event('WorkflowExecutionCanceled', 'cancel requested by user', wf)
      rec.emit({ type: 'status', status: 'cancelled' })
    } else {
      const msg = e instanceof ActivityFailure || e instanceof Error ? e.message : String(e)
      rec.end(wf, 'error', { error: msg })
      rec.event('WorkflowExecutionFailed', msg, wf)
      rec.emit({ type: 'status', status: 'failed', error: msg })
    }
    throw e
  }
}
