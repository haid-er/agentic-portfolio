/**
 * The three agent roles (planner, worker, reviewer) in two flavours:
 * - live: structured output through the lib/ai gateway (zod-validated), one call per attempt;
 * - simulated: scripted, seeded outputs with realistic latency, so the orchestration can be
 *   watched offline. The UI labels simulated runs as such.
 */
import { z } from 'zod'
import { generateObject, type AiMeta } from '@/lib/ai'
import type { DemoSlug } from '@/lib/demos/slugs'
import { seeded } from '@/lib/utils'
import { sleep, type ActivityResult } from './engine'

export const PlanSchema = z.object({
  summary: z.string().max(400),
  tasks: z.array(z.object({
    id: z.string().max(20),
    title: z.string().max(80),
    brief: z.string().max(400),
  })).min(2).max(4),
})
export type Plan = z.infer<typeof PlanSchema>
export type Task = Plan['tasks'][number]

export const WorkSchema = z.object({
  output: z.string().max(1600),
  confidence: z.number().min(0).max(1),
})
export type Work = z.infer<typeof WorkSchema>

export const ReviewSchema = z.object({
  verdict: z.enum(['approve', 'revise']),
  score: z.number().min(0).max(10),
  notes: z.string().max(600),
  reviseTaskId: z.string().max(20).nullish(),
  finalAnswer: z.string().max(2400),
})
export type Review = z.infer<typeof ReviewSchema>

export interface AgentCtx { signal: AbortSignal; attempt: number }
export interface Agents {
  plan(goal: string, ctx: AgentCtx): Promise<ActivityResult<Plan>>
  work(goal: string, task: Task, feedback: string | undefined, ctx: AgentCtx): Promise<ActivityResult<Work>>
  review(goal: string, plan: Plan, outputs: Array<{ task: Task; work: Work | null }>, final: boolean, ctx: AgentCtx): Promise<ActivityResult<Review>>
}

/* ------------------------------------------------------------------ */
/* live                                                                */
/* ------------------------------------------------------------------ */

const usageAttrs = (m: AiMeta) => ({
  provider: m.provider, model: m.model, latencyMs: m.latencyMs,
  inputTokens: m.usage?.inputTokens ?? 0, outputTokens: m.usage?.outputTokens ?? 0,
})

export function liveAgents(demo: DemoSlug, maxTasks: number): Agents {
  return {
    async plan(goal, ctx) {
      const res = await generateObject({
        demo, schemaName: 'Plan', schema: PlanSchema, maxTokens: 500, temperature: 0.3,
        system: `You are the PLANNER in a multi-agent workflow. Split the user's goal into ${maxTasks === 2 ? '2' : `2 to ${maxTasks}`} independent subtasks that parallel worker agents can do without talking to each other. Each task gets a short id (t1, t2, ...), a title of at most 6 words and a one-sentence brief. Do not do the work yourself.`,
        messages: [{ role: 'user', content: `Goal: ${goal}` }],
      }, { signal: ctx.signal })
      const plan = { ...res.object, tasks: res.object.tasks.slice(0, maxTasks) }
      return { value: plan, output: plan, attrs: usageAttrs(res) }
    },
    async work(goal, task, feedback, ctx) {
      const res = await generateObject({
        demo, schemaName: 'WorkerOutput', schema: WorkSchema, maxTokens: 380, temperature: 0.4,
        system: 'You are a WORKER agent. Do only your assigned subtask, concretely and briefly (at most 120 words, plain text, short bullet lines allowed). Report your confidence from 0 to 1. Do not invent facts, prices or statistics; say what should be checked instead.',
        messages: [{ role: 'user', content: `Overall goal: ${goal}\nYour subtask (${task.id}): ${task.title}. ${task.brief}${feedback ? `\nReviewer feedback to address: ${feedback}` : ''}` }],
      }, { signal: ctx.signal })
      return { value: res.object, output: res.object, attrs: usageAttrs(res) }
    },
    async review(goal, plan, outputs, final, ctx) {
      const body = outputs.map(({ task, work }) => `[${task.id}] ${task.title}\n${work ? `${work.output}\n(confidence ${work.confidence})` : '(worker failed, no output)'}`).join('\n\n')
      const res = await generateObject({
        demo, schemaName: 'Review', schema: ReviewSchema, maxTokens: 700, temperature: 0.2,
        system: `You are the REVIEWER. Check the workers' outputs against the goal, score the combined result 0-10, and write the final answer (at most 180 words) that merges the outputs.${final ? ' This is the final review: verdict must be "approve".' : ' If exactly one task is clearly weak, set verdict "revise", reviseTaskId to its id and explain in notes what to fix; otherwise approve.'}`,
        messages: [{ role: 'user', content: `Goal: ${goal}\nPlan: ${plan.summary}\n\nWorker outputs:\n${body}` }],
      }, { signal: ctx.signal })
      const review = final ? { ...res.object, verdict: 'approve' as const } : res.object
      return { value: review, output: review, attrs: usageAttrs(res) }
    },
  }
}

/* ------------------------------------------------------------------ */
/* simulated                                                           */
/* ------------------------------------------------------------------ */

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

const ANGLES: Array<{ title: string; brief: string; out: (g: string) => string }> = [
  {
    title: 'Scope and success criteria',
    brief: 'Pin down what done means, who it is for and the hard constraints.',
    out: (g) => `Scope for “${g}”:\n- Define the one outcome that counts as done, and who signs it off.\n- List hard constraints first (budget, deadline, tools already in place).\n- Park nice-to-haves in a separate list so they cannot block the first version.`,
  },
  {
    title: 'Options and trade-offs',
    brief: 'List two or three realistic approaches and compare effort, risk and cost.',
    out: () => '- Option A, smallest change: fastest to ship, but may need rework later.\n- Option B, a proper foundation: slower start, cheaper to extend.\n- Option C, buy or reuse: least effort if an existing tool fits.\nRecommend A for a first version, with B as the follow-up once the need is proven.',
  },
  {
    title: 'Step-by-step plan',
    brief: 'Turn the preferred option into ordered, checkable steps.',
    out: () => '1. Write down the acceptance check before starting.\n2. Build the smallest end-to-end slice.\n3. Measure it against the check.\n4. Fix the biggest gap, then repeat step 3.\n5. Document what was decided and why.',
  },
  {
    title: 'Risks and verification',
    brief: 'Name what could go wrong and how each step is verified.',
    out: () => '- Risk: hidden requirements surface late. Check: review the scope with the owner on day one.\n- Risk: the first slice is too big. Check: it must be demoable within a few days.\n- Risk: no one owns follow-up. Check: name an owner for each open item.',
  },
]

export function simulatedAgents(maxTasks: number): Agents {
  const think = async (rand: () => number, ctx: AgentCtx, base: number) => sleep(Math.round(base + rand() * 900), ctx.signal)
  const scripted = { provider: 'simulated', model: 'scripted' }
  return {
    async plan(goal, ctx) {
      const rand = seeded(hash(goal) + ctx.attempt)
      await think(rand, ctx, 700)
      const start = hash(goal) % ANGLES.length
      const n = Math.min(maxTasks, 3 + (hash(goal) % 2))
      const tasks = Array.from({ length: n }, (_, i) => {
        const a = ANGLES[(start + i) % ANGLES.length] as (typeof ANGLES)[number]
        return { id: `t${i + 1}`, title: a.title, brief: a.brief }
      })
      const plan: Plan = { summary: `Split “${goal}” into ${n} independent angles that can be worked in parallel, then merge.`, tasks }
      return { value: plan, output: plan, attrs: scripted }
    },
    async work(goal, task, feedback, ctx) {
      const rand = seeded(hash(goal + task.id) + ctx.attempt * 7)
      await think(rand, ctx, 900 + rand() * 1200)
      const angle = ANGLES.find((a) => a.title === task.title)
      const base = angle ? angle.out(goal) : `Notes on “${task.title}” for ${goal}.`
      const work: Work = {
        output: feedback ? `${base}\n- Revised: ${feedback.replace(/\.$/, '')}; now covered with a concrete example and an owner.` : base,
        confidence: feedback ? 0.86 : Math.round((0.55 + rand() * 0.4) * 100) / 100,
      }
      return { value: work, output: work, attrs: scripted }
    },
    async review(goal, plan, outputs, final, ctx) {
      const rand = seeded(hash(goal) + (final ? 99 : 1))
      await think(rand, ctx, 800)
      const done = outputs.filter((o) => o.work)
      const weakest = [...done].sort((a, b) => (a.work?.confidence ?? 0) - (b.work?.confidence ?? 0))[0]
      const revise = !final && weakest && (weakest.work?.confidence ?? 1) < 0.8
      const review: Review = {
        verdict: revise ? 'revise' : 'approve',
        score: final ? 8.5 : revise ? 6.5 : 8,
        notes: revise
          ? `“${weakest.task.title}” is generic (confidence ${weakest.work?.confidence}). Make it specific to the goal.`
          : `All ${done.length} parts are consistent with the plan${done.length < outputs.length ? `; ${outputs.length - done.length} worker failed and is noted as a gap` : ''}.`,
        reviseTaskId: revise ? weakest.task.id : null,
        finalAnswer: [`Plan for: ${goal}`, ...done.map((o) => `${o.task.title}\n${o.work?.output ?? ''}`)].join('\n\n'),
      }
      return { value: review, output: review, attrs: scripted }
    },
  }
}
