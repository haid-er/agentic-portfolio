'use client'
/**
 * Password form. Posts JSON to /api/admin/login; without JavaScript the same
 * <form> posts natively and the route answers with a redirect. Owner: admin-core.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { controlClasses } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { clock } from '@/lib/admin/format'
import { useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { RegisterMark, type RegisterState } from './RegisterMark'

const MESSAGES: Record<string, string> = {
  invalid_password: 'That password is not right.',
  rate_limited: 'Too many attempts. Wait for the pause to end.',
  unconfigured: 'Sign-in is not configured on this deployment.',
  bad_request: 'Enter the admin password.',
}

interface Props {
  next: string
  initialError?: string
  signedOut?: boolean
  disabled?: boolean
}

export function LoginForm({ next, initialError, signedOut, disabled }: Props) {
  const reduced = useReducedMotion()
  const pwId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [caps, setCaps] = useState(false)
  const [mark, setMark] = useState<RegisterState>(initialError ? 'error' : 'idle')
  const [error, setError] = useState(initialError ? (MESSAGES[initialError] ?? MESSAGES.invalid_password!) : '')
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(0)
  const [notice, setNotice] = useState(signedOut ? 'Signed out.' : '')

  useEffect(() => {
    if (!lockedUntil) return
    setNow(Date.now())
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= lockedUntil) {
        setLockedUntil(0)
        setError('')
        setMark('idle')
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [lockedUntil])

  const locked = lockedUntil > now && lockedUntil > 0
  const errId = `${pwId}-err`
  const hintId = `${pwId}-hint`

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const password = inputRef.current?.value ?? ''
    if (!password) {
      setError(MESSAGES.bad_request!)
      setMark('error')
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    setMark('idle')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password, next }),
        credentials: 'same-origin',
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; message?: string; code?: string; retryAfterSec?: number }
      if (res.ok && body.ok) {
        setMark('ok')
        setNotice('In register. Opening the press room…')
        window.setTimeout(() => window.location.assign(body.next ?? next), reduced ? 0 : 520)
        return
      }
      setMark('error')
      setError(body.message ?? MESSAGES[body.code ?? ''] ?? `Sign-in failed (${res.status}).`)
      if (body.retryAfterSec) setLockedUntil(Date.now() + body.retryAfterSec * 1000)
      if (inputRef.current) {
        inputRef.current.value = ''
        inputRef.current.focus()
      }
    } catch {
      setMark('error')
      setError('Network error: the server did not answer.')
    }
    setBusy(false)
  }

  return (
    <form method="post" action="/api/admin/login" onSubmit={onSubmit} className="grid gap-s5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="flex items-center gap-s4">
        <RegisterMark state={mark} />
        <p className="m-0 text-0 text-ink-2 measure">
          Sign in to edit every collection. Saves commit to the repository and the site reprints itself.
        </p>
      </div>

      <div className="flex flex-col gap-1 min-w-0">
        <label htmlFor={pwId} className="mono text-ink-2">Password</label>
        <div className="relative">
          <input
            ref={inputRef}
            id={pwId}
            name="password"
            type={show ? 'text' : 'password'}
            required
            autoComplete="current-password"
            autoFocus
            spellCheck={false}
            autoCapitalize="none"
            maxLength={256}
            disabled={disabled || locked}
            onKeyDown={onKey}
            onKeyUp={onKey}
            aria-invalid={error ? true : undefined}
            aria-describedby={[caps ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined}
            className={cx(controlClasses, 'pr-20 font-mono tracking-[.08em]')}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-pressed={show}
            aria-controls={pwId}
            aria-label="Show password"
            className="absolute right-0 top-0 h-full min-w-tap px-3 grid place-items-center mono text-ink-2 hover:text-ink"
          >
            <span aria-hidden="true">{show ? 'Hide' : 'Show'}</span>
          </button>
        </div>
        {caps ? (
          <p id={hintId} className="m-0 flex items-center gap-1 text-00 text-warn">
            <Icon name="info" size={14} />
            <span>Caps Lock is on.</span>
          </p>
        ) : null}
        <div aria-live="assertive" className="empty:hidden">
          {error ? (
            <p id={errId} className="m-0 flex items-center gap-1 text-0 text-danger">
              <Icon name="alert" size={16} />
              <span>
                {error}
                {locked ? <> Try again in <span className="nums">{clock((lockedUntil - now) / 1000)}</span>.</> : null}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-s4">
        <Button type="submit" arrow disabled={busy || disabled || locked} aria-busy={busy} icon="lock">
          {busy ? 'Checking…' : 'Sign in'}
        </Button>
        <p role="status" className="m-0 mono text-ink-3 empty:hidden">{notice}</p>
      </div>
    </form>
  )
}
