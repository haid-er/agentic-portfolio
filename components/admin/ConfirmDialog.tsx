'use client'
/**
 * Small modal built on <dialog>: the browser gives it the focus trap,
 * Esc-to-close and the inert background. Used for "leave without saving?",
 * "discard changes?" and similar decisions.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button, Icon, type ButtonVariant } from '@/components/ui'

export interface DialogAction {
  label: string
  onClick: () => void
  variant?: ButtonVariant
  autoFocus?: boolean
}

export function ConfirmDialog({ open, title, children, actions, onClose }: {
  open: boolean
  title: string
  children?: ReactNode
  actions: DialogAction[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="m-auto w-[min(32rem,calc(100vw-32px))] p-0 bg-surface text-ink border border-rule rounded-2 shadow-press backdrop:bg-[rgb(0_0_0/.45)]"
    >
      <div className="grid gap-s4 p-s5">
        <div className="flex items-start gap-3">
          <Icon name="register" size={22} className="mt-1 text-accent-2" />
          <h2 id={titleId} className="display m-0 text-3">{title}</h2>
        </div>
        {children ? <div className="text-1 text-ink-2 grid gap-2">{children}</div> : null}
        <div className="flex flex-wrap gap-2 justify-end">
          {actions.map((a) => (
            <Button key={a.label} variant={a.variant ?? 'secondary'} autoFocus={a.autoFocus} onClick={a.onClick}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </dialog>
  )
}
