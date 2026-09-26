'use client'
/** Result views: framework coverage strip, requirement x framework matrix, finding cards. */
import { Badge, Table, TableWrap, Td, Th, type Tone } from '@/components/ui'
import { cx } from '@/lib/utils'
import { CHECKLIST, FRAMEWORKS, PILLARS, type Framework, type Requirement } from './checklist'
import type { Finding, Status } from './screen'

export const STATUS_LABEL: Record<Status, string> = { met: 'Met', partial: 'Partial', gap: 'Gap' }
export const STATUS_TONE: Record<Status, Tone> = { met: 'ok', partial: 'warn', gap: 'danger' }
const STATUS_VAR: Record<Status, string> = { met: 'var(--ok)', partial: 'var(--warn)', gap: 'var(--danger)' }
const ORDER: Status[] = ['gap', 'partial', 'met']

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

export function Coverage({ findings, frameworks }: { findings: Record<string, Finding>; frameworks: Framework[] }) {
  return (
    <ul className="grid gap-3 m-0 p-0 list-none">
      {FRAMEWORKS.filter((f) => frameworks.includes(f.id)).map((fw) => {
        const reqs = CHECKLIST.filter((r) => r.refs[fw.id])
        const counts: Record<Status, number> = { met: 0, partial: 0, gap: 0 }
        for (const r of reqs) { const f = findings[r.id]; if (f) counts[f.status]++ }
        const total = reqs.length
        return (
          <li key={fw.id} className="grid gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span><span className="mono text-ink">{fw.label}</span> <span className="text-00 text-ink-3">{fw.full}</span></span>
              <span className="mono text-ink-2 nums">{counts.met} met · {counts.partial} partial · {counts.gap} gap / {total}</span>
            </div>
            <div className="flex h-3 border border-rule bg-bg-2 overflow-hidden" role="img" aria-label={`${fw.label}: ${counts.met} met, ${counts.partial} partial, ${counts.gap} gaps out of ${total} requirements`}>
              {(['met', 'partial', 'gap'] as Status[]).map((s) => (
                counts[s] ? (
                  <span
                    key={s}
                    className="h-full origin-left motion-safe:animate-[print-in_var(--dur-slow)_var(--ease-out)_both] [&+&]:border-l [&+&]:border-surface"
                    style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS_VAR[s], backgroundImage: s === 'partial' ? 'repeating-linear-gradient(45deg, transparent 0 3px, var(--surface) 3px 4px)' : s === 'gap' ? 'repeating-linear-gradient(90deg, transparent 0 5px, var(--surface) 5px 6px)' : undefined }}
                  />
                ) : null
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function Matrix({ findings, frameworks, onJump }: { findings: Record<string, Finding>; frameworks: Framework[]; onJump: (id: string) => void }) {
  const cols = FRAMEWORKS.filter((f) => frameworks.includes(f.id))
  return (
    <>
    <p aria-hidden="true" className="mono text-00 text-ink-3 m-0 mb-1 sm:hidden">Swipe the table sideways for every framework →</p>
    <TableWrap label="Requirement by framework matrix">
      <Table className="min-w-[30rem]">
        <thead>
          <tr>
            <Th>Requirement</Th>
            {cols.map((c) => <Th key={c.id} className="text-center">{c.label}</Th>)}
          </tr>
        </thead>
        <tbody>
          {PILLARS.map((p) => {
            const rows = CHECKLIST.filter((r) => r.pillar === p && cols.some((c) => r.refs[c.id]))
            if (!rows.length) return null
            return [
              <tr key={p}><td colSpan={cols.length + 1} className="mono text-ink-3 pt-3 pb-1 px-3">{p}</td></tr>,
              ...rows.map((r) => {
                const f = findings[r.id]
                return (
                  <tr key={r.id}>
                    <Td className="min-w-[10rem]">
                      <button type="button" onClick={() => onJump(r.id)} className="text-left underline decoration-rule underline-offset-2 hover:decoration-accent min-h-[36px]">{r.title}</button>
                    </Td>
                    {cols.map((c) => (
                      <Td key={c.id} className="text-center">
                        {r.refs[c.id] && f ? <MatrixCell status={f.status} ref_={r.refs[c.id] as string} /> : <span className="text-ink-3" aria-label="not required">—</span>}
                      </Td>
                    ))}
                  </tr>
                )
              }),
            ]
          })}
        </tbody>
      </Table>
    </TableWrap>
    </>
  )
}

function MatrixCell({ status, ref_ }: { status: Status; ref_: string }) {
  const glyph = status === 'met' ? '●' : status === 'partial' ? '◐' : '○'
  return (
    <span className="mono inline-flex items-center gap-1 whitespace-nowrap" style={{ color: STATUS_VAR[status] }} title={ref_}>
      <span aria-hidden="true">{glyph}</span>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function FindingCard({ req, finding, frameworks }: { req: Requirement; finding: Finding; frameworks: Framework[] }) {
  return (
    <li id={`gap-${req.id}`} tabIndex={-1} className={cx('grid gap-2 p-4 bg-surface border rounded-1 scroll-mt-24 border-l-4', finding.status === 'met' ? 'border-rule border-l-ok' : finding.status === 'partial' ? 'border-rule border-l-warn' : 'border-rule border-l-danger')}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={finding.status} />
        <span className="mono text-ink-3">{req.pillar}</span>
        <Badge tone={finding.origin === 'ai' ? 'accent' : 'neutral'} className="ml-auto">{finding.origin === 'ai' ? 'AI' : 'keyword screen'}</Badge>
      </div>
      <h4 className="m-0 font-semibold text-1">{req.title}</h4>
      <p className="m-0 flex flex-wrap gap-1">
        {FRAMEWORKS.filter((f) => req.refs[f.id] && frameworks.includes(f.id)).map((f) => (
          <span key={f.id} className="mono text-00 px-2 py-[2px] bg-bg-2 border border-rule-soft rounded-0 text-ink-2">{f.label} · {req.refs[f.id]}</span>
        ))}
      </p>
      {finding.evidence ? (
        <figure className="m-0">
          <blockquote className="m-0 pl-3 border-l-2 border-rule text-0 text-ink-2 italic">“{finding.evidence}”</blockquote>
          <figcaption className="mono text-00 text-ink-3 mt-1">{finding.quoteFound ? 'Evidence found in your text' : 'Model paraphrase: not found verbatim in your text'}</figcaption>
        </figure>
      ) : (
        <p className="m-0 text-0 text-ink-3">No supporting passage found in the excerpt.</p>
      )}
      {finding.recommendation ? (
        <p className="m-0 text-0"><span className="mono text-accent-ink">Next step · </span>{finding.recommendation}</p>
      ) : null}
    </li>
  )
}

export function sortFindings(reqs: Requirement[], findings: Record<string, Finding>) {
  return [...reqs].sort((a, b) => ORDER.indexOf(findings[a.id]?.status ?? 'gap') - ORDER.indexOf(findings[b.id]?.status ?? 'gap'))
}
