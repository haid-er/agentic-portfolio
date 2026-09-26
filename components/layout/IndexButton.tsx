'use client'
/** Buttons that open the index (command palette) through the shell event bus. */
import { Icon } from '@/components/ui/Icon'
import { buttonClasses } from '@/components/ui/Button'
import { useSyncExternalStore, type ReactNode } from 'react'
import { cx } from '@/lib/utils'
import { openIndex } from './events'

const noop = () => () => {}
/** "⌘ K" on Apple platforms, "Ctrl K" elsewhere (and on the server). */
function useShortcutLabel() {
  const apple = useSyncExternalStore(noop, () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent), () => false)
  return apple ? '⌘ K' : 'Ctrl K'
}

/** Header button (desktop): "Index" + the shortcut. */
export function IndexButton({ label }: { label: string }) {
  const shortcut = useShortcutLabel()
  return (
    <button
      type="button"
      onClick={openIndex}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      className="hidden min-h-tap items-center gap-2 rounded-pill border border-rule px-3 mono text-ink-2 hover:bg-bg-2 hover:text-ink lg:inline-flex"
    >
      <Icon name="search" size={16} />
      <span>{label}</span>
      <kbd aria-hidden="true" className="hidden xl:inline rounded-0 border border-rule-soft px-1.5 font-mono text-00 text-ink-3">{shortcut}</kbd>
    </button>
  )
}

/** A regular secondary button that opens the index (404 page). */
export function OpenIndexButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={openIndex}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      className={cx(buttonClasses({ variant: 'ghost' }), className)}
    >
      <Icon name="search" size={16} />
      {children}
    </button>
  )
}
