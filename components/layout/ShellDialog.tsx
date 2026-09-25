'use client'
/**
 * Modal built on the native <dialog>: showModal() puts it in the top layer and
 * makes the rest of the page inert (the focus trap), Esc closes it, focus goes
 * back to the opener on close. A click on the scrim (the dialog box itself,
 * outside the panel) closes it too.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '@/lib/utils'

export interface ShellDialogProps {
  open: boolean
  onClose: () => void
  /** id of the element that names the dialog. */
  labelledBy: string
  className?: string
  panelClassName?: string
  /** Element to focus on open (defaults to the first focusable). */
  initialFocus?: () => HTMLElement | null
  children: ReactNode
}

export function ShellDialog({ open, onClose, labelledBy, className, panelClassName, initialFocus, children }: ShellDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      const target = initialFocus?.()
      if (target) target.focus()
    } else if (!open && d.open) {
      d.close()
    }
  }, [open, initialFocus])

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className={cx(
        'shell-dialog shell-print-hide m-0 max-h-none max-w-none border-0 bg-transparent p-0 text-ink',
        className,
      )}
    >
      <div className={panelClassName}>{children}</div>
    </dialog>
  )
}
