'use client'
/**
 * Live chat: a Stream-Chat-style client whose "server" is your browser. Tabs on this page
 * exchange events over BroadcastChannel (or storage events), run one reducer and converge on
 * one history. Channels, typing indicators, reactions, delivery acks and read receipts are all
 * events; a simulated peer answers from this tab so a single tab still shows the full loop.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  Badge, Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, Loading, Textarea, Toggle,
} from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { usePageVisible, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { initials, MessageItem } from './MessageItem'
import { BOT, BOT_ID, CHANNELS, MAX_TEXT, unreadCount, type ChannelId, type ChatState, type Message } from './protocol'
import { useChat } from './useChat'

export { notes } from './notes'

const GROUP_MS = 4 * 60 * 1000

function receiptFor(msg: Message, state: ChatState, me: string, names: Record<string, string>): string {
  const readers = Object.entries(state.reads)
    .filter(([id, r]) => id !== me && (r[msg.channel] ?? 0) >= msg.ts)
    .map(([id]) => names[id] ?? 'someone')
  if (readers.length) return `Read by ${readers.slice(0, 3).join(', ')}${readers.length > 3 ? ` +${readers.length - 3}` : ''}`
  if (msg.deliveredTo.length) return `Delivered to ${msg.deliveredTo.length} ${msg.deliveredTo.length === 1 ? 'tab' : 'tabs'}`
  return 'Sent'
}

export default function Demo(_props: DemoProps) {
  const chat = useChat()
  const { me, state } = chat
  const visible = usePageVisible()
  const reduced = useReducedMotion()
  const [channel, setChannel] = useState<ChannelId>('general')
  const [draft, setDraft] = useState('')
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [announce, setAnnounce] = useState('')

  const listRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const [newBelow, setNewBelow] = useState(0)

  const names = useMemo(() => ({ ...state.names, [me.id]: me.name, [BOT_ID]: BOT.name }), [state.names, me])
  const messages = useMemo(() => state.messages.filter((m) => m.channel === channel), [state.messages, channel])
  const lastMine = useMemo(() => [...messages].reverse().find((m) => m.author === me.id)?.id, [messages, me.id])

  // Mark the open channel read while the tab is visible.
  const { markRead, loaded } = chat
  useEffect(() => { if (visible && loaded) markRead(channel) }, [visible, loaded, channel, messages.length, markRead])

  // Announce messages from others (screen readers), in any channel.
  const lastSeenId = useRef<string | null>(null)
  useEffect(() => {
    const last = state.messages[state.messages.length - 1]
    if (!last || last.id === lastSeenId.current) return
    const first = lastSeenId.current === null
    lastSeenId.current = last.id
    if (!first && last.author !== me.id) setAnnounce(`${last.authorName} in #${last.channel}: ${last.text}`)
  }, [state.messages, me.id])

  // Stick to the bottom unless the reader scrolled up; then count what arrived below.
  const count = messages.length
  const prevCount = useRef(count)
  useLayoutEffect(() => {
    const el = listRef.current
    const grew = count > prevCount.current
    prevCount.current = count
    if (!el) return
    if (atBottom.current) { el.scrollTop = el.scrollHeight; setNewBelow(0) }
    else if (grew) setNewBelow((n) => n + 1)
  }, [count, channel])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    if (atBottom.current) setNewBelow(0)
  }
  const jump = () => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
    atBottom.current = true
    setNewBelow(0)
  }

  const switchChannel = (c: ChannelId) => { setChannel(c); atBottom.current = true; setNewBelow(0) }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!draft.trim()) return
    chat.send(channel, draft)
    setDraft('')
    atBottom.current = true
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
  }

  const typers = Object.entries(chat.typing)
    .filter(([id, t]) => id !== me.id && t.channel === channel)
    .map(([id]) => names[id] ?? 'Someone')
  const peerList = Object.values(chat.peers)
  const topic = CHANNELS.find((c) => c.id === channel)?.topic ?? ''

  const openTab = () => { window.open(window.location.href, '_blank', 'noopener') }

  return (
    <div className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoToolbar className="items-center">
        <Badge tone={chat.kind === 'none' ? 'danger' : 'ok'}>
          {chat.kind === 'broadcast' ? 'BroadcastChannel' : chat.kind === 'storage' ? 'storage events' : 'no cross-tab transport'}
        </Badge>
        <Badge tone="neutral">{peerList.length + 1} {peerList.length ? 'tabs' : 'tab'} online</Badge>
        <Button size="sm" variant="secondary" icon="external" onClick={openTab}>Open another tab</Button>
        <Toggle label="Simulated peer" checked={chat.bot} onChange={chat.setBot} />
      </DemoToolbar>

      <DemoGrid
        aside={
          <>
            <DemoPanel title="Who is here" meta={`as ${me.name}`}>
              <ul className="m-0 p-0 list-none grid gap-2">
                <MemberRow name={me.name} note="this tab" />
                {peerList.map((p) => <MemberRow key={p.member.id} name={p.member.name} note="another tab" />)}
                {chat.bot ? <MemberRow name={BOT.name} note="simulated, runs in this tab" /> : null}
              </ul>
              <form
                className="mt-4 flex flex-wrap items-end gap-2"
                onSubmit={(e) => { e.preventDefault(); if (nameDraft) chat.rename(nameDraft); setNameDraft(null) }}
              >
                <label className="grid gap-1 flex-1 min-w-[140px]">
                  <span className="mono text-ink-2">Your display name</span>
                  <input
                    value={nameDraft ?? me.name}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={24}
                    className="min-h-tap px-3 bg-surface text-ink border border-rule rounded-0"
                  />
                </label>
                <Button size="sm" variant="secondary" type="submit" disabled={!nameDraft || nameDraft.trim() === me.name}>Rename</Button>
              </form>
            </DemoPanel>
            <DemoPanel title="Wire" meta="events, newest first">
              {chat.wire.length ? (
                <ol className="m-0 p-0 list-none grid gap-1 max-h-[300px] overflow-y-auto" aria-label="Cross-tab events">
                  {chat.wire.map((w) => (
                    <li key={w.n} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 font-mono text-00">
                      <span className={w.dir === 'out' ? 'text-accent-ink' : 'text-ink-3'}>{w.dir === 'out' ? 'out ▸' : '◂ in'}</span>
                      <span className="text-ink-2 [overflow-wrap:anywhere]">{w.text}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="m-0 text-0 text-ink-3">Nothing on the wire yet. Open a second tab to see presence.</p>}
              <div className="mt-4">
                {confirmClear ? (
                  <DemoToolbar>
                    <Button size="sm" variant="danger" onClick={() => { chat.clear(); setConfirmClear(false) }}>Wipe in every tab</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>Keep</Button>
                  </DemoToolbar>
                ) : <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>Clear history</Button>}
              </div>
            </DemoPanel>
          </>
        }
      >
        <section aria-label="Chat" className="bg-surface border border-rule rounded-2 min-w-0 grid md:grid-cols-[180px_minmax(0,1fr)] overflow-hidden strata:border-rule-soft">
          <nav aria-label="Channels" className="border-b md:border-b-0 md:border-r border-rule strata:border-rule-soft p-2">
            <ul className="m-0 p-0 list-none flex flex-wrap md:flex-col gap-1">
              {CHANNELS.map((c) => {
                const unread = c.id === channel ? 0 : unreadCount(state, me.id, c.id)
                const on = c.id === channel
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => switchChannel(c.id)}
                      className={cx(
                        'w-full min-h-tap px-3 flex items-center justify-between gap-2 rounded-1 font-mono text-0 text-left border',
                        on ? 'bg-ink text-bg border-ink' : 'border-transparent hover:bg-bg-2 text-ink',
                      )}
                    >
                      <span># {c.id}</span>
                      {unread ? (
                        <span className="min-w-6 px-1 rounded-pill bg-accent text-on-accent text-00 text-center nums">
                          {unread}<span className="sr-only"> unread</span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="grid grid-rows-[auto_minmax(0,1fr)_auto_auto] min-w-0">
            <header className="px-4 py-2 border-b border-rule-soft">
              <h3 className="m-0 font-mono text-0 uppercase tracking-[.08em]"># {channel}</h3>
              {topic ? <p className="m-0 text-0 text-ink-3">{topic}</p> : null}
            </header>

            <div className="relative min-w-0">
              <div
                ref={listRef}
                onScroll={onScroll}
                tabIndex={0}
                role="region"
                aria-label={`Messages in #${channel}`}
                className="h-[min(56vh,440px)] min-h-[280px] overflow-y-auto overscroll-contain px-4 py-3"
              >
                {!chat.loaded ? <Loading label="Restoring history" /> : messages.length === 0 ? (
                  <EmptyState title={`#${channel} is quiet`}>Say something. Every open tab on this page will see it.</EmptyState>
                ) : (
                  <ol className="m-0 p-0 list-none">
                    {messages.map((m, i) => {
                      const prev = messages[i - 1]
                      const grouped = !!prev && prev.author === m.author && m.ts - prev.ts < GROUP_MS
                      return (
                        <MessageItem
                          key={m.id}
                          msg={m}
                          me={me.id}
                          names={names}
                          grouped={grouped}
                          receipt={m.id === lastMine ? receiptFor(m, state, me.id, names) : null}
                          onReact={chat.react}
                        />
                      )
                    })}
                  </ol>
                )}
              </div>
              {newBelow > 0 ? (
                <button
                  type="button"
                  onClick={jump}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 min-h-tap px-4 rounded-pill bg-ink text-bg font-mono text-00 uppercase tracking-[.08em] shadow-press"
                >
                  {newBelow} new below
                </button>
              ) : null}
            </div>

            <p className="m-0 px-4 min-h-6 mono text-ink-3" aria-live="polite">
              {typers.length ? (
                <>
                  {typers.join(', ')} {typers.length === 1 ? 'is' : 'are'} typing
                  <TypingDots still={reduced} />
                </>
              ) : null}
            </p>

            <form onSubmit={submit} className="grid gap-1 p-3 border-t border-rule-soft">
              <div className="flex items-end gap-2">
              <Textarea
                label={`Message #${channel}`}
                hideLabel
                aria-describedby="live-chat-hint"
                wrapperClassName="flex-1"
                rows={1}
                maxLength={MAX_TEXT}
                placeholder={`Message #${channel}`}
                value={draft}
                onChange={(e) => { setDraft(e.target.value); if (e.target.value) chat.notifyTyping(channel) }}
                onKeyDown={onKey}
                className="resize-none max-h-40"
              />
              <Button type="submit" icon="arrow" disabled={!draft.trim()} aria-label="Send message">
                <span className="sr-only xs:not-sr-only">Send</span>
              </Button>
              </div>
              <p id="live-chat-hint" className="m-0 flex justify-between gap-2 mono text-ink-3">
                <span>Enter sends · Shift+Enter adds a line</span>
                <span className="nums">{draft.length}/{MAX_TEXT}</span>
              </p>
            </form>
          </div>
        </section>
      </DemoGrid>
    </div>
  )
}

function MemberRow({ name, note }: { name: string; note: string }) {
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden="true" className="grid place-items-center size-8 border border-rule rounded-1 font-mono text-00">{initials(name)}</span>
      <span className="min-w-0">
        <span className="block font-semibold [overflow-wrap:anywhere]">{name}</span>
        <span className="block mono text-ink-3">{note}</span>
      </span>
      <span className="ml-auto inline-flex items-center gap-1 mono text-ok"><span aria-hidden="true" className="size-2 rounded-pill bg-ok" />online</span>
    </li>
  )
}

function TypingDots({ still }: { still: boolean }) {
  if (still) return <span aria-hidden="true">…</span>
  return (
    <span aria-hidden="true" className="inline-flex gap-[3px] ml-1 align-middle">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-[5px] rounded-pill bg-ink-3 animate-[fade-in_900ms_ease-in-out_infinite_alternate]" style={{ animationDelay: `${i * 180}ms` }} />
      ))}
    </span>
  )
}

