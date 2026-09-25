import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Twenty-one provisions of the U.S. Constitution (public domain) are split at semicolons into clause-sized chunks and indexed in your browser. A question is first expanded from everyday words into the text’s own vocabulary (“lawyer” → “counsel”), then ranked with BM25; turn on semantic search and all-MiniLM-L6-v2 cosine scores are fused with BM25 by Reciprocal Rank Fusion. The top chunks are numbered and sent through the site AI gateway with a prompt that allows only those sources, and the streamed answer is checked for a citation on every sentence and for citations to sources that were never sent. If the gateway is unavailable you get an extractive answer (the best clause of each source, quoted exactly), and a small on-device model is offered.',
  limits: [
    'Not legal advice: the corpus is historical constitutional text only, with no case law, statutes or later interpretation.',
    'Headings on each provision are plain-language labels added for this demo, not part of the text.',
    'Server answers use free, rate-limited providers; the on-device fallback model is small and much weaker.',
    'The semantic model is a one-time ~25 MB download; BM25 with query expansion works without it.',
  ],
  stack: ['React 19', 'TypeScript', 'BM25 (hand-written)', 'Query expansion', 'Reciprocal Rank Fusion', 'transformers.js (all-MiniLM-L6-v2)', 'AI gateway SSE streaming (Groq / Gemini)'],
}
