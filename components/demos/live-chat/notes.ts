import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Each open tab on this page is a chat client, and BroadcastChannel is the server. Sending a message, typing, reacting or reading a channel becomes a small event that every other tab receives and feeds through the same reducer, so all tabs converge on one history. Receiving tabs send a delivery ack, and the tab that has a channel on screen sends a read receipt, which is how "Delivered" turns into "Read by…". Presence is a heartbeat every 5 seconds; a tab that stops beating for 15 seconds drops off the list. A simulated peer answers from your own tab, so the whole loop is visible even with one tab open.',
  limits: [
    'Everything stays inside this browser: tabs on other devices or other browsers cannot join, and nothing is sent to a server.',
    'History is kept in localStorage (the newest 300 messages) and is shared by all tabs of this site in this browser.',
    'The simulated peer replies with canned lines that describe the protocol; it is not an AI and does not read your message.',
    'Where BroadcastChannel is missing, storage events are used instead, which are slower but work the same way.',
  ],
  stack: ['BroadcastChannel', 'storage events (fallback)', 'React 19 useReducer', 'localStorage', 'TypeScript'],
}
