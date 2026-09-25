/** Status badge (DESIGN.md 6.7): a text slug with a tone border. Text is always present. */
import type { ReactNode } from 'react'
import { cx } from '@/lib/utils'

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'border-rule text-ink-2',
  ok: 'border-ok text-ok',
  warn: 'border-warn text-warn',
  danger: 'border-danger text-danger',
  accent: 'border-accent text-accent-ink',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('mono inline-flex items-center gap-1 px-2 py-[3px] border rounded-pill bg-surface whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  )
}
