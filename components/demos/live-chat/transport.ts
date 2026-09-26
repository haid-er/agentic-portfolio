/**
 * Cross-tab transport. BroadcastChannel where available; otherwise the `storage` event,
 * which fires in every other tab of the same origin when a localStorage key changes.
 * Neither needs a server, so the chat keeps working offline.
 */
import type { WireEvent } from './protocol'

export type TransportKind = 'broadcast' | 'storage' | 'none'

export interface Transport {
  kind: TransportKind
  post: (e: WireEvent) => void
  close: () => void
}

const NAME = 'ghp:live-chat:wire'

export function openTransport(onEvent: (raw: unknown) => void): Transport {
  if (typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel(NAME)
    bc.onmessage = (ev: MessageEvent) => onEvent(ev.data)
    return { kind: 'broadcast', post: (e) => bc.postMessage(e), close: () => bc.close() }
  }
  try {
    localStorage.setItem(`${NAME}:probe`, '1')
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== NAME || !ev.newValue) return
      try { onEvent((JSON.parse(ev.newValue) as { e: unknown }).e) } catch { /* ignore malformed */ }
    }
    window.addEventListener('storage', onStorage)
    return {
      kind: 'storage',
      // A nonce makes every write a change, so repeated identical events still fire.
      post: (e) => { try { localStorage.setItem(NAME, JSON.stringify({ e, n: Math.random() })) } catch { /* quota */ } },
      close: () => window.removeEventListener('storage', onStorage),
    }
  } catch {
    return { kind: 'none', post: () => {}, close: () => {} }
  }
}
