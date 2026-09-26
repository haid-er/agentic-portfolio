'use client'
/**
 * Contact slip (homepage Contact section). Lives under app/resume/_client
 * because resume-contact owns only these paths; `_client` is a private folder,
 * so it is not a route.
 *
 * Two honest modes:
 * - `endpoint` set (Web3Forms / Formspree, from admin): POSTs JSON to it.
 *   Web3Forms keys ride on the URL (`?access_key=...`) and move into the body;
 *   a Web3Forms URL without a key is treated as unset (see formEndpoint.ts).
 * - no usable endpoint: builds a mailto: link, so the visitor's own mail app sends it.
 *   With no `to` address either, nothing is rendered (the section decides this too).
 * If a POST fails, the same words are offered as a prefilled email instead.
 * Unsent drafts stay in this browser only (localStorage, `ghp:` namespace).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, ErrorState, Icon, Input, Textarea, buttonClasses } from '@/components/ui'
import { useLocalStorage } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { WEB3FORMS_HOST, endpointHost } from './formEndpoint'

const MAX_MESSAGE = 4000
const MIN_MESSAGE = 10
const MAX_NAME = 120
const TIMEOUT_MS = 15000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface Draft { name: string; email: string; message: string }
type Errors = Partial<Record<keyof Draft, string>>
type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; at: string }
  | { kind: 'handed-off'; href: string }
  | { kind: 'error'; detail: string }

const EMPTY: Draft = { name: '', email: '', message: '' }

function validate(d: Draft): Errors {
  const e: Errors = {}
  if (!d.name.trim()) e.name = 'Add your name so the reply can greet you.'
  else if (d.name.length > MAX_NAME) e.name = `Keep it under ${MAX_NAME} characters.`
  if (!EMAIL_RE.test(d.email.trim())) e.email = 'That address does not look deliverable yet.'
  const len = d.message.trim().length
  if (len < MIN_MESSAGE) e.message = `A few more words, please (at least ${MIN_MESSAGE} characters).`
  else if (d.message.length > MAX_MESSAGE) e.message = `Trim it to ${MAX_MESSAGE} characters.`
  return e
}

function mailtoHref(to: string, d: Draft) {
  const subject = `Portfolio: message from ${d.name.trim() || 'a visitor'}`
  const body = `${d.message.trim()}\n\n${d.name.trim()}${d.email.trim() ? ` <${d.email.trim()}>` : ''}`
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** Normalises the admin endpoint into a POST target + provider-specific extras. */
function target(endpoint: string): { url: string; extra: Record<string, string>; honeypot: string; host: string } {
  const u = new URL(endpoint)
  const host = u.hostname.replace(/^www\./, '')
  if (host === WEB3FORMS_HOST) {
    const key = u.searchParams.get('access_key') ?? ''
    u.searchParams.delete('access_key')
    return { url: u.toString(), extra: key ? { access_key: key } : {}, honeypot: 'botcheck', host }
  }
  if (host.endsWith('formspree.io')) return { url: u.toString(), extra: {}, honeypot: '_gotcha', host }
  return { url: u.toString(), extra: {}, honeypot: '_honey', host }
}

export function ContactForm({ endpoint, to, recipient }: { endpoint?: string; to: string; recipient: string }) {
  const [stored, setDraft] = useLocalStorage<Draft>('contact-draft', EMPTY)
  // Stored drafts come from an older visit: coerce to the current shape.
  const draft: Draft = {
    name: typeof stored?.name === 'string' ? stored.name : '',
    email: typeof stored?.email === 'string' ? stored.email : '',
    message: typeof stored?.message === 'string' ? stored.message : '',
  }
  const [errors, setErrors] = useState<Errors>({})
  const [tried, setTried] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [honey, setHoney] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const [focusTick, setFocusTick] = useState(0)

  const host = endpointHost(endpoint)
  const mode: 'post' | 'mailto' = host ? 'post' : 'mailto'

  // After a failed submit, move focus to the first invalid field.
  useEffect(() => {
    if (!focusTick) return
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [focusTick])

  // On a final state, move focus to the status panel so it is read out.
  useEffect(() => {
    if (status.kind === 'sent' || status.kind === 'handed-off' || status.kind === 'error') statusRef.current?.focus()
  }, [status.kind])

  const update = (k: keyof Draft) => (v: string) => {
    const next = { ...draft, [k]: v }
    setDraft(next)
    if (tried) setErrors(validate(next))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    const errs = validate(draft)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setFocusTick((n) => n + 1)
      return
    }

    if (mode === 'mailto') {
      const href = mailtoHref(to, draft)
      window.location.href = href
      setStatus({ kind: 'handed-off', href })
      return
    }

    if (honey) { // a bot filled the hidden field: pretend success, send nothing
      setStatus({ kind: 'sent', at: new Date().toISOString() })
      return
    }

    setStatus({ kind: 'sending' })
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const t = target(endpoint as string)
      const res = await fetch(t.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...t.extra,
          name: draft.name.trim(),
          email: draft.email.trim(),
          message: draft.message.trim(),
          subject: `Portfolio: message from ${draft.name.trim()}`,
          from_name: 'Portfolio contact form',
          [t.honeypot]: '',
        }),
        signal: ctrl.signal,
      })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; ok?: boolean; message?: string }
      if (!res.ok || data.success === false) {
        throw new Error(data.message ? `${res.status}: ${data.message}` : `The service answered ${res.status}.`)
      }
      setDraft(EMPTY)
      setTried(false)
      setStatus({ kind: 'sent', at: new Date().toISOString() })
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      setStatus({
        kind: 'error',
        detail: aborted ? `No answer from ${host} after ${TIMEOUT_MS / 1000}s.` : err instanceof Error ? err.message : 'Network error.',
      })
    } finally {
      window.clearTimeout(timer)
    }
  }

  if (status.kind === 'sent') {
    const time = new Date(status.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="relative grid gap-s4 outline-none">
        <Stamp label="Received" sub={time} />
        <p className="display m-0 pr-28 pt-s2 text-3">Message delivered.</p>
        <p className="m-0 text-ink-2 measure">
          It went through {host}. A reply comes to the address you gave. Nothing is stored on this site.
        </p>
        <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setStatus({ kind: 'idle' })}>
          Write another
        </Button>
      </div>
    )
  }

  if (status.kind === 'handed-off') {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="relative grid gap-s4 outline-none">
        <Stamp label="Handed on" sub="mail app" />
        <p className="display m-0 pr-28 pt-s2 text-3">Over to your mail app.</p>
        <p className="m-0 text-ink-2 measure">
          It should have opened with the message filled in, addressed to {recipient}. Nothing was sent from this site. If no window appeared, use the link below.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href={status.href} className={buttonClasses({ variant: 'primary' })}>
            <Icon name="mail" size={16} />
            Open the email again
          </a>
          <Button variant="secondary" onClick={() => setStatus({ kind: 'idle' })}>Edit message</Button>
        </div>
      </div>
    )
  }

  // Mailto mode with no address would open a blank email: show nothing instead.
  if (mode === 'mailto' && !to) return null

  const busy = status.kind === 'sending'
  const len = draft.message.length

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="relative grid gap-s4" aria-describedby="contact-mode-note" aria-busy={busy}>
      <p className="m-0 flex flex-wrap items-baseline gap-x-s2 border-b border-rule pb-s2">
        <span className="mono text-ink-3">To</span>
        <span className="font-semibold">{recipient}</span>
      </p>

      <div className="grid gap-s4 md:grid-cols-2">
        <Input
          label="Your name"
          name="name"
          autoComplete="name"
          maxLength={MAX_NAME}
          required
          value={draft.name}
          onChange={(e) => update('name')(e.target.value)}
          error={errors.name}
        />
        <Input
          label="Your email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={draft.email}
          onChange={(e) => update('email')(e.target.value)}
          error={errors.email}
        />
      </div>

      <Textarea
        label="Message"
        name="message"
        rows={6}
        required
        maxLength={MAX_MESSAGE}
        placeholder="What are you building, and where could I help?"
        value={draft.message}
        onChange={(e) => update('message')(e.target.value)}
        hint={`${len} / ${MAX_MESSAGE}${len ? ' · draft kept in this browser' : ''}`}
        error={errors.message}
      />

      {/* Honeypot: hidden from people and assistive tech, bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Leave this empty
          <input tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>

      {status.kind === 'error' ? (
        <div ref={statusRef} tabIndex={-1} className="outline-none">
          <ErrorState
            title="Not sent"
            action={to ? (
              <a href={mailtoHref(to, draft)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                <Icon name="mail" size={16} />
                Send it by email instead
              </a>
            ) : undefined}
          >
            {status.detail} Your message is still here.
          </ErrorState>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-s4 gap-y-s2">
        <Button type="submit" icon={mode === 'post' ? 'arrow-up-right' : 'mail'} disabled={busy} aria-disabled={busy || undefined}>
          {busy ? 'Sending…' : mode === 'post' ? 'Send message' : 'Open in mail app'}
        </Button>
        <p id="contact-mode-note" className={cx('m-0 text-00 text-ink-3 max-w-[40ch]')}>
          {mode === 'post'
            ? `Delivered by ${host}. This site stores nothing.`
            : 'Opens your own mail app with this message filled in. Nothing leaves this page until you press send there.'}
        </p>
      </div>
      <p className="sr-only" aria-live="polite">{busy ? 'Sending your message.' : ''}</p>
    </form>
  )
}

/** The rubber stamp that lands on a finished slip (decorative, text is repeated in the panel). */
function Stamp({ label, sub }: { label: string; sub: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'pointer-events-none absolute right-0 -top-2 grid size-24 place-items-center rounded-full rotate-[-8deg]',
        'border-2 border-accent-2 text-accent-ink strata:border-dashed strata:text-accent-2',
        'motion-safe:animate-[settle_420ms_cubic-bezier(.2,.7,.2,1)]',
      )}
    >
      <span className="grid place-items-center gap-[2px] text-center">
        <span className="mono font-medium">{label}</span>
        <span className="mono text-ink-3 normal-case">{sub}</span>
      </span>
    </span>
  )
}
