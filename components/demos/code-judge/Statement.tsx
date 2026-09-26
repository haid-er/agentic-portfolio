/** Problem statement: title, tags, signature, constraints, samples, editorial and C++ note. */
import { Badge } from '@/components/ui'
import { expectedFor, preview, type Problem } from './problems'

export function Statement({ problem, solved }: { problem: Problem; solved: boolean }) {
  return (
    <article className="grid gap-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="display text-3 m-0 leading-tight">{problem.title}</h3>
        {solved ? <Badge tone="ok">solved</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={problem.difficulty === 'Easy' ? 'accent' : 'warn'}>{problem.difficulty}</Badge>
        {problem.tags.map((t) => <Badge key={t}>{t}</Badge>)}
        <Badge>limit {problem.timeLimitMs} ms / test</Badge>
      </div>
      {problem.statement.map((p, i) => <p key={i} className="m-0 measure">{p}</p>)}

      <dl className="m-0 grid gap-1 font-mono text-00">
        <div className="flex flex-wrap gap-x-2"><dt className="text-ink-3 uppercase tracking-[.08em]">Signature</dt><dd className="m-0 text-ink">solve({problem.params.join(', ')})</dd></div>
        <div className="flex flex-wrap gap-x-2"><dt className="text-ink-3 uppercase tracking-[.08em]">Returns</dt><dd className="m-0 text-ink">{problem.returns}</dd></div>
      </dl>

      <div>
        <p className="mono text-ink-3 m-0 mb-1">Constraints</p>
        <ul className="m-0 pl-5 text-0 text-ink-2">
          {problem.constraints.map((c) => <li key={c} className="nums">{c}</li>)}
        </ul>
      </div>

      <div className="grid gap-2">
        <p className="mono text-ink-3 m-0">Samples</p>
        {problem.samples.map((s, i) => (
          <div key={i} className="grid gap-1 p-3 bg-bg-2 border border-rule-soft rounded-1 font-mono text-00 min-w-0">
            <div className="[overflow-wrap:anywhere]"><span className="text-ink-3">in  </span>{s.args.map((a) => preview(a, 90)).join(', ')}</div>
            <div className="[overflow-wrap:anywhere]"><span className="text-ink-3">out </span>{preview(expectedFor(problem, s.args), 90)}</div>
            {s.note ? <div className="font-body text-0 text-ink-2">{s.note}</div> : null}
          </div>
        ))}
      </div>

      <details className="group border-t border-rule-soft pt-2">
        <summary className="cursor-pointer min-h-tap flex items-center mono text-accent-ink">Editorial (spoiler)</summary>
        <p className="m-0 mt-2 text-0 measure">{problem.editorial}</p>
        <p className="mono text-ink-3 m-0 mt-3 mb-1">The same idea in C++</p>
        <pre className="m-0 p-3 bg-bg-2 border border-rule-soft rounded-1 font-mono text-00 whitespace-pre-wrap [overflow-wrap:anywhere]">{problem.cpp}</pre>
      </details>
    </article>
  )
}
