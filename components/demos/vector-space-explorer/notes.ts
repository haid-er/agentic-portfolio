import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Twenty-four sentences from four unrelated topics are turned into vectors in your browser, first with an instant offline hash embedder, then (opt-in) with all-MiniLM-L6-v2 running through transformers.js. The vectors are projected to two dimensions with PCA (power iteration), so you can watch clusters regroup by meaning when the semantic model takes over. A query is embedded the same way and ranked by exact cosine similarity, with topK and a metadata filter shaped like a Pinecone query. The chunking lab cuts one document four ways (fixed, overlapping, sentence and paragraph), embeds every chunk, and checks whether the top-scoring chunk still holds the answer in one piece.',
  limits: [
    'The semantic model is a one-time ~25 MB download; the hash embedder works offline but only matches spelling.',
    'The 2-D map is a lossy projection of 256 or 384 dimensions: the scores are the truth, the picture is a guide.',
    'Search is exact brute force over a few dozen vectors; a managed vector index uses approximate search to scale to millions.',
    'Nothing is sent to a server. Your own sentences (up to 8) stay in this browser.',
  ],
  stack: ['React 19', 'TypeScript', 'transformers.js (all-MiniLM-L6-v2)', 'Feature hashing', 'PCA via power iteration', 'SVG'],
}
