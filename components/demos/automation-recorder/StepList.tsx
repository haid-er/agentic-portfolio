'use client'
/** The recorded steps as an editable ledger: reorder, delete, insert waits; shows replay status per step. */
import { Badge, Button, EmptyState, Icon, type Tone } from '@/components/ui'
import { cx } from '@/lib/utils'
import { selectorOf, type Step, type Strategy } from './recorder'

export type StepStatus = 'pending' | 'running' | 'waiting' | 'ok' | 'failed'

const STATUS: Record<StepStatus, { label: string; tone: Tone }> = {
  pending: { label: 'queued', tone: 'neutral' },
  running: { label: 'running', tone: 'accent' },
  waiting: { label: 'waiting', tone: 'warn' },
  ok: { label: 'ok', tone: 'ok' },
  failed: { label: 'failed', tone: 'danger' },
}

const VERB: Record<Step['kind'], string> = { click: 'Click', type: 'Type', select: 'Select', wait: 'Wait' }

export function StepList({ steps, strategy, status, locked, recording, onMove, onDelete, onAddWait }: {
  steps: Step[]
  strategy: Strategy
  status: Record<string, StepStatus>
  locked: boolean
  recording: boolean
  onMove: (index: number, dir: -1 | 1) => void
  onDelete: (index: number) => void
  onAddWait: () => void
}) {
  if (steps.length === 0) {
    return (
      <EmptyState title={recording ? 'Recording. Use the form.' : 'No steps yet'}>
        {recording
          ? 'Type in a field, pick a category or press a button in the sandbox. Each action lands here as a step.'
          : 'Press Record and fill in the sandbox form, or load the sample recording.'}
      </EmptyState>
    )
  }
  return (
    <div className="grid gap-2">
      <ol className="m-0 p-0 list-none grid gap-2" aria-label="Recorded steps">
        {steps.map((s, i) => {
          const st = status[s.id]
          return (
            <li
              key={s.id}
              aria-current={st === 'running' || st === 'waiting' ? 'step' : undefined}
              className={cx(
                'grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-1 p-2 border rounded-1 bg-bg',
                st === 'failed' ? 'border-danger' : st === 'running' || st === 'waiting' ? 'border-accent' : 'border-rule-soft',
              )}
            >
              <span className="mono text-ink-3 nums pt-[2px]">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-accent-ink">{VERB[s.kind]}</span>
                  <span className="font-semibold text-0 [overflow-wrap:anywhere]">{s.kind === 'wait' ? `${s.ms ?? 500} ms` : s.label}</span>
                  {st ? <Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge> : null}
                </div>
                {s.value && s.kind !== 'wait' ? (
                  <p className="m-0 text-0 text-ink-2 [overflow-wrap:anywhere]">&ldquo;{s.value}&rdquo;</p>
                ) : null}
                {s.kind !== 'wait' ? (
                  <code className="font-mono text-00 text-ink-3 [overflow-wrap:anywhere]">{selectorOf(s, strategy)}</code>
                ) : null}
                <div className="flex gap-1 -ml-1">
                  <IconBtn label={`Move step ${i + 1} up`} icon="arrow-up-right" rotate="-rotate-45" disabled={locked || i === 0} onClick={() => onMove(i, -1)} />
                  <IconBtn label={`Move step ${i + 1} down`} icon="arrow-up-right" rotate="rotate-[135deg]" disabled={locked || i === steps.length - 1} onClick={() => onMove(i, 1)} />
                  <IconBtn label={`Delete step ${i + 1}`} icon="close" disabled={locked} onClick={() => onDelete(i)} />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <Button variant="ghost" size="sm" icon="plus" onClick={onAddWait} disabled={locked} className="justify-self-start">
        Add a wait step
      </Button>
    </div>
  )
}

function IconBtn({ label, icon, rotate, disabled, onClick }: {
  label: string
  icon: 'arrow-up-right' | 'close'
  rotate?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center size-tap text-ink-2 rounded-1 hover:bg-bg-2 hover:text-ink disabled:opacity-35 disabled:cursor-not-allowed"
    >
      <Icon name={icon} size={16} className={rotate} />
    </button>
  )
}
