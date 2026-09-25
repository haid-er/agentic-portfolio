'use client'
/** The file listing after the current step: changed files marked, removed ones struck through. */
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'
import type { Entry, Stage } from './pipeline'

export function Files({ stage, selectedKey, onSelect }: {
  stage: Stage
  selectedKey: string | null
  onSelect: (e: Entry) => void
}) {
  const sorted = [...stage.entries].sort((a, b) => a.path.localeCompare(b.path))
  return (
    <div className="grid gap-2">
      <div
        role="region"
        aria-label="Files after this step"
        tabIndex={0}
        className="max-h-[300px] overflow-y-auto border border-rule-soft rounded-1 bg-bg"
      >
        <ul className="m-0 p-0 list-none">
          {sorted.map((e) => {
            const changed = stage.changed.has(e.key)
            const selected = e.key === selectedKey
            const selectable = e.kind !== 'junk'
            return (
              <li key={e.key} className="border-b border-rule-soft last:border-b-0">
                <button
                  type="button"
                  disabled={!selectable}
                  onClick={() => onSelect(e)}
                  aria-current={selected || undefined}
                  className={cx(
                    'w-full min-h-tap px-3 py-1.5 flex items-center gap-2 text-left font-mono text-00 [overflow-wrap:anywhere]',
                    selected ? 'bg-bg-2 text-ink' : 'text-ink-2 hover:bg-bg-2',
                    !selectable && 'cursor-default',
                  )}
                >
                  <Icon name={e.kind === 'junk' ? 'alert' : e.kind === 'recording' ? 'sine' : 'doc'} size={14} className={cx('shrink-0', e.kind === 'junk' ? 'text-warn' : 'text-ink-3')} />
                  <span className="flex-1 min-w-0">{e.path}</span>
                  {e.dataset === 'fall' ? <span className="shrink-0 px-1 border border-danger text-danger rounded-pill">fall</span> : null}
                  {changed ? <span className="shrink-0 text-accent-ink" title="changed by this step">changed</span> : null}
                </button>
              </li>
            )
          })}
          {stage.removed.map((e) => (
            <li key={`rm-${e.key}`} className="px-3 py-1.5 flex items-center gap-2 font-mono text-00 text-ink-3 border-b border-rule-soft last:border-b-0">
              <Icon name="minus" size={14} className="shrink-0 text-danger" />
              <span className="flex-1 min-w-0 line-through [overflow-wrap:anywhere]">{e.path}</span>
              <span className="shrink-0 text-danger">{e.kind === 'recording' ? 'split' : 'removed'}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="m-0 mono text-ink-3 nums">
        {stage.entries.length} files · {stage.changed.size} changed · {stage.removed.length} removed or split
      </p>
    </div>
  )
}
