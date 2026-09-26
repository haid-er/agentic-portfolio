/**
 * The chat's wire protocol and replicated state. Every tab runs the same reducer over the same
 * events (received over BroadcastChannel), so every tab converges on the same history.
 * Presence and typing are ephemeral and live outside the reducer.
 */

export const CHANNELS = [
  { id: 'general', topic: 'Anything and everything' },
  { id: 'build', topic: 'Deploys, reviews and bugs' },
  { id: 'field-notes', topic: 'Links, reads and small wins' },
] as const
export type ChannelId = (typeof CHANNELS)[number]['id']

export const REACTIONS = ['+1', 'ack', 'ship it', '?'] as const
export type Reaction = (typeof REACTIONS)[number]

export const MAX_TEXT = 500
export const MAX_MESSAGES = 300
export const BOT_ID = 'relay-bot'

export interface Member { id: string; name: string; ink: 1 | 2 | 3 | 4 }

export interface Message {
  id: string
  channel: ChannelId
  author: string
  authorName: string
  ink: Member['ink']
  text: string
  ts: number
  deliveredTo: string[]
  reactions: Partial<Record<Reaction, string[]>>
}

export interface ChatState {
  messages: Message[]
  /** memberId -> channel -> timestamp of the newest message they have read. */
  reads: Record<string, Partial<Record<ChannelId, number>>>
  names: Record<string, string>
}

export type WireEvent =
  | { t: 'hello'; from: Member }
  | { t: 'presence'; from: Member }
  | { t: 'bye'; from: string }
  | { t: 'msg'; msg: Message }
  | { t: 'ack'; from: string; ids: string[] }
  | { t: 'typing'; from: string; channel: ChannelId }
  | { t: 'react'; from: string; id: string; reaction: Reaction; on: boolean }
  | { t: 'read'; from: string; channel: ChannelId; ts: number }
  | { t: 'clear'; from: string }

export const EMPTY: ChatState = { messages: [], reads: {}, names: {} }

const isChannel = (c: unknown): c is ChannelId => CHANNELS.some((x) => x.id === c)
const isReaction = (r: unknown): r is Reaction => (REACTIONS as readonly unknown[]).includes(r)

/** Defensive parse: another tab (or stale storage) could send anything. */
export function parseEvent(raw: unknown): WireEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  switch (e.t) {
    case 'hello':
    case 'presence': {
      const m = e.from as Member | undefined
      return m && typeof m.id === 'string' && typeof m.name === 'string' ? (e as WireEvent) : null
    }
    case 'bye':
    case 'clear':
      return typeof e.from === 'string' ? (e as WireEvent) : null
    case 'msg': {
      const m = e.msg as Message | undefined
      return m && typeof m.id === 'string' && typeof m.text === 'string' && m.text.length <= MAX_TEXT && isChannel(m.channel) ? (e as WireEvent) : null
    }
    case 'ack':
      return typeof e.from === 'string' && Array.isArray(e.ids) ? (e as WireEvent) : null
    case 'typing':
      return typeof e.from === 'string' && isChannel(e.channel) ? (e as WireEvent) : null
    case 'react':
      return typeof e.from === 'string' && typeof e.id === 'string' && isReaction(e.reaction) ? (e as WireEvent) : null
    case 'read':
      return typeof e.from === 'string' && isChannel(e.channel) && typeof e.ts === 'number' ? (e as WireEvent) : null
    default:
      return null
  }
}

const byTime = (a: Message, b: Message) => a.ts - b.ts || (a.id < b.id ? -1 : 1)

export function reduce(state: ChatState, e: WireEvent): ChatState {
  switch (e.t) {
    case 'hello':
    case 'presence':
      return state.names[e.from.id] === e.from.name ? state : { ...state, names: { ...state.names, [e.from.id]: e.from.name } }
    case 'msg': {
      if (state.messages.some((m) => m.id === e.msg.id)) return state
      const messages = [...state.messages, e.msg].sort(byTime).slice(-MAX_MESSAGES)
      return { ...state, messages, names: { ...state.names, [e.msg.author]: e.msg.authorName } }
    }
    case 'ack': {
      const ids = new Set(e.ids)
      let changed = false
      const messages = state.messages.map((m) => {
        if (!ids.has(m.id) || m.author === e.from || m.deliveredTo.includes(e.from)) return m
        changed = true
        return { ...m, deliveredTo: [...m.deliveredTo, e.from] }
      })
      return changed ? { ...state, messages } : state
    }
    case 'react': {
      const messages = state.messages.map((m) => {
        if (m.id !== e.id) return m
        const who = new Set(m.reactions[e.reaction] ?? [])
        if (e.on) who.add(e.from)
        else who.delete(e.from)
        return { ...m, reactions: { ...m.reactions, [e.reaction]: [...who] } }
      })
      return { ...state, messages }
    }
    case 'read': {
      const mine = state.reads[e.from] ?? {}
      if ((mine[e.channel] ?? 0) >= e.ts) return state
      return { ...state, reads: { ...state.reads, [e.from]: { ...mine, [e.channel]: e.ts } } }
    }
    case 'clear':
      return EMPTY
    default:
      return state
  }
}

/** Nicknames are soil and rock words: never real people. */
const NAMES = ['Loam', 'Shale', 'Basalt', 'Ochre', 'Lichen', 'Chalk', 'Flint', 'Marl', 'Silt', 'Tuff', 'Gneiss', 'Clay']

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function randomMember(): Member {
  const n = Math.floor(Math.random() * NAMES.length)
  return { id: newId(), name: NAMES[n], ink: ((n % 4) + 1) as Member['ink'] }
}

export const BOT: Member = { id: BOT_ID, name: 'Relay bot', ink: 2 }

/** Canned lines for the simulated peer. They describe what the demo just did, honestly. */
export const BOT_LINES = [
  'Got it. My tab sent a delivery ack, then a read receipt, before I started typing.',
  'That arrived over BroadcastChannel. No server saw it: it never left your browser.',
  'Open this page in a second tab and you can talk to yourself in real time.',
  'Try reacting to this message. Reactions are events too, and every tab applies them.',
  'Typing indicators are throttled: one event every couple of seconds, expiring after four.',
  'History is saved to localStorage, so a new tab catches up before it says hello.',
]

export function unreadCount(state: ChatState, me: string, channel: ChannelId): number {
  const seen = state.reads[me]?.[channel] ?? 0
  return state.messages.filter((m) => m.channel === channel && m.author !== me && m.ts > seen).length
}
