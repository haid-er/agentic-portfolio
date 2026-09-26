'use client'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  BOT, BOT_ID, BOT_LINES, EMPTY, MAX_TEXT, newId, parseEvent, randomMember, reduce,
  type ChannelId, type ChatState, type Member, type Message, type Reaction, type WireEvent,
} from './protocol'
import { openTransport, type Transport, type TransportKind } from './transport'

const STORE_KEY = 'ghp:live-chat:v1'
const HEARTBEAT_MS = 5000
const PEER_TTL_MS = 15000
const TYPING_TTL_MS = 4000
const TYPING_THROTTLE_MS = 2000
const WIRE_CAP = 40

export interface Peer { member: Member; lastSeen: number }
export interface WireLine { n: number; dir: 'in' | 'out'; at: number; text: string }

type Action = WireEvent | { t: 'load'; state: ChatState }

function reducer(s: ChatState, a: Action): ChatState {
  return a.t === 'load' ? a.state : reduce(s, a)
}

function loadState(): ChatState | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as ChatState
    return Array.isArray(s.messages) && s.reads && s.names ? s : null
  } catch {
    return null
  }
}

function describe(e: WireEvent, names: Record<string, string>): string {
  const who = (id: string) => names[id] ?? id.slice(0, 6)
  switch (e.t) {
    case 'hello': return `hello · ${e.from.name} joined`
    case 'presence': return `presence · ${e.from.name}`
    case 'bye': return `bye · ${who(e.from)}`
    case 'msg': return `msg · #${e.msg.channel} · ${e.msg.text.length} chars`
    case 'ack': return `ack · ${who(e.from)} received ${e.ids.length}`
    case 'typing': return `typing · ${who(e.from)} in #${e.channel}`
    case 'react': return `react · ${who(e.from)} ${e.on ? '+' : '−'}"${e.reaction}"`
    case 'read': return `read · ${who(e.from)} up to ${new Date(e.ts).toLocaleTimeString([], { hour12: false })}`
    case 'clear': return `clear · ${who(e.from)} wiped history`
  }
}

const welcome = (): Message => ({
  id: 'welcome-general', channel: 'general', author: BOT_ID, authorName: BOT.name, ink: BOT.ink,
  text: 'Welcome. Messages, typing, reactions and read receipts sync between every tab you open on this page, with no server in between. Say something and I will answer from this tab.',
  ts: Date.now(), deliveredTo: [], reactions: {},
})

export function useChat() {
  const [me, setMe] = useState<Member>(() => randomMember())
  const meRef = useRef(me)
  useEffect(() => { meRef.current = me }, [me])

  const [state, dispatch] = useReducer(reducer, EMPTY)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  const [loaded, setLoaded] = useState(false)
  const [kind, setKind] = useState<TransportKind>('none')
  const [peers, setPeers] = useState<Record<string, Peer>>({})
  const [typing, setTyping] = useState<Record<string, { channel: ChannelId; until: number }>>({})
  const [wire, setWire] = useState<WireLine[]>([])
  const [bot, setBot] = useState(true)
  const botRef = useRef(bot)
  useEffect(() => { botRef.current = bot }, [bot])

  const transport = useRef<Transport | null>(null)
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const wireSeq = useRef(0)
  const lastTypingSent = useRef(0)
  const botTurn = useRef(0)

  const logWire = useCallback((dir: WireLine['dir'], e: WireEvent) => {
    if (e.t === 'presence') return // heartbeats would drown the log
    const line: WireLine = { n: ++wireSeq.current, dir, at: Date.now(), text: describe(e, { ...stateRef.current.names, [meRef.current.id]: meRef.current.name, [BOT_ID]: BOT.name }) }
    setWire((w) => [line, ...w].slice(0, WIRE_CAP))
  }, [])

  const later = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(() => { timers.current.delete(t); fn() }, ms)
    timers.current.add(t)
  }, [])

  /** Apply locally and broadcast. */
  const post = useCallback((e: WireEvent) => {
    if (e.t !== 'hello' && e.t !== 'presence' && e.t !== 'bye' && e.t !== 'typing') dispatch(e)
    transport.current?.post(e)
    logWire('out', e)
  }, [logWire])

  /* ---------- receive ---------- */
  const onRaw = useCallback((raw: unknown) => {
    const e = parseEvent(raw)
    if (!e) return
    logWire('in', e)
    const now = Date.now()
    switch (e.t) {
      case 'hello':
        setPeers((p) => ({ ...p, [e.from.id]: { member: e.from, lastSeen: now } }))
        dispatch(e)
        transport.current?.post({ t: 'presence', from: meRef.current })
        return
      case 'presence':
        setPeers((p) => ({ ...p, [e.from.id]: { member: e.from, lastSeen: now } }))
        dispatch(e)
        return
      case 'bye':
        setPeers((p) => { const n = { ...p }; delete n[e.from]; return n })
        return
      case 'typing':
        setTyping((t) => ({ ...t, [e.from]: { channel: e.channel, until: now + TYPING_TTL_MS } }))
        return
      case 'msg':
        dispatch(e)
        setTyping((t) => { if (!t[e.msg.author]) return t; const n = { ...t }; delete n[e.msg.author]; return n })
        if (e.msg.author !== meRef.current.id) post({ t: 'ack', from: meRef.current.id, ids: [e.msg.id] })
        return
      default:
        dispatch(e)
    }
  }, [logWire, post])

  /* ---------- lifecycle: load, connect, heartbeat ---------- */
  useEffect(() => {
    const saved = loadState()
    dispatch({ t: 'load', state: saved && saved.messages.length ? saved : reduce(saved ?? EMPTY, { t: 'msg', msg: welcome() }) })
    setLoaded(true)
    const tr = openTransport(onRaw)
    transport.current = tr
    setKind(tr.kind)
    tr.post({ t: 'hello', from: meRef.current })

    const beat = setInterval(() => {
      tr.post({ t: 'presence', from: meRef.current })
      const cutoff = Date.now() - PEER_TTL_MS
      setPeers((p) => {
        const alive = Object.entries(p).filter(([, v]) => v.lastSeen >= cutoff)
        return alive.length === Object.keys(p).length ? p : Object.fromEntries(alive)
      })
    }, HEARTBEAT_MS)
    const bye = () => tr.post({ t: 'bye', from: meRef.current.id })
    window.addEventListener('pagehide', bye)
    const pending = timers.current
    return () => {
      bye()
      window.removeEventListener('pagehide', bye)
      clearInterval(beat)
      for (const t of pending) clearTimeout(t)
      pending.clear()
      tr.close()
      transport.current = null
    }
  }, [onRaw])

  // Persist the replicated state. Every tab writes the same converged history.
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)) } catch { /* quota or private mode */ }
    }, 250)
    return () => clearTimeout(t)
  }, [state, loaded])

  // Expire typing indicators.
  const typingCount = Object.keys(typing).length
  useEffect(() => {
    if (!typingCount) return
    const t = setInterval(() => {
      const now = Date.now()
      setTyping((cur) => {
        const alive = Object.entries(cur).filter(([, v]) => v.until > now)
        return alive.length === Object.keys(cur).length ? cur : Object.fromEntries(alive)
      })
    }, 500)
    return () => clearInterval(t)
  }, [typingCount])

  /* ---------- simulated peer ---------- */
  const runBot = useCallback((msg: Message) => {
    const turn = botTurn.current++
    const line = BOT_LINES[turn % BOT_LINES.length]
    later(450, () => post({ t: 'ack', from: BOT_ID, ids: [msg.id] }))
    later(1100, () => post({ t: 'read', from: BOT_ID, channel: msg.channel, ts: msg.ts }))
    if (turn % 3 === 1) later(1300, () => post({ t: 'react', from: BOT_ID, id: msg.id, reaction: '+1', on: true }))
    later(1500, () => {
      setTyping((t) => ({ ...t, [BOT_ID]: { channel: msg.channel, until: Date.now() + TYPING_TTL_MS } }))
      transport.current?.post({ t: 'typing', from: BOT_ID, channel: msg.channel })
    })
    later(1500 + Math.min(2600, 900 + line.length * 18), () => {
      if (!botRef.current) { setTyping((t) => { const n = { ...t }; delete n[BOT_ID]; return n }); return }
      setTyping((t) => { const n = { ...t }; delete n[BOT_ID]; return n })
      post({ t: 'msg', msg: { id: newId(), channel: msg.channel, author: BOT_ID, authorName: BOT.name, ink: BOT.ink, text: line, ts: Date.now(), deliveredTo: [meRef.current.id], reactions: {} } })
    })
  }, [later, post])

  /* ---------- actions ---------- */
  const send = useCallback((channel: ChannelId, text: string) => {
    const body = text.trim().slice(0, MAX_TEXT)
    if (!body) return
    const m = meRef.current
    const msg: Message = { id: newId(), channel, author: m.id, authorName: m.name, ink: m.ink, text: body, ts: Date.now(), deliveredTo: [], reactions: {} }
    post({ t: 'msg', msg })
    post({ t: 'read', from: m.id, channel, ts: msg.ts })
    lastTypingSent.current = 0
    if (botRef.current) runBot(msg)
  }, [post, runBot])

  const react = useCallback((id: string, reaction: Reaction) => {
    const m = stateRef.current.messages.find((x) => x.id === id)
    const on = !(m?.reactions[reaction] ?? []).includes(meRef.current.id)
    post({ t: 'react', from: meRef.current.id, id, reaction, on })
  }, [post])

  const markRead = useCallback((channel: ChannelId) => {
    const s = stateRef.current
    const newest = s.messages.reduce((acc, m) => (m.channel === channel && m.ts > acc ? m.ts : acc), 0)
    if (newest && (s.reads[meRef.current.id]?.[channel] ?? 0) < newest) post({ t: 'read', from: meRef.current.id, channel, ts: newest })
  }, [post])

  const notifyTyping = useCallback((channel: ChannelId) => {
    const now = Date.now()
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return
    lastTypingSent.current = now
    const e: WireEvent = { t: 'typing', from: meRef.current.id, channel }
    transport.current?.post(e)
    logWire('out', e)
  }, [logWire])

  const rename = useCallback((name: string) => {
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 24)
    if (!clean) return
    const next = { ...meRef.current, name: clean }
    meRef.current = next
    setMe(next)
    post({ t: 'presence', from: next })
    dispatch({ t: 'presence', from: next })
  }, [post])

  const clear = useCallback(() => post({ t: 'clear', from: meRef.current.id }), [post])

  return { me, state, loaded, kind, peers, typing, wire, bot, setBot, send, react, markRead, notifyTyping, rename, clear }
}
