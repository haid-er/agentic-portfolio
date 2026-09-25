/**
 * Login signature: two printing plates' register marks. Out of register while
 * waiting, knocked further out by a wrong password, snapped into register on
 * sign-in. Transform-only; reduced motion shows the end state at once.
 * Decorative (the form's live region carries the words). Owner: admin-core.
 */
import { cx } from '@/lib/utils'

export type RegisterState = 'idle' | 'error' | 'ok'

const OFFSET: Record<RegisterState, string> = {
  idle: 'translate-x-[4px] -translate-y-[3px]',
  error: 'translate-x-[9px] translate-y-[5px] rotate-[4deg]',
  ok: 'translate-x-0 translate-y-0',
}

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cx('absolute inset-0 size-full', className)} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="24" cy="24" r="12" />
      <circle cx="24" cy="24" r="4" />
      <path d="M24 3v42M3 24h42" />
    </svg>
  )
}

export function RegisterMark({ state, className }: { state: RegisterState; className?: string }) {
  return (
    <div aria-hidden="true" className={cx('relative size-16 shrink-0', className)}>
      <Mark
        className={cx(
          'text-accent-2 [mix-blend-mode:var(--blend)] transition-transform duration-[var(--dur-med)] ease-[var(--ease-press)] motion-reduce:transition-none',
          OFFSET[state],
        )}
      />
      <Mark className={cx('text-ink transition-opacity duration-[var(--dur-med)]', state === 'ok' ? 'opacity-100' : 'opacity-90')} />
    </div>
  )
}
