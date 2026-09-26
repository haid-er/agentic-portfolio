'use client'
/** The answer card: pipeline trace (retrieve -> cite -> answer), cited text, citation check. */
import { Badge, Button, Loading } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { BROWSER_MODEL_DOWNLOAD, type AiMeta } from '@/lib/ai'
import { cx } from '@/lib/utils'
import { checkCitations, segments } from './answer'
import type { Expanded, Hit } from './retrieve'

export type Via = 'model' | 'extractive' | 'device'
export type RunStatus = 'retrieving' | 'thinking' | 'streaming' | 'done'

export interface Run {
  id: number
  q: string
  expanded: Expanded
  hits: Hit[]
  sent: Hit[]
  retrievalMs: number
  semantic: boolean
  status: RunStatus
  answer: string
  via: Via
  meta?: AiMeta | null
  note?: string
  canDevice?: boolean
  deviceProgress?: number | null
}

const VIA_LABEL: Record<Via, string> = { model: 'Model answer', extractive: 'Extractive answer (quoted, offline)', device: 'On-device model' }

export function AnswerView({ run, onCite, onDevice }: { run: Run; onCite: (n: number) => void; onDevice: () => void }) {
  const done = run.status === 'done'
  const check = done && run.answer ? checkCitations(run.answer, run.sent.length) : null
  return (
    <article className="grid gap-4" aria-busy={!done}>
      <Pipeline run={run} />

      <div className="grid gap-2">
        <p className="m-0 flex flex-wrap items-center gap-2 mono text-ink-3">
          <span>{VIA_LABEL[run.via]}</span>
          {run.meta ? <span className="nums">· {run.meta.provider} · {run.meta.model} · {Math.round(run.meta.latencyMs)} ms</span> : null}
        </p>

        {run.deviceProgress != null ? (
          <Loading label={`Loading the on-device model · ${Math.round(run.deviceProgress * 100)}%`} />
        ) : !run.answer && !done ? (
          <Loading label={run.status === 'retrieving' ? 'Retrieving' : 'Reading the sources'} />
        ) : run.answer ? (
          <div className="text-1 leading-[1.6] whitespace-pre-line [overflow-wrap:anywhere]">
            {segments(run.answer).map((s, i) =>
              s.kind === 'text' ? (
                <span key={i}>{s.text}</span>
              ) : s.n >= 1 && s.n <= run.sent.length ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => onCite(s.n)}
                  aria-label={`Source ${s.n}`}
                  className="mx-[1px] inline-flex items-center justify-center min-w-[1.6em] px-1 align-[.1em] font-mono text-00 text-accent-ink border border-accent-ink rounded-0 hover:bg-bg-2"
                >
                  {s.n}
                </button>
              ) : (
                <span key={i} className="font-mono text-00 text-danger" title="Cites a source that was not sent">[{s.n}?]</span>
              ),
            )}
            {run.status === 'streaming' ? <span className="inline-block w-[.5em] h-[1em] align-[-.15em] bg-accent motion-safe:animate-pulse" aria-hidden="true" /> : null}
          </div>
        ) : null}
      </div>

      {check ? <CitationCheck check={check} total={run.sent.length} /> : null}

      {run.note ? <p className="m-0 flex items-start gap-2 text-0 text-ink-2"><Icon name="info" size={16} className="mt-[3px] shrink-0" />{run.note}</p> : null}
      {run.canDevice && done ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon="download" onClick={onDevice}>Run a small model on this device ({BROWSER_MODEL_DOWNLOAD})</Button>
        </div>
      ) : null}
    </article>
  )
}

function Pipeline({ run }: { run: Run }) {
  const steps = [
    {
      label: 'Expand',
      done: true,
      detail: run.expanded.added.length ? run.expanded.added.map((a) => `${a.from} → ${a.to.join(', ')}`).join(' · ') : 'no synonyms needed',
    },
    {
      label: 'Retrieve',
      done: run.status !== 'retrieving',
      detail: run.status === 'retrieving' ? '…' : `${run.hits.length} matched · ${run.semantic ? 'BM25 + MiniLM, RRF' : 'BM25'} · ${run.retrievalMs.toFixed(1)} ms`,
    },
    {
      label: 'Cite',
      done: run.status !== 'retrieving',
      detail: run.status === 'retrieving' ? '…' : `${run.sent.length} numbered sources sent`,
    },
    {
      label: 'Answer',
      done: run.status === 'done',
      detail: run.status === 'done' ? (run.via === 'extractive' ? 'quoted, no model' : 'grounded in the sources') : run.status === 'streaming' ? 'streaming' : 'waiting',
    },
  ]
  return (
    <ol className="grid gap-2 m-0 p-0 list-none xs:grid-cols-2 lg:grid-cols-4" aria-label="Pipeline">
      {steps.map((s, i) => (
        <li key={s.label} className={cx('grid gap-1 p-2 border-t-2 min-w-0', s.done ? 'border-accent' : 'border-rule-soft')}>
          <span className="flex items-center gap-1 mono text-ink">
            <span className="text-ink-3 nums">{String(i + 1).padStart(2, '0')}</span>
            {s.label}
            {s.done ? <Icon name="check" size={14} className="text-ok" title="done" /> : null}
          </span>
          <span className="text-00 text-ink-2 [overflow-wrap:anywhere]">{s.detail}</span>
        </li>
      ))}
    </ol>
  )
}

function CitationCheck({ check, total }: { check: ReturnType<typeof checkCitations>; total: number }) {
  if (check.refused) {
    return <p className="m-0 flex flex-wrap items-center gap-2 text-0"><Badge tone="warn">Declined</Badge> The model found no answer in the sources, so it did not guess.</p>
  }
  const all = check.sentences > 0 && check.cited === check.sentences
  return (
    <div className="flex flex-wrap items-center gap-2 text-0" aria-live="polite">
      <Badge tone={all && !check.invalid.length ? 'ok' : 'warn'}>
        Citation check
      </Badge>
      <span className="nums">{check.cited}/{check.sentences} sentences cited</span>
      <span className="text-ink-3">·</span>
      <span className="nums">{check.used.length}/{total} sources used</span>
      {check.invalid.length ? (
        <><span className="text-ink-3">·</span><span className="text-danger">cites missing source {check.invalid.map((n) => `[${n}]`).join(' ')}</span></>
      ) : null}
    </div>
  )
}
