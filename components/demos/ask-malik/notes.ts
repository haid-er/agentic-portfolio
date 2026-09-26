import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Every visible item on this site (roles, projects, research, skills, services and the playground itself) is cut into small, sentence-bounded chunks in your browser. A question is ranked with BM25 straight away; load the semantic model and MiniLM-L6 embeddings (transformers.js, on device) are fused with BM25 using Reciprocal Rank Fusion. The top six chunks go to the site AI gateway as numbered sources, and the answer streams back with [n] citations that jump to the source they came from. If the gateway is unavailable, you get an extractive answer (the best-matching sentence of each top source, cited), and a small on-device model is offered.',
  limits: [
    'Answers only from this site’s content; anything not on the site gets “not in the sources”.',
    'The semantic model is a ~25 MB one-time download; lexical BM25 works without it.',
    'Server answers use free, rate-limited providers; the on-device fallback model is small and much weaker.',
    'Questions are capped at 300 characters, and only the two previous turns are kept as context.',
  ],
  stack: ['React 19', 'TypeScript', 'BM25 (hand-written)', 'Reciprocal Rank Fusion', 'transformers.js (all-MiniLM-L6-v2)', 'AI gateway SSE streaming (Groq / Gemini)'],
}
