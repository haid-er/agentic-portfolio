'use client'
import { memo, useState } from 'react'
import { Icon } from '@/components/ui'
import { cx } from '@/lib/utils'
import { REACTIONS, type Message, type Reaction } from './protocol'

const INK = {
  1: 'border-data-1',
  2: 'border-data-2',
  3: 'border-data-3',
  4: 'border-data-4',
} as const

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export const MessageItem = memo(function MessageItem({ msg, me, names, receipt, grouped, onReact }: {
  msg: Message
  me: string
  names: Record<string, string>
  /** Receipt line shown under my latest message in the channel. */
  receipt: string | null
  /** Same author as the previous message within a few minutes: hide the header. */
  grouped: boolean
  onReact: (id: string, r: Reaction) => void
}) {
  const [picking, setPicking] = useState(false)
  const mine = msg.author === me
  const reactions = REACTIONS.map((r) => ({ r, who: msg.reactions[r] ?? [] })).filter((x) => x.who.length)
  const nameOf = (id: string) => (id === me ? 'you' : names[id] ?? 'someone')

  return (
    <li className={cx('group grid grid-cols-[36px_minmax(0,1fr)] gap-x-3', grouped ? 'mt-1' : 'mt-4 first:mt-0')}>
      {grouped ? <span aria-hidden="true" /> : (
        <span aria-hidden="true" className={cx('grid place-items-center size-9 border-2 rounded-1 font-mono text-00 bg-surface text-ink', INK[msg.ink])}>
          {initials(msg.authorName)}
        </span>
      )}
      <div className="min-w-0">
        {grouped ? <span className="sr-only">{msg.authorName}:</span> : (
          <p className="m-0 flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{msg.authorName}</span>
            {mine ? <span className="mono text-ink-3">you</span> : null}
            <time className="mono text-ink-3" dateTime={new Date(msg.ts).toISOString()}>{hhmm(msg.ts)}</time>
          </p>
        )}
        <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-1">{msg.text}</p>

        <div className="flex flex-wrap items-center gap-1 mt-1">
          {reactions.map(({ r, who }) => {
            const on = who.includes(me)
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => onReact(msg.id, r)}
                title={who.map(nameOf).join(', ')}
                aria-label={`${r}, ${who.length}: ${who.map(nameOf).join(', ')}. ${on ? 'Remove yours' : 'Add yours'}`}
                className={cx(
                  'min-h-[32px] px-2 inline-flex items-center gap-1 border rounded-pill font-mono text-00',
                  on ? 'border-accent bg-bg-2 text-accent-ink' : 'border-rule text-ink-2 hover:bg-bg-2',
                )}
              >
                <span>{r}</span><span className="nums">{who.length}</span>
              </button>
            )
          })}
          <button
            type="button"
            aria-expanded={picking}
            aria-label={`React to message from ${msg.authorName}`}
            onClick={() => setPicking((p) => !p)}
            className={cx(
              'size-11 grid place-items-center rounded-1 text-ink-3 hover:text-ink border border-transparent hover:border-rule',
              !picking && !reactions.length && 'mid:opacity-0 mid:group-hover:opacity-100 mid:group-focus-within:opacity-100',
            )}
          >
            <Icon name="plus" size={16} />
          </button>
          {picking ? (
            <span role="group" aria-label="Reactions" className="flex flex-wrap gap-1">
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { onReact(msg.id, r); setPicking(false) }}
                  className="min-h-tap px-3 border border-rule rounded-pill font-mono text-00 bg-surface hover:bg-bg-2"
                >
                  {r}
                </button>
              ))}
            </span>
          ) : null}
        </div>
        {receipt ? (
          <p className="m-0 mt-1 mono text-ink-3 flex items-center gap-1">
            <Icon name="check" size={12} />
            {receipt}
          </p>
        ) : null}
      </div>
    </li>
  )
})
