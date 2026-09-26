import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Your code is compiled with new Function inside a fresh dedicated Web Worker, after the worker has removed fetch, XMLHttpRequest, WebSocket, importScripts, storage and nested workers from its global scope. The page then sends the tests: visible samples first, then hidden ones generated from a fixed seed, including inputs large enough that a quadratic solution cannot finish in time. The worker times each call with performance.now(); a result over the limit is TLE, a thrown error is RE, and a wrong value is WA, checked against a reference solution (or a custom checker when several answers are valid). If a test hangs, a watchdog on the main thread terminates the worker, so an infinite loop never freezes the page.',
  limits: [
    'Hidden tests are hidden from the interface, not secret: they are generated in your browser, so a determined reader can find them.',
    'Timing is wall-clock on your device, so a slow phone can be stricter than a desktop; limits are set with that margin in mind.',
    'Memory is not limited beyond what the browser allows a worker.',
    'Solutions are written in JavaScript; the editorials show how the same idea is usually written in C++.',
    'Drafts and solved problems are kept in this browser only (localStorage).',
  ],
  stack: ['Web Workers', 'TypeScript', 'React 19', 'performance.now()', 'Seeded test generation'],
}
