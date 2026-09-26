'use client'
/**
 * Header pill: the save -> commit -> build -> live state, on every admin page.
 * Owner: admin-core. Text always carries the state; colour only reinforces it.
 */
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'
import { useDeploy } from './deploy-store'
import { deployView } from './deploy-view'
import { useNow } from './useNow'

const TONE = {
  neutral: 'border-rule text-ink-2',
  ok: 'border-ok text-ok',
  warn: 'border-warn text-warn',
  danger: 'border-danger text-danger',
  accent: 'border-accent text-accent-ink',
} as const

export function DeployPill({ className }: { className?: string }) {
  const snap = useDeploy()
  const busy = Boolean(snap.savedAt) || snap.activity?.deploy.state === 'deploying'
  const now = useNow(busy || snap.wentLiveAt !== null)
  const v = deployView(snap, now)
  return (
    <Link
      href="/admin#press-status"
      className={cx(
        'mono inline-flex items-center gap-2 min-h-tap px-3 border rounded-pill bg-surface whitespace-nowrap no-underline nums',
        TONE[v.tone],
        className,
      )}
    >
      <Icon name={v.icon} size={16} className={cx(v.busy && 'motion-safe:animate-[spin-reg_2.4s_linear_infinite]')} />
      {/* The live region only holds the state label, which changes on transitions;
          the ticking clock in `short` stays out of it so it is not re-announced every second. */}
      <span className="sr-only" aria-live="polite">Press status: {v.title}</span>
      <span aria-hidden="true">{v.short}</span>
    </Link>
  )
}
