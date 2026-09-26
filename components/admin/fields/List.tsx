'use client'
/**
 * List field: add, remove (with undo), reorder and collapse items.
 *
 * Reorder three ways, all announced in a polite live region:
 * - drag the grip handle (mouse, pen or touch: pointer events, no library)
 * - focus the handle and press ArrowUp / ArrowDown (Home / End for the ends)
 * - the up / down buttons on each row
 *
 * Items with an `enabled` flag get a one-tap show/hide on their header, and
 * `verified: false` items carry the "unverified" badge.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Search, Trash2 } from 'lucide-react'
import { Badge, Button, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { useEditor, useField } from '../EditorContext'
import { move, type Path } from '../lib/path'
import { UnverifiedBadge } from './Item'


type AnyItem = { enabled?: boolean; verified?: boolean } | string | number | null | object

export interface ListFieldProps<T> {
  path: Path
  label: string
  hint?: ReactNode
  /** Title shown on the item header (collapsed rows, announcements). */
  itemTitle: (item: T, index: number) => string
  /** Small line under the title (dates, slug…). */
  itemSubtitle?: (item: T) => string | undefined
  /** Extra badges on the header. */
  itemBadges?: (item: T) => ReactNode
  newItem: (items: T[]) => T
  children: (itemPath: Path, item: T, index: number) => ReactNode
  addLabel?: string
  /** Collapsible cards (default) or always-open rows. */
  collapsible?: boolean
  /** Text to match for the filter box (shown when there are more than 5 items). */
  search?: (item: T) => string
  max?: number
  emptyText?: string
  /** Hide the heading (when the surrounding group already names the list). */
  hideLabel?: boolean
  /** Show the add button (default true). */
  addable?: boolean
  /** Show remove buttons (default true). Fixed lists (sections) hide instead. */
  removable?: boolean
}

export function ListField<T extends AnyItem>(props: ListFieldProps<T>) {
  const { path, label, hint, itemTitle, itemSubtitle, itemBadges, newItem, children, addLabel = 'Add item', collapsible = true, search, max, emptyText, hideLabel, addable = true, removable = true } = props
  const ed = useEditor()
  const f = useField<T[] | undefined>(path)
  const items = f.value ?? []

  // Stable React keys that survive edits to ids/titles and follow moves. The counter is
  // per list instance (not module-wide), so server and client mint the same first keys
  // and element ids hydrate cleanly on every request.
  const seqRef = useRef(0)
  const newKey = () => `k${++seqRef.current}`
  const keysRef = useRef<string[]>([])
  if (keysRef.current.length !== items.length) {
    keysRef.current = items.map((_, i) => keysRef.current[i] ?? newKey())
  }
  const keys = keysRef.current

  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [announce, setAnnounce] = useState('')
  const [removed, setRemoved] = useState<{ item: T; index: number; key: string; title: string } | null>(null)
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)
  const focusNext = useRef<{ key: string; target: 'handle' | 'first' } | null>(null)
  const rowRefs = useRef(new Map<string, HTMLLIElement>())

  // Focus management after moves / adds (React re-inserts moved nodes, which drops focus).
  useEffect(() => {
    const want = focusNext.current
    if (!want) return
    focusNext.current = null
    const row = rowRefs.current.get(want.key)
    const el = want.target === 'handle'
      ? row?.querySelector<HTMLElement>('[data-handle]')
      : row?.querySelector<HTMLElement>('input:not([type=checkbox]), textarea, select')
    el?.focus()
    if (want.target === 'first') el?.scrollIntoView({ block: 'nearest' })
  })

  // Collapsed items with problems open themselves after a save attempt.
  useEffect(() => {
    if (!ed.revealed || !collapsible) return
    const withErrors = keys.filter((_, i) => ed.errorsUnder([...path, i]) > 0)
    if (withErrors.some((k) => !open.has(k))) setOpen((s) => new Set([...s, ...withErrors]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed.revealed, ed.data])

  // Undo expires.
  useEffect(() => {
    if (!removed) return
    const t = window.setTimeout(() => setRemoved(null), 10_000)
    return () => window.clearTimeout(t)
  }, [removed])

  const titleOf = (i: number) => itemTitle(items[i] as T, i) || `Item ${i + 1}`

  const doMove = (from: number, to: number, focus = true) => {
    if (to < 0 || to >= items.length || from === to) return
    f.set(move(items, from, to))
    keysRef.current = move(keys, from, to)
    if (focus) focusNext.current = { key: keys[from]!, target: 'handle' }
    setAnnounce(`${titleOf(from)} moved to position ${to + 1} of ${items.length}.`)
  }

  const add = () => {
    const item = newItem(items)
    const key = newKey()
    keysRef.current = [...keys, key]
    f.set([...items, item])
    setOpen((s) => new Set(s).add(key))
    setQuery('')
    focusNext.current = { key, target: 'first' }
    setAnnounce(`Added item ${items.length + 1}.`)
  }

  const remove = (i: number) => {
    const title = titleOf(i)
    setRemoved({ item: items[i] as T, index: i, key: keys[i]!, title })
    keysRef.current = keys.filter((_, j) => j !== i)
    f.set(items.filter((_, j) => j !== i))
    setAnnounce(`Removed ${title}. Undo is available for 10 seconds.`)
  }

  const undo = () => {
    if (!removed) return
    const at = Math.min(removed.index, items.length)
    const next = items.slice()
    next.splice(at, 0, removed.item)
    const nextKeys = keys.slice()
    nextKeys.splice(at, 0, removed.key)
    keysRef.current = nextKeys
    f.set(next)
    setAnnounce(`Restored ${removed.title}.`)
    focusNext.current = { key: removed.key, target: 'handle' }
    setRemoved(null)
  }

  const toggleOpen = (key: string) => setOpen((s) => {
    const n = new Set(s)
    if (n.has(key)) n.delete(key)
    else n.add(key)
    return n
  })

  /* ---------- pointer drag ---------- */
  const onHandlePointerDown = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || query) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const startY = e.clientY
    let moved = false
    let over = i
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientY - startY) < 4) return
      moved = true
      over = overIndex(i, ev.clientY)
      setDrag({ from: i, over })
      autoScroll(ev.clientY)
    }
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      setDrag(null)
      if (moved && over !== i) doMove(i, over)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  /** Final index for a drop at viewport y: how many other rows sit above that point. */
  const overIndex = (from: number, y: number) =>
    keys.reduce((n, k, j) => {
      if (j === from) return n
      const r = rowRefs.current.get(k)?.getBoundingClientRect()
      return r && y > r.top + r.height / 2 ? n + 1 : n
    }, 0)

  const onHandleKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null
    if (to === null) return
    e.preventDefault()
    doMove(i, to)
  }

  const q = query.trim().toLowerCase()
  const matches = (item: T, i: number) => !q || (search ? search(item) : itemTitle(item, i)).toLowerCase().includes(q)
  const shownCount = q ? items.filter(matches).length : items.length
  const canReorder = !q && items.length > 1
  const full = max !== undefined && items.length >= max
  const headingId = `${f.key}-h`

  return (
    <section aria-labelledby={headingId} className="grid gap-s3 min-w-0" data-path={f.key}>
      <div className={cx('flex flex-wrap items-end justify-between gap-2', hideLabel && 'sr-only')}>
        <h3 id={headingId} className="mono m-0 text-ink-2 flex items-center gap-2">
          {label}
          <span className="text-ink-3">({items.length})</span>
          {f.changed ? <span aria-hidden="true" className="inline-block size-[6px] rounded-pill bg-accent-2" /> : null}
        </h3>
      </div>
      {hint ? <p className="m-0 -mt-2 text-00 text-ink-3">{hint}</p> : null}
      {f.error ? <p className="m-0 text-0 text-danger">{f.error}</p> : null}

      {search && items.length > 5 ? (
        <div className="relative">
          <Search aria-hidden="true" size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}`}
            aria-label={`Filter ${label}`}
            className={cx(controlClasses, 'pl-9')}
          />
          {q ? <p className="m-0 mt-1 text-00 text-ink-3" aria-live="polite">{shownCount} of {items.length} shown. Clear the filter to reorder.</p> : null}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="m-0 p-s4 border border-dashed border-rule rounded-1 text-0 text-ink-3 flex items-center gap-2">
          <span aria-hidden="true" className="inline-block w-6 border-t border-ink-3" />
          {emptyText ?? 'Nothing here yet.'}
        </p>
      ) : (
        <ol className="m-0 p-0 list-none grid gap-s2">
          {items.map((item, i) => {
            if (!matches(item, i)) return null
            const key = keys[i]!
            const isOpen = !collapsible || open.has(key)
            const problems = ed.errorsUnder([...path, i])
            const obj = typeof item === 'object' && item !== null ? (item as { enabled?: boolean; verified?: boolean }) : null
            const hasEnabled = obj && typeof obj.enabled === 'boolean'
            const hidden = hasEnabled && obj.enabled === false
            const title = titleOf(i)
            const subtitle = itemSubtitle?.(item)
            const dragging = drag?.from === i
            const dropHere = drag && drag.over === i && drag.from !== i
            const bodyId = `${f.key}-${key}`
            return (
              <li
                key={key}
                ref={(el) => { if (el) rowRefs.current.set(key, el); else rowRefs.current.delete(key) }}
                className={cx(
                  'relative min-w-0 bg-surface border rounded-1',
                  problems ? 'border-danger' : 'border-rule',
                  hidden && 'bg-bg-2',
                  dragging && 'opacity-60 shadow-press',
                  'motion-safe:transition-[opacity,box-shadow] duration-[var(--dur-fast)]',
                )}
              >
                {dropHere ? (
                  <span aria-hidden="true" className={cx('absolute inset-x-0 h-[3px] bg-accent-2 rounded-pill', drag.from < i ? '-bottom-[6px]' : '-top-[6px]')} />
                ) : null}
                <div className="flex flex-wrap items-center gap-x-1 gap-y-0 pr-1">
                  {canReorder ? (
                    <button
                      type="button"
                      data-handle
                      onPointerDown={onHandlePointerDown(i)}
                      onKeyDown={onHandleKey(i)}
                      aria-label={`Reorder ${title}, position ${i + 1} of ${items.length}. Use arrow keys to move.`}
                      className="grid place-items-center w-[40px] min-h-tap flex-none text-ink-3 hover:text-ink cursor-grab active:cursor-grabbing touch-none"
                    >
                      <GripVertical aria-hidden="true" size={18} strokeWidth={1.5} />
                    </button>
                  ) : <span className="w-s3" />}
                  <div className="flex-1 min-w-[10rem] py-2">
                    {collapsible ? (
                      <button
                        type="button"
                        onClick={() => toggleOpen(key)}
                        aria-expanded={isOpen}
                        aria-controls={bodyId}
                        className="w-full min-h-tap text-left flex items-center gap-2 group"
                      >
                        <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} className={cx('flex-none text-ink-3 motion-safe:transition-transform', !isOpen && '-rotate-90')} />
                        <span className="min-w-0">
                          <span className={cx('block font-semibold [overflow-wrap:anywhere] group-hover:underline', hidden && 'text-ink-2')}>{title}</span>
                          {subtitle ? <span className="block mono text-ink-3 normal-case tracking-normal">{subtitle}</span> : null}
                        </span>
                      </button>
                    ) : (
                      <p className="m-0 flex items-center gap-2 min-h-tap">
                        <span className="mono text-ink-3 nums">{String(i + 1).padStart(2, '0')}</span>
                        <span className="font-semibold [overflow-wrap:anywhere]">{title}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 ml-auto">
                    {obj?.verified === false ? <UnverifiedBadge /> : null}
                    {itemBadges?.(item)}
                    {problems ? <Badge tone="danger">{problems} to fix</Badge> : null}
                    {hasEnabled ? (
                      <button
                        type="button"
                        aria-pressed={!hidden}
                        onClick={() => ed.set([...path, i, 'enabled'], !obj.enabled)}
                        className={cx('inline-flex items-center gap-1 min-h-tap px-2 mono', hidden ? 'text-ink-3' : 'text-ok')}
                        title={hidden ? 'Hidden on the site: click to show' : 'Shown on the site: click to hide'}
                      >
                        {hidden ? <EyeOff aria-hidden="true" size={16} strokeWidth={1.5} /> : <Eye aria-hidden="true" size={16} strokeWidth={1.5} />}
                        <span>{hidden ? 'Hidden' : 'Shown'}</span>
                        <span className="sr-only">: {title}</span>
                      </button>
                    ) : null}
                    {canReorder ? (
                      <>
                        <IconBtn label={`Move ${title} up`} disabled={i === 0} onClick={() => doMove(i, i - 1, false)}><ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" /></IconBtn>
                        <IconBtn label={`Move ${title} down`} disabled={i === items.length - 1} onClick={() => doMove(i, i + 1, false)}><ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" /></IconBtn>
                      </>
                    ) : null}
                    {removable ? <IconBtn label={`Remove ${title}`} onClick={() => remove(i)} danger><Trash2 size={17} strokeWidth={1.5} aria-hidden="true" /></IconBtn> : null}
                  </div>
                </div>
                {isOpen ? (
                  <div id={bodyId} className="grid gap-s4 px-s4 pb-s4 pt-s1 border-t border-rule-soft motion-safe:animate-[fade-in_var(--dur-fast)_var(--ease-out)]">
                    {children([...path, i], item, i)}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {addable ? <Button size="sm" variant="secondary" icon="plus" onClick={add} disabled={full}>{addLabel}</Button> : null}
        {full ? <span className="text-00 text-ink-3">Maximum of {max} reached.</span> : null}
        {removed ? (
          <span className="inline-flex items-center gap-2 text-0 text-ink-2 motion-safe:animate-[fade-in_var(--dur-fast)_var(--ease-out)]">
            Removed “{removed.title}”.
            <button type="button" onClick={undo} className="min-h-tap px-2 underline text-accent-ink font-semibold">Undo</button>
          </span>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </section>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'grid place-items-center size-[44px] flex-none rounded-1 text-ink-2 hover:bg-bg-2 disabled:opacity-35 disabled:hover:bg-transparent',
        danger && 'hover:text-danger',
      )}
    >
      {children}
    </button>
  )
}

/** Scroll the page while dragging near the viewport edges. */
function autoScroll(y: number) {
  const edge = 64
  if (y < edge) window.scrollBy(0, -12)
  else if (y > window.innerHeight - edge) window.scrollBy(0, 12)
}
