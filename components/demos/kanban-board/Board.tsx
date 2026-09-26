'use client'
/**
 * The board: three columns, pointer drag and drop (mouse, touch, pen) and a keyboard
 * pick-up / move / drop model on each card's grip button, announced through a live region.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Button } from '@/components/ui'
import { cx } from '@/lib/utils'
import { CardView, DragGhost } from './CardView'
import { addCard, locate, MAX_TITLE, moveCard, updateCard, type Board as BoardData, type Card } from './model'

interface Over { col: number; index: number }
interface DragView { cardId: string; card: Card; width: number; over: Over | null }
interface DragTrack {
  cardId: string; card: Card; pointerId: number
  startX: number; startY: number; offX: number; offY: number; width: number
  lastX: number; lastY: number; started: boolean; over: Over | null
}

const THRESHOLD = 5
const EDGE = 80

export function Board({ board, onChange, onDelete }: {
  board: BoardData
  onChange: (b: BoardData, why: string) => void
  onDelete: (cardId: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef(board)
  useEffect(() => { boardRef.current = board }, [board])

  const [drag, setDrag] = useState<DragView | null>(null)
  const track = useRef<DragTrack | null>(null)
  const [lifted, setLifted] = useState<{ cardId: string; snapshot: BoardData } | null>(null)
  const liftedRef = useRef(lifted)
  useEffect(() => { liftedRef.current = lifted }, [lifted])
  const [focusId, setFocusId] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  const colTitle = (i: number) => boardRef.current.columns[i]?.title ?? ''
  const where = (b: BoardData, id: string) => {
    const at = locate(b, id)
    return at ? `${b.columns[at.col].title}, position ${at.index + 1} of ${b.columns[at.col].cards.length}` : ''
  }

  // Keep keyboard focus on a card's grip after it moves to another column (it remounts).
  useLayoutEffect(() => {
    if (!focusId) return
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-grip="${CSS.escape(focusId)}"]`)?.focus()
  }, [focusId, board])

  /* ---------- pointer drag ---------- */

  const computeOver = useCallback((x: number, y: number, draggingId: string): Over | null => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-col]')
    if (!hit || !rootRef.current?.contains(hit)) return null
    const col = Number(hit.dataset.col)
    const cards = [...hit.querySelectorAll<HTMLElement>('[data-card-id]')].filter((el) => el.dataset.cardId !== draggingId)
    let index = cards.length
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (y < r.top + r.height / 2) { index = i; break }
    }
    return { col, index }
  }, [])

  const placeGhost = () => {
    const t = track.current
    if (t && ghostRef.current) ghostRef.current.style.transform = `translate3d(${t.lastX - t.offX}px, ${t.lastY - t.offY}px, 0)`
  }
  useLayoutEffect(placeGhost, [drag?.cardId])

  const refreshOver = useCallback(() => {
    const t = track.current
    if (!t?.started) return
    const over = computeOver(t.lastX, t.lastY, t.cardId)
    if (over?.col === t.over?.col && over?.index === t.over?.index) return
    t.over = over
    setDrag((d) => (d ? { ...d, over } : d))
  }, [computeOver])

  const beginPointer = useCallback((e: PointerEvent<HTMLElement>, card: Card) => {
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-card-id]')
    if (!el || track.current) return
    const r = el.getBoundingClientRect()
    track.current = {
      cardId: card.id, card, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, width: r.width,
      lastX: e.clientX, lastY: e.clientY, started: false, over: null,
    }
    let raf = 0

    const autoscroll = () => {
      const t = track.current
      if (!t?.started) return
      const y = t.lastY
      const h = window.innerHeight
      const dy = y < EDGE ? -Math.ceil((EDGE - y) / 5) : y > h - EDGE ? Math.ceil((y - (h - EDGE)) / 5) : 0
      if (dy) { window.scrollBy(0, dy); refreshOver() }
      raf = requestAnimationFrame(autoscroll)
    }

    const move = (ev: globalThis.PointerEvent) => {
      const t = track.current
      if (!t || ev.pointerId !== t.pointerId) return
      t.lastX = ev.clientX
      t.lastY = ev.clientY
      if (!t.started) {
        if (Math.hypot(ev.clientX - t.startX, ev.clientY - t.startY) < THRESHOLD) return
        t.started = true
        setLifted(null)
        setDrag({ cardId: t.cardId, card: t.card, width: t.width, over: null })
        setAnnounce(`Dragging ${t.card.title}.`)
        raf = requestAnimationFrame(autoscroll)
      }
      ev.preventDefault()
      placeGhost()
      refreshOver()
    }

    const finish = (commit: boolean) => {
      const t = track.current
      track.current = null
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', key)
      if (!t?.started) return
      setDrag(null)
      if (commit && t.over) {
        const next = moveCard(boardRef.current, t.cardId, t.over.col, t.over.index)
        onChange(next, 'move')
        setAnnounce(`Dropped ${t.card.title} in ${where(next, t.cardId)}.`)
      } else {
        setAnnounce(`Drag cancelled. ${t.card.title} stayed where it was.`)
      }
    }
    const up = (ev: globalThis.PointerEvent) => { if (ev.pointerId === track.current?.pointerId) finish(true) }
    const cancel = () => finish(false)
    const key = (ev: globalThis.KeyboardEvent) => { if (ev.key === 'Escape') finish(false) }

    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', key)
  }, [onChange, refreshOver])

  const onGripPointerDown = (e: PointerEvent<HTMLElement>, card: Card) => {
    if (e.button !== 0) return
    beginPointer(e, card)
  }
  const onBodyPointerDown = (e: PointerEvent<HTMLElement>, card: Card) => {
    // Touch and pen drag from the grip only, so the page still scrolls under a finger.
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return
    beginPointer(e, card)
  }

  /* ---------- keyboard drag ---------- */

  const onGripKey = (e: KeyboardEvent<HTMLButtonElement>, card: Card) => {
    const b = boardRef.current
    const isLifted = lifted?.cardId === card.id
    if (!isLifted) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setLifted({ cardId: card.id, snapshot: b })
        setAnnounce(`Picked up ${card.title}. ${where(b, card.id)}. Arrow keys move it, Space drops, Escape cancels.`)
      }
      return
    }
    const at = locate(b, card.id)
    if (!at) return
    let next: BoardData | null = null
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault()
        setLifted(null)
        setAnnounce(`Dropped ${card.title} in ${where(b, card.id)}.`)
        return
      case 'Escape':
        e.preventDefault()
        onChange(lifted!.snapshot, 'cancel')
        setLifted(null)
        setFocusId(card.id)
        setAnnounce(`Move cancelled. ${card.title} is back in ${where(lifted!.snapshot, card.id)}.`)
        return
      case 'ArrowUp':
        if (at.index > 0) next = moveCard(b, card.id, at.col, at.index - 1)
        break
      case 'ArrowDown':
        if (at.index < b.columns[at.col].cards.length - 1) next = moveCard(b, card.id, at.col, at.index + 1)
        break
      case 'ArrowLeft':
        if (at.col > 0) next = moveCard(b, card.id, at.col - 1, at.index)
        break
      case 'ArrowRight':
        if (at.col < b.columns.length - 1) next = moveCard(b, card.id, at.col + 1, at.index)
        break
      default:
        return
    }
    e.preventDefault()
    if (!next) { setAnnounce(`${card.title} cannot move further that way. ${where(b, card.id)}.`); return }
    boardRef.current = next
    onChange(next, 'keyboard-preview')
    setFocusId(card.id)
    setAnnounce(where(next, card.id))
  }

  // Leaving the grip while lifted drops the card where it is.
  const onGripBlur = (card: Card) => {
    setTimeout(() => {
      const l = liftedRef.current
      if (!l || l.cardId !== card.id) return
      const active = document.activeElement as HTMLElement | null
      if (active?.dataset.grip === card.id) return
      setLifted(null)
      setAnnounce(`Dropped ${card.title} in ${where(boardRef.current, card.id)}.`)
    }, 0)
  }

  return (
    <div ref={rootRef} className="grid gap-4 min-w-0">
      <p id="kanban-drag-help" className="sr-only">
        Press Space to pick up. Arrow keys move between positions and columns. Space drops. Escape cancels.
      </p>
      <p className="sr-only" aria-live="assertive">{announce}</p>

      <div className={cx('grid gap-4 md:grid-cols-3 items-start', drag && 'cursor-grabbing')}>
        {board.columns.map((col, ci) => {
          const over = drag?.over?.col === ci ? drag.over.index : null
          let k = 0
          const Slot = <li key="slot" aria-hidden="true" className="h-11 border-2 border-dashed border-accent rounded-1 bg-bg-2" />
          return (
            <section key={col.id} aria-labelledby={`kanban-col-${col.id}`} className="grid gap-3 p-3 bg-bg-2 border border-rule rounded-2 min-w-0 strata:border-rule-soft">
              <header className="flex items-center justify-between gap-2">
                <h3 id={`kanban-col-${col.id}`} className="m-0 font-mono text-0 uppercase tracking-[.1em]">{col.title}</h3>
                <span className="mono text-ink-3 nums">{col.cards.length} {col.cards.length === 1 ? 'card' : 'cards'}</span>
              </header>
              <ul
                data-col={ci}
                className={cx(
                  'm-0 p-0 list-none grid gap-2 min-h-[88px] rounded-1',
                  over !== null && 'outline-2 outline-dashed outline-offset-4 outline-accent',
                )}
              >
                {col.cards.flatMap((card) => {
                  const isDragged = drag?.cardId === card.id
                  const before = !isDragged && over === k ? Slot : null
                  if (!isDragged) k++
                  const item = (
                    <li key={card.id}>
                      <CardView
                        card={card}
                        columnTitle={col.title}
                        lifted={lifted?.cardId === card.id}
                        ghostOf={isDragged}
                        onGripPointerDown={(e) => onGripPointerDown(e, card)}
                        onBodyPointerDown={(e) => onBodyPointerDown(e, card)}
                        onGripKey={(e) => onGripKey(e, card)}
                        onGripBlur={() => onGripBlur(card)}
                        onSave={(patch) => onChange(updateCard(boardRef.current, card.id, patch), 'edit')}
                        onDelete={() => onDelete(card.id)}
                      />
                    </li>
                  )
                  return before ? [before, item] : [item]
                })}
                {over !== null && over >= k ? Slot : null}
                {col.cards.length === 0 && over === null ? (
                  <li className="grid place-items-center min-h-[88px] border border-dashed border-rule rounded-1 mono text-ink-3 text-center px-3">
                    Empty. Drop a card here.
                  </li>
                ) : null}
              </ul>
              <AddCard onAdd={(title) => { onChange(addCard(boardRef.current, ci, title), 'add'); setAnnounce(`Added ${title} to ${colTitle(ci)}.`) }} column={col.title} />
            </section>
          )
        })}
      </div>

      {drag ? (
        <div ref={ghostRef} className="fixed left-0 top-0 z-[var(--z-press)] pointer-events-none will-change-transform">
          <DragGhost card={drag.card} width={drag.width} />
        </div>
      ) : null}
    </div>
  )
}

function AddCard({ onAdd, column }: { onAdd: (title: string) => void; column: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(title.trim())
    setTitle('')
  }
  if (!open) {
    return <Button size="sm" variant="ghost" icon="plus" onClick={() => setOpen(true)} className="justify-start">Add a card</Button>
  }
  return (
    <form onSubmit={submit} className="grid gap-2" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <label className="grid gap-1">
        <span className="mono text-ink-2">New card in {column}</span>
        <input
          autoFocus
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="min-h-tap px-3 bg-surface text-ink border border-rule rounded-0 placeholder:font-mono placeholder:text-0 placeholder:text-ink-3"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit" disabled={!title.trim()}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Done</Button>
      </div>
    </form>
  )
}
