/**
 * The one metric style (DESIGN.md 6.4): "27s" struck in vermilion → "3.5s" in accent.
 * Only render values that exist in content/.
 */
import { cx } from '@/lib/utils'

export function Metric({ from, to, label, className }: { from: string; to: string; label?: string; className?: string }) {
  return (
    <p className={cx('m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1', className)}>
      <span className="display text-4 nums">
        <s className="text-ink-2 decoration-accent-2 [text-decoration-thickness:.08em]">{from}</s>
        <span aria-hidden="true" className="mx-2 text-ink-3">→</span>
        <span className="sr-only"> to </span>
        <b className="text-accent font-[inherit]">{to}</b>
      </span>
      {label ? <span className="mono text-ink-3">{label}</span> : null}
    </p>
  )
}
