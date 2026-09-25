'use client'
/**
 * Printed accuracy bar (DESIGN.md 6.5): 6px --rule-soft track, --data-n fill,
 * value in display type. Fills once on first view; static under reduced motion.
 */
import { useInView } from '@/lib/hooks/useInView'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { cx } from '@/lib/utils'

export interface MeterProps {
  label: string
  value: number
  max?: number
  unit?: string
  /** 1-4 -> --data-n */
  ink?: 1 | 2 | 3 | 4
  note?: string
  className?: string
}

export function Meter({ label, value, max = 100, unit = '%', ink = 1, note, className }: MeterProps) {
  const [ref, seen] = useInView<HTMLDivElement>({ once: true, threshold: 0.3 })
  const reduced = useReducedMotion()
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const shown = reduced || seen
  return (
    <div ref={ref} className={cx('grid gap-1', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono text-ink-2">{label}</span>
        <span className="display text-3 nums">{value}{unit}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value}${unit}`}
        className="h-1.5 bg-rule-soft overflow-hidden rounded-pill"
      >
        <div
          className="h-full origin-left rounded-pill transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)]"
          style={{ background: `var(--data-${ink})`, transform: `scaleX(${shown ? pct / 100 : 0})` }}
        />
      </div>
      {note ? <span className="text-00 text-ink-3">{note}</span> : null}
    </div>
  )
}
