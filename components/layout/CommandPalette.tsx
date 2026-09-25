'use client'
/**
 * The index (DESIGN.md 6.6): a Ctrl/Cmd+K command palette styled as the index
 * page of a printed almanac: grouped entries, dot leaders, folio numbers and
 * demo slugs on the right. Keyboard: type to filter, Up/Down/Home/End to move,
 * Enter to open, Esc to close. ARIA combobox + listbox with aria-activedescendant.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useReducedMotion } from '@/lib/hooks'
import { otherTheme } from '@/lib/theme'
import { useThemeKey } from '@/lib/theme/client'
import { cx } from '@/lib/utils'
import { OPEN_INDEX, canJump, jumpToSection, onShellEvent } from './events'
import { pullNewProof } from './press'
import { ShellDialog } from './ShellDialog'
import type { IndexEntry, IndexGroup, ThemeLabels } from './types'

const GROUP_ORDER: IndexGroup[] = ['section', 'demo', 'project', 'page', 'action']

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

/** Small, readable ranking: prefix > word prefix > substring > keyword > subsequence. */
export function scoreEntry(e: IndexEntry, q: string): number {
  if (!q) return 1
  const label = norm(e.label)
  const hint = norm(e.hint)
  if (label.startsWith(q)) return 100
  if (label.split(/[\s\-–·/]+/).some((w) => w.startsWith(q))) return 80
  if (label.includes(q)) return 60
  if (hint.includes(q)) return 50
  if (q.split(/\s+/).every((w) => norm(`${e.label} ${e.hint} ${e.keywords}`).includes(w))) return 30
  let i = 0
  for (const ch of label) if (ch === q[i]) i++
  return i === q.length ? 10 : 0
}

export function CommandPalette({ entries, groupLabels, labels, title }: {
  entries: IndexEntry[]
  groupLabels: Record<IndexGroup, string>
  labels: ThemeLabels
  title: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const router = useRouter()
  const toast = useToast()
  const reduced = useReducedMotion()
  const next = otherTheme(useThemeKey())

  const show = useCallback(() => { setQuery(''); setCursor(0); setOpen(true) }, [])
  const close = useCallback(() => setOpen(false), [])
  const focusInput = useCallback(() => inputRef.current, [])

  // Ctrl/Cmd+K anywhere toggles the index; the header buttons use the event bus.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => { if (!o) { setQuery(''); setCursor(0) } return !o })
      }
    }
    window.addEventListener('keydown', onKey)
    const off = onShellEvent(OPEN_INDEX, show)
    return () => { window.removeEventListener('keydown', onKey); off() }
  }, [show])

  const withLabels = useMemo(
    () => entries.map((e) => (e.action === 'theme' ? { ...e, label: `Reprint in ${labels[next].label}`, hint: labels[next].label } : e)),
    [entries, labels, next],
  )

  const groups = useMemo(() => {
    const q = norm(query.trim())
    return GROUP_ORDER.map((g) => ({
      group: g,
      rows: withLabels
        .map((e, i) => ({ e, i, s: scoreEntry(e, q) }))
        .filter((r) => r.e.group === g && r.s > 0)
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .map((r) => r.e),
    })).filter((g) => g.rows.length)
  }, [withLabels, query])

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups])
  const safeCursor = Math.min(cursor, Math.max(0, flat.length - 1))
  const activeEntry = flat[safeCursor]
  const optionId = (e: IndexEntry) => `${uid}-${e.key.replace(/[^a-z0-9-]/gi, '-')}`

  // Keep the active row in view while arrowing.
  useEffect(() => {
    if (!open || !activeEntry) return
    document.getElementById(optionId(activeEntry))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeEntry?.key])

  const run = (e: IndexEntry) => {
    close()
    // Wait for the dialog to close and hand focus back before acting.
    window.setTimeout(() => {
      if (e.action === 'theme') { void pullNewProof(next, labels); return }
      if (e.action === 'copy' && e.value) {
        navigator.clipboard?.writeText(e.value).then(
          () => toast(`Copied ${e.value}`, { tone: 'ok' }),
          () => toast('Copy failed. Select the text instead.', { tone: 'warn' }),
        )
        return
      }
      if (!e.href) return
      if (e.external) { window.open(e.href, '_blank', 'noopener,noreferrer'); return }
      if (/^(mailto:|tel:)/.test(e.href)) { window.location.href = e.href; return }
      if (canJump(e.href)) { jumpToSection(e.href, reduced); return }
      router.push(e.href)
    }, 60)
  }

  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    const n = flat.length
    if (!n) return
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setCursor((safeCursor + 1) % n) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setCursor((safeCursor - 1 + n) % n) }
    else if (ev.key === 'Home' && ev.ctrlKey) { ev.preventDefault(); setCursor(0) }
    else if (ev.key === 'End' && ev.ctrlKey) { ev.preventDefault(); setCursor(n - 1) }
    else if (ev.key === 'PageDown') { ev.preventDefault(); setCursor(Math.min(n - 1, safeCursor + 8)) }
    else if (ev.key === 'PageUp') { ev.preventDefault(); setCursor(Math.max(0, safeCursor - 8)) }
    else if (ev.key === 'Enter' && activeEntry) { ev.preventDefault(); run(activeEntry) }
  }

  const titleId = `${uid}-title`
  const listId = `${uid}-list`
  const hintId = `${uid}-hint`

  return (
    <ShellDialog
      open={open}
      onClose={close}
      labelledBy={titleId}
      initialFocus={focusInput}
      className="shell-palette mx-auto mt-[max(16px,8vh)] w-[min(680px,calc(100%-24px))]"
      panelClassName={cx(
        'flex max-h-[min(640px,84dvh)] flex-col overflow-hidden bg-surface text-ink',
        'almanac:border almanac:border-rule almanac:shadow-plate',
        'strata:rounded-2 strata:shadow-plate strata:border-t-4 strata:border-layer-1',
      )}
    >
      <div className="flex items-baseline justify-between gap-3 px-s4 pt-s4 pb-s2 md:px-s5">
        <h2 id={titleId} className="display text-4">{title}</h2>
        <p className="mono nums m-0 text-ink-3" aria-hidden="true">
          {flat.length} {query ? 'found' : 'entries'}
        </p>
      </div>

      <div className="px-s4 pb-s3 md:px-s5">
        <label htmlFor={`${uid}-q`} className="sr-only">Search sections, demos and pages</label>
        <div className="flex min-h-tap items-center gap-2 border border-rule bg-bg px-3 rounded-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
          <Icon name="search" size={18} className="text-ink-3" />
          <input
            ref={inputRef}
            id={`${uid}-q`}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeEntry ? optionId(activeEntry) : undefined}
            aria-describedby={hintId}
            autoComplete="off"
            spellCheck={false}
            placeholder="Find a section, demo or page"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent py-2 text-1 outline-none placeholder:font-mono placeholder:text-0 placeholder:text-ink-3"
          />
          <button type="button" onClick={close} className="mono inline-flex min-h-[32px] items-center rounded-0 border border-rule px-2 text-ink-2 hover:bg-bg-2">
            Esc
          </button>
        </div>
      </div>

      <div ref={listRef} id={listId} role="listbox" aria-label={title} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-s2 pb-s3 md:px-s3">
        {groups.map((g) => (
          <div key={g.group} role="group" aria-labelledby={`${uid}-g-${g.group}`} className="pt-s3">
            <p id={`${uid}-g-${g.group}`} className="mono m-0 flex items-center gap-3 px-3 pb-1 text-ink-3">
              <span>{groupLabels[g.group]}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-rule-soft" />
            </p>
            {g.rows.map((e) => {
              const selected = e === activeEntry
              return (
                <div
                  key={e.key}
                  id={optionId(e)}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => { const i = flat.indexOf(e); if (i !== safeCursor) setCursor(i) }}
                  onClick={() => run(e)}
                  className={cx(
                    'relative flex min-h-tap cursor-pointer items-center gap-3 px-3 rounded-1',
                    selected ? 'bg-bg-2 text-ink' : 'text-ink-2',
                  )}
                >
                  <span aria-hidden="true" className={cx('absolute inset-y-2 left-0 w-[3px] bg-accent', selected ? 'opacity-100' : 'opacity-0')} />
                  <Icon name={e.icon} size={18} className={selected ? 'text-accent' : 'text-ink-3'} />
                  <span className="min-w-0 truncate text-1">{e.label}</span>
                  <span aria-hidden="true" className="shell-leaders" />
                  <span className={cx('mono max-w-[45%] truncate', e.group === 'section' ? 'nums text-accent-ink' : 'text-ink-3')}>
                    {e.hint}
                  </span>
                  {e.external ? <Icon name="arrow-up-right" size={14} className="text-ink-3" /> : null}
                </div>
              )
            })}
          </div>
        ))}
        {!flat.length ? (
          <div className="grid justify-items-center gap-2 px-3 py-s6 text-center" role="presentation">
            <Icon name="flat" size={32} className="text-ink-3" />
            <p className="m-0 text-1 text-ink-2">No entry for “{query.trim()}”.</p>
            <p className="mono m-0 text-ink-3">Try a skill, a demo slug or a section name</p>
          </div>
        ) : null}
      </div>

      <p id={hintId} className="mono m-0 hidden flex-wrap gap-x-4 gap-y-1 border-t border-rule-soft px-s4 py-s2 text-ink-3 md:flex md:px-s5">
        <span><kbd className="font-mono">↑ ↓</kbd> move</span>
        <span><kbd className="font-mono">Enter</kbd> open</span>
        <span><kbd className="font-mono">Esc</kbd> close</span>
        <span className="ml-auto"><kbd className="font-mono">Ctrl/⌘ K</kbd> toggle</span>
      </p>
      <p aria-live="polite" className="sr-only">
        {open && query ? (flat.length ? `${flat.length} results` : 'No results') : ''}
      </p>
    </ShellDialog>
  )
}
