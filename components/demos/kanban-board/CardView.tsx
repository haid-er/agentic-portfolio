'use client'
import { useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Badge, Button, Select, type Tone } from '@/components/ui'
import { cx } from '@/lib/utils'
import { MAX_NOTE, MAX_TITLE, TAGS, type Card, type Tag } from './model'

const TAG_TONE: Record<Tag, Tone> = { none: 'neutral', feature: 'ok', bug: 'danger', chore: 'warn' }

export function CardView({ card, columnTitle, lifted, ghostOf, onGripPointerDown, onBodyPointerDown, onGripKey, onGripBlur, onSave, onDelete }: {
  card: Card
  columnTitle: string
  /** Picked up with the keyboard. */
  lifted: boolean
  /** Being dragged with a pointer: rendered as a faded origin. */
  ghostOf: boolean
  onGripPointerDown: (e: PointerEvent<HTMLElement>) => void
  onBodyPointerDown: (e: PointerEvent<HTMLElement>) => void
  onGripKey: (e: KeyboardEvent<HTMLButtonElement>) => void
  onGripBlur: () => void
  onSave: (patch: Pick<Card, 'title' | 'note' | 'tag'>) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(card.title)
  const [note, setNote] = useState(card.note)
  const [tag, setTag] = useState<Tag>(card.tag)

  const startEdit = () => { setTitle(card.title); setNote(card.note); setTag(card.tag); setEditing(true) }
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), note: note.trim(), tag })
    setEditing(false)
  }

  if (editing) {
    return (
      <form onSubmit={save} className="grid gap-3 p-3 bg-surface border border-rule rounded-1" onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}>
        <label className="grid gap-1">
          <span className="mono text-ink-2">Title</span>
          <input
            autoFocus
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-tap px-3 bg-surface text-ink border border-rule rounded-0"
          />
        </label>
        <label className="grid gap-1">
          <span className="mono text-ink-2">Note</span>
          <textarea
            value={note}
            rows={3}
            maxLength={MAX_NOTE}
            onChange={(e) => setNote(e.target.value)}
            className="px-3 py-2 bg-surface text-ink border border-rule rounded-0 resize-y"
          />
        </label>
        <Select label="Tag" value={tag} onChange={(e) => setTag(e.target.value as Tag)}>
          {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" type="submit" disabled={!title.trim()}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" variant="danger" className="ml-auto" onClick={onDelete}>Delete</Button>
        </div>
      </form>
    )
  }

  return (
    <article
      data-card-id={card.id}
      onPointerDown={onBodyPointerDown}
      aria-label={card.title}
      className={cx(
        'grid grid-cols-[44px_minmax(0,1fr)_auto] items-start bg-surface border rounded-1 select-none',
        'transition-[transform,box-shadow,opacity] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        lifted ? 'border-accent shadow-press -translate-y-[2px]' : 'border-rule strata:border-rule-soft',
        ghostOf && 'opacity-35 border-dashed',
        'mid:cursor-grab',
      )}
    >
      <button
        type="button"
        data-grip={card.id}
        aria-pressed={lifted}
        aria-roledescription="draggable card"
        aria-describedby="kanban-drag-help"
        aria-label={`Move ${card.title}, in ${columnTitle}`}
        onPointerDown={onGripPointerDown}
        onKeyDown={onGripKey}
        onBlur={onGripBlur}
        className={cx('grid place-items-center size-11 touch-none cursor-grab text-ink-3 hover:text-ink', lifted && 'text-accent-ink')}
      >
        <GripGlyph />
      </button>
      <div className="min-w-0 py-2">
        <p className="m-0 font-semibold leading-snug [overflow-wrap:anywhere]">{card.title}</p>
        {card.note ? <p className="m-0 mt-1 text-0 text-ink-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{card.note}</p> : null}
        {card.tag !== 'none' ? <Badge tone={TAG_TONE[card.tag]} className="mt-2">{card.tag}</Badge> : null}
      </div>
      <button
        type="button"
        onClick={startEdit}
        aria-label={`Edit ${card.title}`}
        className="grid place-items-center size-11 text-ink-3 hover:text-ink"
      >
        <PencilGlyph />
      </button>
    </article>
  )
}

/** Visual clone that follows the pointer while dragging. */
export function DragGhost({ card, width }: { card: Card; width: number }) {
  return (
    <div
      aria-hidden="true"
      style={{ width }}
      className="grid grid-cols-[44px_minmax(0,1fr)] items-start bg-surface border border-accent rounded-1 shadow-plate rotate-[1.5deg] motion-reduce:rotate-0"
    >
      <span className="grid place-items-center size-11 text-accent-ink"><GripGlyph /></span>
      <p className="m-0 py-2 pr-3 font-semibold leading-snug [overflow-wrap:anywhere]">{card.title}</p>
    </div>
  )
}

function GripGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  )
}

function PencilGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ strokeLinecap: 'var(--icon-cap, square)' as 'square' }}>
      <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
    </svg>
  )
}

