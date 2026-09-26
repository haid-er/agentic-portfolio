'use client'
/**
 * "Reprint in {other}" control (DESIGN.md 3). An action, not a toggle: no aria-pressed.
 * Almanac: square with a hard ink shadow that collapses on press. Strata: a pill.
 * Visible text is CSS-switched per world (no flash); aria-label follows the live key.
 */
import { useState } from 'react'
import { otherTheme } from '@/lib/theme'
import { useThemeKey } from '@/lib/theme/client'
import { cx } from '@/lib/utils'
import { InkSwatch } from './InkSwatch'
import { pullNewProof } from './press'
import type { ThemeLabels } from './types'
import { WorldText } from './WorldText'

export type { ThemeLabels } from './types'

export interface ThemeSwitchProps {
  labels: ThemeLabels
  /** 44px swatch-only button (mobile top bar). */
  compact?: boolean
  /** Stretch to the container (contents sheet). */
  block?: boolean
  className?: string
}

export function ThemeSwitch({ labels, compact = false, block = false, className }: ThemeSwitchProps) {
  const current = useThemeKey()
  const next = otherTheme(current)
  const [pressing, setPressing] = useState(false)

  const onClick = () => {
    setPressing(true)
    window.setTimeout(() => setPressing(false), 220)
    void pullNewProof(next, labels)
  }

  return (
    <button
      type="button"
      aria-label={`Switch to ${labels[next].label} theme`}
      data-pressing={pressing || undefined}
      onClick={onClick}
      className={cx(
        'group inline-flex items-center justify-center gap-2 min-h-tap border border-rule bg-surface text-ink select-none',
        'mono rounded-pill',
        'transition-[transform,box-shadow,background-color] duration-[var(--dur-fast)] ease-[var(--ease-press)]',
        'hover:bg-bg-2',
        'almanac:shadow-press almanac:active:translate-x-[2px] almanac:active:translate-y-[2px] almanac:active:shadow-none',
        'almanac:data-pressing:translate-x-[2px] almanac:data-pressing:translate-y-[2px] almanac:data-pressing:shadow-none',
        'strata:active:scale-[.98] strata:data-pressing:scale-[.98]',
        compact ? 'min-w-tap px-2' : 'px-3',
        block && 'w-full',
        className,
      )}
    >
      <InkSwatch size={compact ? 28 : 26} />
      {compact ? null : (
        <span className="whitespace-nowrap">
          <WorldText almanac={`Reprint in ${labels.strata.label}`} strata={`Reprint in ${labels.almanac.label}`} />
        </span>
      )}
    </button>
  )
}
