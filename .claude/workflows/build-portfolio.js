export const meta = {
  name: 'build-portfolio',
  description: 'Agent team that designs, builds, verifies and deploys the admin-configurable, zero-cost portfolio (~80 agents)',
  whenToUse: 'Build or rebuild the portfolio end to end. Reads docs/BRIEF.md and docs/context/. args: {deploy?: boolean}',
  phases: [
    { title: 'Design', detail: '3 independent design concepts + judge' },
    { title: 'Foundation', detail: 'architect scaffolds app, schema, design system, stubs' },
    { title: 'Content', detail: 'seed content/*.json from docs/context with provenance' },
    { title: 'Build', detail: 'one builder per module, disjoint file ownership' },
    { title: 'Review', detail: 'one reviewer per module' },
    { title: 'Fix', detail: 'fixers for blocking findings' },
    { title: 'Integrate', detail: 'typecheck, lint, build, Playwright smoke; loop until green' },
    { title: 'Critique', detail: 'coverage + product critic, then final integration' },
    { title: 'Deploy', detail: 'Vercel deploy + live smoke test' },
  ],
}

// ---------------------------------------------------------------------------
// Shared context — details live in docs/BRIEF.md so prompts stay short
// ---------------------------------------------------------------------------
const CONTEXT = `Read docs/BRIEF.md first (product, content policy, design constraints, AI policy, admin, delivery).
Facts about Malik come ONLY from docs/context/ (research-findings.md wins on conflicts). Never invent facts or metrics.`

const STACK = `STACK: next@15 App Router + TypeScript strict, react@19, tailwindcss@4, zod, lucide-react, @vercel/analytics.
Allowed extras only where a demo needs them: sql.js, @huggingface/transformers, @tensorflow/tfjs, pdfjs-dist. No DB, no paid services, no UI/animation/chart libraries.`

const RULES = `TEAM RULES:
- Read CONTRACTS.md and DESIGN.md first; they are binding (types, content schema, tokens, shared components, AI gateway API).
- Edit ONLY your owned paths. Anything needed elsewhere goes in your output "requests".
- Never git commit/push, npm install, or run next build/dev (the working tree is shared).
  You MAY run: npx tsc --noEmit -p . and npx eslint <your files>; fix errors in files you own only.
- Simple, readable code: small components, server components by default, "use client" only for interaction.
- All user-facing text comes from content (lib/content getters) or the demo registry — nothing hard-coded about Malik.
- Mobile-first (360px), keyboard accessible, prefers-reduced-motion respected, both themes correct.`

// ---------------------------------------------------------------------------
// Modules. Demo modules own components/demos/<slug>/** (+ listed API routes).
// `skills` = keywords the demos prove; the coverage critic checks every skill maps to a demo.
// ---------------------------------------------------------------------------
const SITE_MODULES = [
  { key: 'shell', title: 'Layout shell & navigation', paths: ['components/layout/**', 'app/not-found.tsx', 'app/error.tsx'],
    brief: 'Header with responsive nav + mobile menu, footer with socials, theme toggle (no flash), skip-link, scroll-spy, command palette (Ctrl/Cmd+K) to jump to sections and demos. Nav derives from enabled sections.' },
  { key: 'hero-about', title: 'Hero, About & live GitHub activity', paths: ['components/sections/Hero.tsx', 'components/sections/About.tsx', 'components/sections/GitHubActivity.tsx', 'app/api/github/**'],
    brief: 'Signature hero per DESIGN.md (the one memorable moment of the site). About with bio, pillars, motto, languages. GitHub activity widget via public REST API for haid-er, cached with ISR (revalidate 6h), graceful fallback.' },
  { key: 'skills-experience', title: 'Skills & Experience', paths: ['components/sections/Skills.tsx', 'components/sections/Experience.tsx'],
    brief: 'Skills grouped by pillar; every skill chip links to the playground demos that prove it. Experience timeline (Euthyna, Piron Labs, Webox) with highlights; each highlight can link a proof demo (content field proofDemo).' },
  { key: 'projects', title: 'Projects & detail pages', paths: ['components/sections/Projects.tsx', 'app/projects/**'],
    brief: 'Filterable project grid (tag/pillar), cards with live/repo/demo links (repo link hidden when private). /projects/[slug] static pages with story, stack, outcome, related demos, generateMetadata.' },
  { key: 'credentials', title: 'Research, education, certifications, achievements', paths: ['components/sections/Research.tsx', 'components/sections/Education.tsx', 'components/sections/Certifications.tsx', 'components/sections/Achievements.tsx'],
    brief: 'HumCareADL paper feature (authors with Malik highlighted, results, DOI, BibTeX copy, link to HAR demo). Education, certifications with verify links, achievements. Disabled items never render.' },
  { key: 'services-testimonials', title: 'Services & Testimonials', paths: ['components/sections/Services.tsx', 'components/sections/Testimonials.tsx'],
    brief: 'Services cards (lucide icon name from content). Accessible testimonials carousel (keyboard, pause, reduced motion); whole section hidden when no enabled testimonials.' },
  { key: 'resume-contact', title: 'Resume & Contact', paths: ['components/sections/Resume.tsx', 'components/sections/Contact.tsx', 'app/resume/**'],
    brief: 'Resume section + /resume print-optimised page generated from content (print CSS) with "Download PDF" (uploaded PDF if set, else window.print). Contact: links + form posting to a free endpoint set in admin (Web3Forms/Formspree) with mailto fallback.' },
  { key: 'seo-theme', title: 'SEO, theming & analytics', paths: ['app/sitemap.ts', 'app/robots.ts', 'app/opengraph-image.tsx', 'app/manifest.ts', 'lib/seo/**', 'lib/theme/**'],
    brief: 'Metadata helpers from content, Person + ScholarlyArticle JSON-LD with sameAs, dynamic OG image in the site style, sitemap incl. projects + demos, robots, manifest. Admin theme tokens -> CSS variables in root layout. Analytics toggle.' },
  { key: 'admin-core', title: 'Admin core (auth, save pipeline, shell)', paths: ['app/admin/login/**', 'app/admin/layout.tsx', 'app/admin/page.tsx', 'app/api/admin/**', 'lib/admin/**', 'middleware.ts'],
    brief: 'Password login (ADMIN_PASSWORD) -> HMAC-signed httpOnly cookie (ADMIN_SECRET, Web Crypto), login rate limit, middleware guarding /admin/* and /api/admin/*. POST /api/admin/content/[collection]: zod-validate then commit via GitHub Contents API (fetch, sha handling, clear commit message) or write to disk in dev. POST /api/admin/upload for images/PDF into public/uploads. Dashboard: collections, last commits, "deploying…" hint.' },
  { key: 'admin-editors', title: 'Admin content editors', paths: ['app/admin/(editors)/**', 'components/admin/**'],
    brief: 'One editor per collection (profile, sections order+visibility, theme tokens with live preview, SEO, skills, experience, projects, research, education, certifications, achievements, services, testimonials, resume, playground visibility, AI providers + limits). Form primitives: text, textarea, markdown, list with add/remove/reorder, image upload, color, toggle, "unverified" badge. Zod client validation, save toast, unsaved-changes guard, mobile usable.' },
  { key: 'ai-gateway', title: 'AI gateway', paths: ['lib/ai/**', 'app/api/ai/**'],
    brief: 'Provider router per BRIEF AI policy: Groq -> Gemini -> DeepSeek (disabled unless admin enables; strict max_tokens; per-instance token budget) with timeouts and failover. Streaming text + Zod structured-output helpers, vision input (Gemini/Groq vision), per-IP rate limit, input caps, usage headers. Client hook useAI() with in-browser fallback flag. Document API in CONTRACTS.md section already stubbed.' },
  { key: 'playground-hub', title: 'Playground hub', paths: ['app/playground/**', 'components/playground/**'],
    brief: '/playground gallery with search, filter by pillar/skill, "proves" chips; /playground/[slug] renders demo via registry with title, story (which real work it mirrors), skills proven, how-it-works, limits. Hidden demos excluded. Skill landing: /playground?skill=x.' },
]

const DEMO_MODULES = [
  { key: 'demos-ai-docs', title: 'AI document intelligence', demos: [
      ['org-chart-extractor', 'Structure Fetcher reborn: upload org-chart image/PDF -> vision LLM -> editable tree + table -> export JSON', 'Azure OpenAI/Groq vision, document extraction, React'],
      ['esg-gap-checker', 'Paste/upload a sustainability report excerpt -> gap analysis vs ISSB/TCFD/CSRD checklist, structured findings + recommendations (Euthyna-style)', 'ESG reporting, LLM structured output, Zod'],
      ['ownership-extractor', 'Text about a corporate group -> entity ownership graph (SVG) -> equity-share vs control consolidation %', 'corporate-entity extraction, GHG boundary-setting'],
    ] },
  { key: 'demos-ai-agents', title: 'Agents & LLM systems', demos: [
      ['ask-malik', 'RAG chat over site content: in-browser embeddings + BM25 hybrid, streamed answers with citations to sections', 'RAG, vector search, LLM integration'],
      ['agent-orchestra', 'Planner -> parallel workers -> reviewer on a user goal, live span tree like Langfuse, Temporal-style retries/timeouts', 'autonomous agents, Claude Agent SDK concepts, Langfuse, Temporal'],
      ['mcp-tool-lab', 'Define JSON-schema tools (calculator, weather via Open-Meteo, site search); LLM chooses and calls them; show MCP-style request/response log', 'MCP, tool calling, function schemas'],
    ] },
  { key: 'demos-ai-rag', title: 'RAG, vectors & cost-efficient AI', demos: [
      ['vector-space-explorer', 'Embed sentences in-browser, 2D projection scatter, cosine top-k search, chunking strategies compared (Pinecone concepts)', 'Pinecone, embeddings, semantic search'],
      ['legal-rag-assistant', 'AI Lawyer homage over a small public-domain legal corpus: retrieve -> cite -> answer, shows retrieved chunks and scores', 'OpenAI, Pinecone-style retrieval, RAG'],
      ['prompt-cost-lab', 'Token counter, per-model cost estimate, caching/batching savings, model router rules — "cost-efficient AI implementation"', 'LLM cost engineering, OpenAI, Anthropic, Google'],
    ] },
  { key: 'demos-sensors-ml', title: 'Sensors & ML (HumCareADL)', demos: [
      ['har-live', 'Phone motion sensors (DeviceMotion, permission flow on iOS) -> live IMU chart -> 5s windows -> in-browser activity classifier; desktop replays bundled sample data', 'HAR, CNN-LSTM, TensorFlow, sensor ML'],
      ['sensor-pipeline', 'Step through the MotionIQ 8-step preprocessing pipeline on sample data: standardise, atomic windows, gravity calc, fall segmentation', 'Python data pipelines, pandas concepts, preprocessing'],
      ['neural-playground', 'Train a tiny neural net in-browser on user-drawn 2D points; loss curve, decision boundary; regression vs classification toggle', 'Machine learning, scikit-learn/TensorFlow concepts'],
    ] },
  { key: 'demos-realtime', title: 'Real-time & queues', demos: [
      ['rabbitmq-sim', 'Visual broker: producers, direct/topic/fanout exchanges, queues, consumers, acks, prefetch, dead-letter; mirrors MotionIQ sensor streaming', 'RabbitMQ, IoT streaming, Java consumer concepts'],
      ['bullmq-jobs', 'Job queue with concurrency, retries, exponential backoff, delayed + repeatable jobs, failure injection', 'BullMQ, background processing, workflow orchestration'],
      ['live-telemetry', 'Server-Sent Events from an edge route streaming simulated sensor/fleet metrics; SVG charts, pause, thresholds', 'real-time systems, SSE, Node streaming'],
    ], extraPaths: ['app/api/demos/telemetry/**'] },
  { key: 'demos-backend', title: 'Backend architecture', demos: [
      ['layered-api-lab', 'Send requests to real routes and watch routes -> controller -> service -> repository trace, Zod validation errors, error middleware, Winston-style log lines', 'Express/NestJS layering, Zod, REST APIs, logging'],
      ['rbac-audit-lab', 'CASL-style rule builder (roles, subjects, conditions) -> "can X do Y on Z?" + transactional audit log timeline with rollback demo', 'CASL, RBAC, audit logging, enterprise backends'],
      ['rate-limiter', 'Token bucket vs sliding window simulation + live edge endpoint returning 429 with RateLimit headers', 'API design, edge functions'],
    ], extraPaths: ['app/api/demos/lab/**', 'app/api/demos/limited/**'] },
  { key: 'demos-esg-climate', title: 'ESG & climate', demos: [
      ['ghg-calculator', 'Scope 1/2/3 calculator with emission factors, operational vs financial control boundaries, stacked breakdown, CSV export', 'GHG Protocol, ESG domain, data modelling'],
      ['grid-carbon-live', 'UK grid carbon intensity now + 48h forecast + generation mix (carbonintensity.org.uk, free) with "best time to run a heat pump" hint', 'external API integration, Terra decarbonisation'],
      ['solar-pv-estimator', 'Pick location (map click or search via Open-Meteo geocoding) -> PVGIS yearly yield via server proxy, panel/kWp sliders, CO2 avoided', 'solar PV, real-estate decarbonisation, API proxying'],
    ], extraPaths: ['app/api/demos/pvgis/**'] },
  { key: 'demos-product', title: 'Product engineering (VoodVR, Kickstart)', demos: [
      ['stripe-connect-flow', 'Simulated Stripe Connect marketplace: creator onboarding, subscription, platform fee split, webhook event sequence with idempotency and retries (no real keys)', 'Stripe Connect, subscriptions, webhooks'],
      ['web-perf-lab', 'Kickstart story 27s -> 3.5s: toggle code splitting, lazy loading, compression, request dedupe; animated network waterfall + metrics', 'webpack, performance optimisation, React'],
      ['dispatch-board', 'Field-service dispatcher: technicians, jobs with time windows, greedy/optimised assignment on an SVG map, invoice preview', 'scheduling, product engineering, algorithms'],
    ] },
  { key: 'demos-realtime-chat', title: 'Collaboration & chat', demos: [
      ['live-chat', 'Stream-Chat-style UI: channels, typing indicators, reactions, read receipts; cross-tab realtime via BroadcastChannel (no backend)', 'real-time chat integration, React state'],
      ['kanban-board', 'Task-Vault homage: private per-browser boards, drag and drop (pointer + keyboard), localStorage, export/import', 'React, auth-style data isolation, UX'],
      ['data-grid', 'React-Query-style cache lab: stale/fresh timers, refetch on focus, optimistic updates, pagination against a demo API', 'React Query, data fetching, caching'],
    ], extraPaths: ['app/api/demos/items/**'] },
  { key: 'demos-cs', title: 'CS fundamentals', demos: [
      ['algo-visualizer', 'Pathfinding (A*, Dijkstra, BFS) + sorting (4 algorithms) visualiser with step/play and counters', 'DSA, competitive programming'],
      ['code-judge', 'Solve small problems in JS in a Web Worker sandbox with hidden tests, time limits, verdicts (AC/WA/TLE)', 'competitive programming, C/C++ fundamentals'],
      ['sql-playground', 'sql.js (WASM) in-browser SQLite with schema viewer and LeetCode-style SQL challenges + checker', 'SQL, PostgreSQL/MySQL, Drizzle concepts'],
    ] },
  { key: 'demos-craft', title: 'Design & play', demos: [
      ['design-studio', 'Graphic-design hobby: generative poster maker (grid, type, shapes, seeded), export PNG/SVG', 'graphic design, canvas, SVG'],
      ['theme-lab', 'Live design-token editor with WCAG contrast checks, previews the site theme, copy CSS / apply via admin', 'design systems, Tailwind, accessibility'],
      ['cricket-sim', 'Cricket-Game-C homage: playable browser cricket with ball-by-ball commentary, scorecard, optional terminal mode', 'C fundamentals, game logic'],
    ] },
  { key: 'demos-automation', title: 'Automation & devops', demos: [
      ['automation-recorder', 'fb-automation homage: record click/type steps on a sandboxed mock marketplace form, replay them, export a Puppeteer script', 'Puppeteer, browser automation'],
      ['ci-pipeline', 'Visual CI/CD pipeline: lint -> test -> build -> docker -> deploy stages, parallel jobs, failure + retry, cache hits', 'CI/CD, Docker, Vercel/AWS deployment'],
      ['system-design-canvas', 'Drag components (LB, API, queue, cache, DB, worker) and simulate load; shows bottlenecks and latency', 'system design, scalability, AWS/Azure'],
    ] },
]

const DEMO_MODULE_DEFS = DEMO_MODULES.map(m => ({
  key: m.key,
  title: m.title,
  paths: [...m.demos.map(([slug]) => `components/demos/${slug}/**`), ...(m.extraPaths || [])],
  brief: `Build these demos (each a self-contained component at components/demos/<slug>/index.tsx, default export, client component where needed):\n` +
    m.demos.map(([slug, what, skills]) => `- ${slug}: ${what}. Proves: ${skills}.`).join('\n') +
    `\nEach demo: works offline-first where possible, has an honest mobile layout, loading/empty/error states, and a short "how it works" string exported as \`notes\`. Use lib/ai gateway (never call providers directly) for LLM features.`,
}))

const MODULES = [...SITE_MODULES, ...DEMO_MODULE_DEFS]
const ALL_DEMOS = DEMO_MODULES.flatMap(m => m.demos.map(([slug, what, skills]) => ({ slug, what, skills, module: m.key })))
const moduleTable = MODULES.map(m => `- ${m.key}: ${m.paths.join(', ')}`).join('\n')
const demoTable = ALL_DEMOS.map(d => `- ${d.slug} (${d.module}): ${d.what} | proves: ${d.skills}`).join('\n')
const deploy = !args || args.deploy !== false

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const BUILD_SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
  requests: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files', 'requests'] }
const REVIEW_SCHEMA = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: {
  severity: { type: 'string', enum: ['high', 'medium', 'low'] }, file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } },
  required: ['severity', 'file', 'issue', 'fix'] } } }, required: ['findings'] }
const QA_SCHEMA = { type: 'object', properties: { green: { type: 'boolean' }, report: { type: 'string' },
  remaining: { type: 'array', items: { type: 'string' } } }, required: ['green', 'report', 'remaining'] }
const GAPS_SCHEMA = { type: 'object', properties: { gaps: { type: 'array', items: { type: 'string' } } }, required: ['gaps'] }
const CONCEPT_SCHEMA = { type: 'object', properties: { name: { type: 'string' }, file: { type: 'string' }, pitch: { type: 'string' } },
  required: ['name', 'file', 'pitch'] }
const JUDGE_SCHEMA = { type: 'object', properties: { winner: { type: 'string' }, scores: { type: 'string' }, rationale: { type: 'string' } },
  required: ['winner', 'scores', 'rationale'] }
const DEPLOY_SCHEMA = { type: 'object', properties: { url: { type: 'string' }, ok: { type: 'boolean' }, report: { type: 'string' } },
  required: ['url', 'ok', 'report'] }

// ---------------------------------------------------------------------------
// 1. Design panel: 3 distinct concepts (static HTML mocks) -> judge -> DESIGN.md
// ---------------------------------------------------------------------------
phase('Design')
const ANGLES = [
  'Signal: sensor waveforms, oscilloscopes, the HumCareADL research — data as texture',
  'Systems: message queues, agent pipelines, schematics — architecture as visual language',
  'Earth & print: ESG/decarbonisation plus his graphic-design craft — editorial, tactile, typographic',
]
const concepts = (await parallel(ANGLES.map((angle, i) => () => agent(
  `You are designer #${i + 1} on a 3-person panel. ${CONTEXT}
Create ONE distinctive visual concept for Malik's portfolio from this angle: ${angle}.
Obey the banned list in BRIEF section 3. Deliver design/concept-${i + 1}/index.html: a single static HTML file (inline CSS, Google Fonts allowed)
mocking the homepage hero, one section, a skill->demo chip row, a playground card and the mobile nav — in BOTH light and dark (toggle).
Include a :root token block (color, type scale, radius, spacing, motion) and a one-paragraph rationale in an HTML comment.
Take Playwright screenshots (Chromium preinstalled at /opt/pw-browsers; never run "playwright install") at 390px and 1280px into the same folder.`,
  { label: `designer:${i + 1}`, phase: 'Design', schema: CONCEPT_SCHEMA })))).filter(Boolean)

const judged = await agent(`You are the design director. ${CONTEXT}
Judge these concepts by opening their screenshots and HTML: ${JSON.stringify(concepts)}.
Score each 1-10 on: memorability, fit to Malik's story, readability/accessibility (check contrast), mobile quality, feasibility with CSS/SVG/canvas only.
Pick a winner, graft the best ideas from the runners-up, then write DESIGN.md at the repo root: tokens (light + dark), typography (Google Fonts),
layout grid, component styling rules, iconography, motion rules, the single signature hero moment, playground card style, do/don't list.`,
  { label: 'design-director', phase: 'Design', schema: JUDGE_SCHEMA })
log(`Design winner: ${judged?.winner}`)

// ---------------------------------------------------------------------------
// 2. Foundation
// ---------------------------------------------------------------------------
phase('Foundation')
await agent(`You are the ARCHITECT. ${CONTEXT}
${STACK}
Scaffold the foundation so ${MODULES.length} builders can work in parallel. Implement DESIGN.md faithfully.
1. package.json (scripts: dev, build, start, lint, typecheck, test:e2e), tsconfig strict with "@/*", next.config (security headers, images), eslint, tailwind v4, .gitignore, .env.example (ADMIN_PASSWORD, ADMIN_SECRET, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, GROQ_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY). npm install everything any module may need (incl. allowed extras + @playwright/test).
2. lib/content/schema.ts: zod schemas + types for collections: site (profile, hero, about, contact, socials, sections[{id,enabled}], theme tokens, seo, analytics, contactFormEndpoint), skills (pillar, level, demoSlugs[], enabled), experience (highlights[{text, proofDemo?}]), projects (private flag hides repo link), research, education, certifications, achievements, services, testimonials, resume, playground (per-demo enabled), ai (providers enabled, maxTokens, perIpPerMinute). Every item has enabled + optional verified flag.
3. lib/content/index.ts: typed validated getters (static JSON import; invalid content fails the build) + COLLECTIONS map reused by admin. Seed content/*.json with minimal valid placeholders (the Content agent fills real data next).
4. lib/demos/registry.ts: metadata for every demo below {slug, title, summary, pillar, skills[], module} + next/dynamic loader per slug (ssr:false where browser APIs are used).
${demoTable}
5. components/ui/** design-system primitives from DESIGN.md; app/globals.css tokens light/dark; fonts via next/font.
6. app/layout.tsx + app/page.tsx rendering sections by order/visibility from content via a section map.
7. lib/ai/index.ts: STUB of the AI gateway API (types + signatures) the ai-gateway builder will implement; demo builders code against it.
8. STUB every owned file so the app typechecks and builds NOW:
${moduleTable}
9. CONTRACTS.md: folder map, ownership table, content schema summary, UI primitives API, AI gateway API, demo component contract (default export + \`notes\`), conventions.
10. README.md: local setup, env vars, deploy to Vercel, fine-grained GitHub token (Contents RW on this repo only), how admin saves work.
Verify: npm run typecheck && npm run lint && npm run build all pass. Do NOT git commit.`,
  { label: 'architect', phase: 'Foundation' })

// ---------------------------------------------------------------------------
// 3. Content
// ---------------------------------------------------------------------------
phase('Content')
await agent(`You are the CONTENT EDITOR. ${CONTEXT}
Fill content/*.json with Malik's real data following BRIEF section 2 exactly (verified -> enabled; unverified -> enabled:false + verified:false; excluded items absent).
Write crisp, specific, first-person-free copy in his voice (brand hints in docs/context/README.md). Map EVERY skill to >=1 demo slug from lib/demos/registry.ts
and set proofDemo on experience highlights where a demo mirrors that work. Copy docs/context/resume.pdf to public/uploads/resume.pdf and reference it.
Run npm run typecheck && npm run build to prove content validates. Edit only content/** and public/uploads/**. Do NOT git commit.`,
  { label: 'content-editor', phase: 'Content' })

// ---------------------------------------------------------------------------
// 4-6. Build -> Review -> Fix, pipelined per module
// ---------------------------------------------------------------------------
const results = await pipeline(
  MODULES,

  m => agent(`You are the builder for module "${m.key}" — ${m.title}. ${CONTEXT}
${STACK}
${RULES}
OWNED PATHS: ${m.paths.join(', ')}
TASK:
${m.brief}
Replace the stubs with complete, production-quality, genuinely delightful implementations that follow DESIGN.md.`,
    { label: `build:${m.key}`, phase: 'Build', schema: BUILD_SCHEMA }),

  (built, m) => agent(`Review module "${m.key}" (${m.title}). Files: ${(built?.files || m.paths).join(', ')}.
Requirements:
${m.brief}
Read the actual code and check: correctness and types; works as described (not a mock where real behaviour was asked);
content/registry-driven (nothing about Malik hard-coded); DESIGN.md adherence; responsive at 360/768/1280; a11y (semantics, labels,
focus, contrast, reduced motion); security (auth, input validation, XSS, secrets never client-side, AI routes rate-limited);
server/client split and bundle weight. Report only real problems with a concrete fix. high = broken/insecure/requirement missed.`,
    { label: `review:${m.key}`, phase: 'Review', schema: REVIEW_SCHEMA })
    .then(r => ({ built, findings: (r?.findings || []).filter(f => f.severity !== 'low') })),

  ({ built, findings }, m) => {
    if (!findings.length) return { module: m.key, fixed: 0, requests: built?.requests || [] }
    return agent(`You are the fixer for module "${m.key}". ${RULES}
OWNED PATHS: ${m.paths.join(', ')}
Verify each finding against the code, fix the real ones, and say why you skipped any:
${JSON.stringify(findings, null, 2)}`,
      { label: `fix:${m.key}`, phase: 'Fix', schema: BUILD_SCHEMA })
      .then(f => ({ module: m.key, fixed: findings.length, requests: [...(built?.requests || []), ...(f?.requests || [])] }))
  },
)

const done = results.filter(Boolean)
const failed = MODULES.filter((m, i) => !results[i]).map(m => m.key)
if (failed.length) log(`Modules that did not complete: ${failed.join(', ')}`)
const requests = done.flatMap(r => r.requests.map(q => `[${r.module}] ${q}`))

// ---------------------------------------------------------------------------
// 7. Integrate — loop until green
// ---------------------------------------------------------------------------
phase('Integrate')
const integrate = (extra, label) => agent(`You are the INTEGRATOR; you may now edit any file. ${CONTEXT}
1. Apply sensible cross-module requests:
${requests.length ? requests.join('\n') : '(none)'}
${extra ? `2. Also resolve:\n${extra}` : ''}
3. npm run typecheck, npm run lint, npm run build — fix every error at its root cause.
4. Write/extend Playwright e2e tests in e2e/ (Chromium at /opt/pw-browsers; never "playwright install") and run them against the production server
   at 360px and 1280px, both themes: /, every /projects/[slug], /playground, EVERY /playground/[slug] (demo renders + basic interaction),
   /resume, /admin/login, admin login -> edit one field -> local save writes content -> revert. Fail on console errors, horizontal overflow,
   broken internal links, a11y violations (add @axe-core/playwright).
5. AI routes: if GROQ_API_KEY/GEMINI_API_KEY are set, make ONE tiny real call per provider to prove the router works; DeepSeek at most one
   call with max_tokens<=64 (hard project cap: 1M input / 1M output tokens total). Never log keys.
6. Stop servers. Do NOT git commit. green=true only if everything passes.`,
  { label, phase: 'Integrate', schema: QA_SCHEMA })

let qa = await integrate('', 'integrator:1')
for (let round = 2; round <= 4 && qa && !qa.green; round++) {
  log(`Integration round ${round}: ${qa.remaining.length} issues remaining`)
  qa = await integrate(qa.remaining.join('\n'), `integrator:${round}`)
}

// ---------------------------------------------------------------------------
// 8. Critique — two lenses in parallel, then one final integration pass
// ---------------------------------------------------------------------------
phase('Critique')
const critics = await parallel([
  () => agent(`COVERAGE CRITIC. ${CONTEXT} Open content/*.json, lib/demos/registry.ts and the running build (start it, Playwright at 360px).
List concrete gaps: any skill/tech keyword in docs/context (skills.md, research-findings.md, experience) with no working demo proving it;
demos that are shallow mocks; facts that violate BRIEF content policy; anything visible not editable from admin.`,
    { label: 'critic:coverage', phase: 'Critique', schema: GAPS_SCHEMA }),
  () => agent(`PRODUCT & DESIGN CRITIC. ${CONTEXT} Start the production build and browse it like a hiring manager on a phone, then on desktop
(Playwright screenshots at 390px and 1440px, both themes). List concrete gaps: weak first impression, DESIGN.md violations, confusing navigation,
slow or janky pages (measure LCP/CLS roughly), inconsistent components, copy that is vague or unverified.`,
    { label: 'critic:product', phase: 'Critique', schema: GAPS_SCHEMA }),
])
const gaps = critics.filter(Boolean).flatMap(c => c.gaps)
if (gaps.length) {
  log(`Critics found ${gaps.length} gaps; running final integration`)
  qa = await integrate(gaps.join('\n'), 'integrator:final')
}

// ---------------------------------------------------------------------------
// 9. Deploy (new Vercel project; never touches malikhaider.vercel.app)
// ---------------------------------------------------------------------------
let deployed = null
if (deploy && qa?.green) {
  phase('Deploy')
  deployed = await agent(`You are the RELEASE ENGINEER. Follow BRIEF section 6 exactly.
Use VERCEL_TOKEN with the Vercel REST API or "npx vercel --token" (never print secrets). Create/link project "malik-haider-portfolio" (framework nextjs,
production branch main, linked to GitHub repo haid-er/agentic-portfolio if the Vercel GitHub integration allows; otherwise deploy via CLI).
Set env vars: ADMIN_PASSWORD from $ADMIN_PASSWORD, ADMIN_SECRET = new random 48 bytes, GITHUB_TOKEN from $GITHUB_FINE_GRAIN_PERMISSION_TOKEN,
GITHUB_REPO=haid-er/agentic-portfolio, GITHUB_BRANCH=main, GROQ_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY (if present). Deploy production.
Smoke-test the live URL with Playwright at 360px and 1280px (home, playground, 3 demos incl. one AI demo, admin login page). Do NOT touch any other Vercel project or domain.`,
    { label: 'release', phase: 'Deploy', schema: DEPLOY_SCHEMA })
} else if (deploy) {
  log('Skipping deploy: QA is not green')
}

return {
  design: judged,
  green: !!qa?.green,
  qa: qa?.report,
  remaining: qa?.remaining || [],
  modules: done.map(r => ({ module: r.module, fixedFindings: r.fixed })),
  failedModules: failed,
  gaps,
  deployed,
}
