'use client'
import { useState } from 'react'
/**
 * Dashboard "press status": a three-step track (committed -> building -> live)
 * that follows the latest save until the new build answers. Owner: admin-core.
 */
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'
import type { Activity } from '../activity'
import { timeAgo } from '../format'
import { checkNow, useDeploy } from './deploy-store'
import { deployView } from './deploy-view'
import { useNow } from './useNow'

const STEPS = ['Committed', 'Building', 'Live'] as const

export function DeployPanel({ initial }: { initial: Activity }) {
  const snap = useDeploy(initial)
  const busy = Boolean(snap.savedAt) || snap.activity?.deploy.state === 'deploying'
  const now = useNow(true, busy ? 1000 : 30_000, Date.parse(initial.checkedAt))
  const v = deployView(snap, now)
  const d = snap.activity?.deploy
  const [checking, setChecking] = useState(false)

  const onCheck = async () => {
    setChecking(true)
    await checkNow()
    setChecking(false)
  }

  return (
    <div className="grid gap-s4">
      <div className="flex flex-wrap items-start justify-between gap-s3">
        <div className="grid gap-s2 min-w-0">
          <p className="m-0 mono text-ink-3">Press status</p>
          <p className="m-0 display text-3 [overflow-wrap:anywhere]" aria-live="polite">{v.title}</p>
        </div>
        <Button variant="secondary" size="sm" icon="refresh" onClick={onCheck} disabled={checking} aria-busy={checking}>
          {checking ? 'Checking' : 'Check now'}
        </Button>
      </div>

      {v.step !== null ? (
        <ol className="m-0 p-0 list-none grid grid-cols-3 gap-s2" aria-label="Deploy progress">
          {STEPS.map((label, i) => {
            const done = i < v.step! || (i === v.step && v.step === 2)
            const current = i === v.step && v.step !== 2
            return (
              <li
                key={label}
                aria-current={current ? 'step' : undefined}
                className={cx(
                  'relative grid gap-1 pt-s3 border-t-4 min-w-0',
                  done ? 'border-t-ok' : current ? (v.failed ? 'border-t-danger' : 'border-t-warn') : 'border-t-rule-soft',
                )}
              >
                <span className="mono text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex items-center gap-1 text-0 font-semibold">
                  {done ? <Icon name="check" size={16} className="text-ok" /> : null}
                  {current ? (
                    <Icon
                      name={v.failed ? 'alert' : 'register'}
                      size={16}
                      className={cx(v.failed ? 'text-danger' : 'text-warn', !v.failed && 'motion-safe:animate-[spin-reg_2.4s_linear_infinite]')}
                    />
                  ) : null}
                  {label}
                </span>
                <span className="sr-only">{done ? 'done' : current ? (v.failed ? 'stalled' : 'in progress') : 'waiting'}</span>
              </li>
            )
          })}
        </ol>
      ) : null}

      <p className="m-0 text-0 text-ink-2 measure">{v.detail}</p>

      {d?.headSha ? (
        <p className="m-0 flex flex-wrap items-center gap-x-s3 gap-y-1 text-0 text-ink-2 min-w-0">
          <span className="mono text-ink-3">Head of {d.branch}</span>
          {d.headUrl ? (
            <a href={d.headUrl} target="_blank" rel="noopener noreferrer" className="mono text-accent-ink underline underline-offset-4">
              {d.headSha.slice(0, 7)}
              <span className="sr-only"> (opens GitHub)</span>
            </a>
          ) : (
            <span className="mono">{d.headSha.slice(0, 7)}</span>
          )}
          <span className="[overflow-wrap:anywhere]">{d.headTitle}</span>
          {d.headDate ? <span className="mono text-ink-3">{timeAgo(d.headDate, now)}</span> : null}
        </p>
      ) : null}
      {d?.deployedSha && d.deployedSha !== d.headSha ? (
        <p className="m-0 text-0 text-ink-3">
          <span className="mono">Serving</span> <span className="mono">{d.deployedSha.slice(0, 7)}</span>
        </p>
      ) : null}
    </div>
  )
}
