/**
 * Demo registry: metadata for every playground demo (server + client safe).
 *
 * - Component loaders live in `lib/demos/loaders.tsx` (client, next/dynamic).
 * - "How it works" notes live in `components/demos/<slug>/notes.ts` and are
 *   collected in `lib/demos/notes.ts` (server safe).
 * - Admin can hide a demo or override title/summary/mirrors via content/playground.json;
 *   use `getDemos()` from `lib/demos/index.ts` for the merged, visible list.
 */
import type { Pillar } from '@/lib/content/schema'
import { DEMO_SLUGS, type DemoSlug } from './slugs'

export { DEMO_SLUGS, isDemoSlug } from './slugs'
export type { DemoSlug }

/** One glyph per category (DESIGN.md 7). Ids are symbols in components/ui/Icon.tsx. */
export type GlyphId =
  | 'pulse' | 'sine' | 'square' | 'saw' | 'flat'
  | 'leaf' | 'broadsheet' | 'nodes' | 'strata' | 'core' | 'register'

export const PILLAR_GLYPH: Record<Pillar, GlyphId> = {
  ai: 'nodes',
  realtime: 'square',
  esg: 'leaf',
  fullstack: 'strata',
  fundamentals: 'saw',
  craft: 'broadsheet',
}

/** Module keys = builder ownership (CONTRACTS.md). */
export type DemoModule =
  | 'demos-ai-docs' | 'demos-ai-agents' | 'demos-ai-rag' | 'demos-sensors-ml'
  | 'demos-realtime' | 'demos-backend' | 'demos-esg-climate' | 'demos-product'
  | 'demos-realtime-chat' | 'demos-cs' | 'demos-craft' | 'demos-automation'

export interface DemoMeta {
  slug: DemoSlug
  title: string
  /** One-line what-it-does. */
  summary: string
  pillar: Pillar
  /** Skills this demo proves (free text; skills.json maps skills -> slugs). */
  skills: string[]
  module: DemoModule
  /** The real work it mirrors (short, factual, from docs/context). */
  mirrors: string
  /** Where the work happens (kicker line on the specimen card). */
  runsIn: 'browser' | 'edge' | 'server' | 'browser + ai'
  /** Honest phone note (DESIGN.md 10). */
  mobile: { ok: true } | { ok: false; reason: string }
  /** Uses the AI gateway (lib/ai). */
  usesAI: boolean
  /** Waveform / category glyph shown on the card. Defaults to PILLAR_GLYPH[pillar]. */
  glyph?: GlyphId
}

const phoneOk = { ok: true } as const
const desktop = (reason: string) => ({ ok: false, reason }) as const

export const DEMOS: readonly DemoMeta[] = [
  /* ---------------- demos-ai-docs ---------------- */
  {
    slug: 'org-chart-extractor', title: 'Org-chart extractor', module: 'demos-ai-docs', pillar: 'ai',
    summary: 'Upload an org-chart image or PDF; a vision model returns an editable tree and table you can export as JSON.',
    skills: ['Vision LLM extraction', 'Document extraction', 'React'],
    mirrors: 'Structure Fetcher: org-chart hierarchies from images and PDFs as JSON.',
    runsIn: 'browser + ai', mobile: phoneOk, usesAI: true,
  },
  {
    slug: 'esg-gap-checker', title: 'ESG disclosure gap checker', module: 'demos-ai-docs', pillar: 'esg',
    summary: 'Paste a sustainability-report excerpt and get a structured gap analysis against ISSB, TCFD and CSRD checklists.',
    skills: ['ESG disclosure gap analysis', 'LLM structured output', 'Zod'],
    mirrors: 'Disclosure gap analysis in the Euthyna sustainability-reporting platform.',
    runsIn: 'browser + ai', mobile: phoneOk, usesAI: true, glyph: 'leaf',
  },
  {
    slug: 'ownership-extractor', title: 'Ownership extractor', module: 'demos-ai-docs', pillar: 'esg',
    summary: 'Describe a corporate group in text; get an entity ownership graph and equity-share vs control consolidation.',
    skills: ['Corporate-entity extraction', 'GHG boundary-setting'],
    mirrors: 'Ownership extraction and boundary-setting for GHG consolidation at Euthyna.',
    runsIn: 'browser + ai', mobile: phoneOk, usesAI: true,
  },

  /* ---------------- demos-ai-agents ---------------- */
  {
    slug: 'ask-malik', title: 'Ask the portfolio', module: 'demos-ai-agents', pillar: 'ai',
    summary: 'RAG chat over this site: in-browser embeddings plus BM25, streamed answers with citations to sections.',
    skills: ['RAG', 'Vector search', 'LLM integration'],
    mirrors: 'RAG and vector-search services built with OpenAI and Pinecone.',
    runsIn: 'browser + ai', mobile: phoneOk, usesAI: true,
  },
  {
    slug: 'agent-orchestra', title: 'Agent orchestra', module: 'demos-ai-agents', pillar: 'ai',
    summary: 'A planner fans a goal out to parallel workers and a reviewer, with a live span tree, retries and timeouts.',
    skills: ['Multi-agent orchestration', 'Retries and timeouts', 'Trace spans'],
    mirrors: 'Multi-agent Claude Code pipelines and an agent-hierarchy design (Temporal, Agent SDK, MCP, Langfuse).',
    runsIn: 'browser + ai', mobile: phoneOk, usesAI: true,
  },
  {
    slug: 'mcp-tool-lab', title: 'MCP tool lab', module: 'demos-ai-agents', pillar: 'ai',
    summary: 'Define JSON-schema tools, let a model choose and call them, and read the MCP-style request/response log.',
    skills: ['MCP', 'Tool calling', 'Function schemas'],
    mirrors: 'MCP server and client work in TypeScript.',
    runsIn: 'browser + ai', mobile: phoneOk, usesAI: true,
  },

  /* ---------------- demos-ai-rag ---------------- */
  {
    slug: 'vector-space-explorer', title: 'Vector space explorer', module: 'demos-ai-rag', pillar: 'ai',
    summary: 'Embed sentences in the browser, see them in 2D, run cosine top-k search and compare chunking strategies.',
    skills: ['Embeddings', 'Semantic search', 'Vector search'],
    mirrors: 'Pinecone-backed retrieval in RAG services.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'legal-rag-assistant', title: 'Legal RAG assistant', module: 'demos-ai-rag', pillar: 'ai',
    summary: 'Ask a question over a small public-domain legal corpus: retrieve, cite, answer, with chunk scores shown.',
    skills: ['RAG', 'Hybrid retrieval', 'Citations'],
    mirrors: 'AI Lawyer, a legal Q&A assistant on OpenAI + Pinecone.',
    runsIn: 'browser + ai', mobile: phoneOk, usesAI: true,
  },
  {
    slug: 'prompt-cost-lab', title: 'Prompt cost lab', module: 'demos-ai-rag', pillar: 'ai',
    summary: 'Count tokens, estimate per-model cost, and see what caching, batching and a model router save.',
    skills: ['LLM cost engineering', 'Token counting', 'Model routing'],
    mirrors: 'LLM-driven ESG estimation pipelines at Euthyna.',
    runsIn: 'browser + ai', mobile: phoneOk, usesAI: true,
  },

  /* ---------------- demos-sensors-ml ---------------- */
  {
    slug: 'har-live', title: 'HAR live', module: 'demos-sensors-ml', pillar: 'realtime',
    summary: 'Your phone’s motion sensors, charted live, cut into 5-second windows and classified in the browser.',
    skills: ['Human activity recognition', 'CNN-LSTM', 'TensorFlow', 'Sensor ML'],
    mirrors: 'HumCareADL research on wearable-sensor activity recognition.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false, glyph: 'pulse',
  },
  {
    slug: 'sensor-pipeline', title: 'Sensor pipeline', module: 'demos-sensors-ml', pillar: 'realtime',
    summary: 'Step through an 8-step IMU preprocessing pipeline: standardise, atomic windows, gravity, fall segmentation.',
    skills: ['Sensor-data preprocessing', 'Windowing and segmentation'],
    mirrors: 'MotionIQ preprocessing scripts.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false, glyph: 'sine',
  },
  {
    slug: 'neural-playground', title: 'Neural playground', module: 'demos-sensors-ml', pillar: 'ai',
    summary: 'Draw points, train a tiny neural net in the browser, and watch the loss curve and decision boundary.',
    skills: ['Machine learning', 'Backpropagation'],
    mirrors: 'Supervised ML coursework (Stanford / DeepLearning.AI) and HAR model training.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },

  /* ---------------- demos-realtime ---------------- */
  {
    slug: 'rabbitmq-sim', title: 'RabbitMQ broker sim', module: 'demos-realtime', pillar: 'realtime',
    summary: 'Producers, direct/topic/fanout exchanges, queues, consumers, acks, prefetch and a dead-letter queue.',
    skills: ['Message queues', 'RabbitMQ concepts', 'IoT streaming'],
    mirrors: 'MotionIQ: phone sensors streamed over Wi-Fi to RabbitMQ with a Java consumer.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false, glyph: 'square',
  },
  {
    slug: 'bullmq-jobs', title: 'BullMQ job queue', module: 'demos-realtime', pillar: 'realtime',
    summary: 'Concurrency, retries with exponential backoff, delayed and repeatable jobs, and failure injection.',
    skills: ['Background jobs', 'BullMQ concepts', 'Retries and backoff'],
    mirrors: 'Background processing and workflow orchestration at Euthyna.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false, glyph: 'saw',
  },
  {
    slug: 'live-telemetry', title: 'Live telemetry', module: 'demos-realtime', pillar: 'realtime',
    summary: 'Server-Sent Events from an edge route stream simulated sensor metrics into SVG charts with thresholds.',
    skills: ['Real-time systems', 'Server-Sent Events', 'Edge streaming'],
    mirrors: 'Real-time sensor streaming and tracking.',
    runsIn: 'edge', mobile: phoneOk, usesAI: false, glyph: 'pulse',
  },

  /* ---------------- demos-backend ---------------- */
  {
    slug: 'layered-api-lab', title: 'Layered API lab', module: 'demos-backend', pillar: 'fullstack',
    summary: 'Call real routes and trace route → controller → service → repository, Zod errors and log lines.',
    skills: ['Layered API architecture', 'Zod', 'REST APIs', 'Logging'],
    mirrors: 'Org backend standards: routes → controller → service → repository, Zod, Winston logging.',
    runsIn: 'server', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'rbac-audit-lab', title: 'RBAC + audit lab', module: 'demos-backend', pillar: 'fullstack',
    summary: 'Build CASL-style rules, ask “can X do Y on Z?”, and roll back a transaction in the audit timeline.',
    skills: ['RBAC', 'CASL-style abilities', 'Audit logging'],
    mirrors: 'RBAC and transactional audit logging in the Euthyna platform.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'rate-limiter', title: 'Rate limiter', module: 'demos-backend', pillar: 'fullstack',
    summary: 'Token bucket vs sliding window, side by side, plus a live edge endpoint that returns 429 with headers.',
    skills: ['API design', 'Edge functions'],
    mirrors: 'The per-IP limits guarding this site’s own AI routes.',
    runsIn: 'edge', mobile: phoneOk, usesAI: false,
  },

  /* ---------------- demos-esg-climate ---------------- */
  {
    slug: 'ghg-calculator', title: 'GHG calculator', module: 'demos-esg-climate', pillar: 'esg',
    summary: 'Scope 1, 2 and 3 with emission factors, operational vs financial control, a stacked breakdown and CSV.',
    skills: ['GHG Protocol', 'ESG domain', 'Data modelling'],
    mirrors: 'GHG calculations and boundary-setting at Euthyna.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'grid-carbon-live', title: 'Grid carbon live', module: 'demos-esg-climate', pillar: 'esg',
    summary: 'UK grid carbon intensity now, a 48-hour forecast and generation mix, with a best-time-to-run hint.',
    skills: ['External API integration', 'Decarbonisation'],
    mirrors: 'Terra Real Estate decarbonisation work.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'solar-pv-estimator', title: 'Solar PV estimator', module: 'demos-esg-climate', pillar: 'esg',
    summary: 'Pick a location, size the array, and get a PVGIS yearly yield and CO₂ avoided via a server proxy.',
    skills: ['Solar PV', 'Real-estate decarbonisation', 'API proxying'],
    mirrors: 'Real-estate decarbonisation and asset intelligence at Terra Instinct.',
    runsIn: 'server', mobile: phoneOk, usesAI: false,
  },

  /* ---------------- demos-product ---------------- */
  {
    slug: 'stripe-connect-flow', title: 'Stripe Connect flow', module: 'demos-product', pillar: 'fullstack',
    summary: 'A simulated marketplace: creator onboarding, subscriptions, platform fee split and idempotent webhooks.',
    skills: ['Marketplace payments', 'Subscriptions', 'Idempotent webhooks'],
    mirrors: 'VoodVR creator payments, subscriptions and webhook billing (Webox Systems).',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'web-perf-lab', title: 'Web perf lab', module: 'demos-product', pillar: 'fullstack',
    summary: 'Toggle code splitting, lazy loading, compression and request dedupe; watch the waterfall shrink.',
    skills: ['Web performance', 'Code splitting', 'Compression'],
    mirrors: 'Kickstart HQ at Piron Labs: response time 27s → 3.5s.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'dispatch-board', title: 'Dispatch board', module: 'demos-product', pillar: 'fullstack',
    summary: 'Technicians, jobs with time windows, greedy vs optimised assignment on a map, and an invoice preview.',
    skills: ['Scheduling', 'Product engineering', 'Algorithms'],
    mirrors: 'Kickstart HQ field-service scheduling, dispatching and invoicing.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },

  /* ---------------- demos-realtime-chat ---------------- */
  {
    slug: 'live-chat', title: 'Live chat', module: 'demos-realtime-chat', pillar: 'realtime',
    summary: 'Channels, typing indicators, reactions and read receipts, synced across your open tabs.',
    skills: ['Real-time chat integration', 'React state'],
    mirrors: 'VoodVR real-time chat on Stream Chat.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'kanban-board', title: 'Kanban board', module: 'demos-realtime-chat', pillar: 'fullstack',
    summary: 'Private per-browser boards with pointer and keyboard drag and drop, plus export and import.',
    skills: ['React', 'Data isolation', 'UX'],
    mirrors: 'Task-Vault: private per-user task storage.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'data-grid', title: 'Query cache lab', module: 'demos-realtime-chat', pillar: 'fullstack',
    summary: 'Stale and fresh timers, refetch on focus, optimistic updates and pagination against a demo API.',
    skills: ['Query caching', 'Data fetching', 'React'],
    mirrors: 'React Query conventions in the multi-workspace enterprise frontend.',
    runsIn: 'server', mobile: phoneOk, usesAI: false,
  },

  /* ---------------- demos-cs ---------------- */
  {
    slug: 'algo-visualizer', title: 'Algorithm visualiser', module: 'demos-cs', pillar: 'fundamentals',
    summary: 'A*, Dijkstra and BFS on a grid, plus four sorting algorithms, with step, play and counters.',
    skills: ['Data structures & algorithms', 'Pathfinding'],
    mirrors: 'BS Information Technology at PUCIT.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'code-judge', title: 'Code judge', module: 'demos-cs', pillar: 'fundamentals',
    summary: 'Solve small problems in JavaScript in a sandboxed worker with hidden tests and AC/WA/TLE verdicts.',
    skills: ['Algorithm complexity', 'Sandboxed execution'],
    mirrors: 'First repos: C and C++ fundamentals.',
    runsIn: 'browser', mobile: desktop('writing code is easier with a keyboard'), usesAI: false,
  },
  {
    slug: 'sql-playground', title: 'SQL playground', module: 'demos-cs', pillar: 'fundamentals',
    summary: 'SQLite compiled to WebAssembly, a schema viewer and LeetCode-style challenges with a checker.',
    skills: ['SQL', 'SQLite in WebAssembly', 'Query design'],
    mirrors: 'SQL-Learning: LeetCode SQL solutions; PostgreSQL + Drizzle at work.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },

  /* ---------------- demos-craft ---------------- */
  {
    slug: 'design-studio', title: 'Poster press', module: 'demos-craft', pillar: 'craft',
    summary: 'A seeded generative poster maker: grid, type and shapes, exported as PNG or SVG.',
    skills: ['Graphic design', 'Canvas', 'SVG'],
    mirrors: 'Graphic design, and the Best Graphic Designer credit at PUCIT.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'theme-lab', title: 'Theme lab', module: 'demos-craft', pillar: 'craft',
    summary: 'Edit this site’s design tokens live with WCAG contrast checks, then copy the CSS.',
    skills: ['Design systems', 'Design tokens', 'Accessibility'],
    mirrors: 'This site’s two printed worlds.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'cricket-sim', title: 'Cricket sim', module: 'demos-craft', pillar: 'fundamentals',
    summary: 'Playable browser cricket with ball-by-ball commentary, a scorecard and an optional terminal mode.',
    skills: ['Game logic', 'Seeded simulation'],
    mirrors: 'Cricket-Game-C-Language, a cricket simulation in pure C.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },

  /* ---------------- demos-automation ---------------- */
  {
    slug: 'automation-recorder', title: 'Automation recorder', module: 'demos-automation', pillar: 'fullstack',
    summary: 'Record clicks and typing on a sandboxed mock listing form, replay them, and export a Puppeteer script.',
    skills: ['Browser automation', 'Puppeteer scripts'],
    mirrors: 'fb-automation, a Puppeteer bot that creates marketplace listings.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'ci-pipeline', title: 'CI/CD pipeline', module: 'demos-automation', pillar: 'fullstack',
    summary: 'Lint, test, build, Docker and deploy stages with parallel jobs, failures, retries and cache hits.',
    skills: ['CI/CD concepts', 'DAG scheduling', 'GitHub Actions YAML'],
    mirrors: 'AWS and Vercel production delivery.',
    runsIn: 'browser', mobile: phoneOk, usesAI: false,
  },
  {
    slug: 'system-design-canvas', title: 'System design canvas', module: 'demos-automation', pillar: 'fullstack',
    summary: 'Wire a load balancer, APIs, a queue, cache, database and workers, then push load and find the bottleneck.',
    skills: ['System design', 'Scalability', 'Capacity modelling'],
    mirrors: 'Backend and platform architecture for enterprise SaaS.',
    runsIn: 'browser', mobile: desktop('the canvas needs room to drag components'), usesAI: false, glyph: 'nodes',
  },
]

const BY_SLUG = new Map(DEMOS.map((d) => [d.slug, d]))

export function getDemoMeta(slug: string): DemoMeta | undefined {
  return BY_SLUG.get(slug as DemoSlug)
}

export function demoGlyph(d: DemoMeta): GlyphId {
  return d.glyph ?? PILLAR_GLYPH[d.pillar]
}

// Compile-time + module-load guarantee that the registry covers every slug exactly once.
if (DEMOS.length !== DEMO_SLUGS.length || DEMO_SLUGS.some((s) => !BY_SLUG.has(s))) {
  throw new Error('lib/demos/registry.ts: DEMOS must list every slug in DEMO_SLUGS exactly once')
}
