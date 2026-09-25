'use client'
/**
 * "Reprint in {other}" control (DESIGN.md 3). STUB — owner: shell.
 * The shell builder adds the 7-band press transition + View Transitions path.
 */
import { SwatchGlyph } from '@/components/ui/Icon'
import type { ThemeKey } from '@/lib/content/schema'
import { otherTheme } from '@/lib/theme'
import { setTheme, useThemeKey } from '@/lib/theme/client'

export interface ThemeLabels { almanac: { label: string; swapLabel: string }; strata: { label: string; swapLabel: string } }

export function ThemeSwitch({ labels, compact = false }: { labels: ThemeLabels; compact?: boolean }) {
  const current = useThemeKey()
  const next: ThemeKey = otherTheme(current)
  const nextLabel = labels[next].label
  return (
    <button
      type="button"
      aria-label={`Switch to ${nextLabel} theme`}
      onClick={() => setTheme(next)}
      className="inline-flex items-center gap-2 min-h-tap px-3 border border-rule rounded-pill bg-surface mono text-ink almanac:shadow-press"
    >
      <SwatchGlyph from="var(--accent)" to="var(--accent-2)" />
      {compact ? null : <span>Reprint in {nextLabel}</span>}
    </button>
  )
}
