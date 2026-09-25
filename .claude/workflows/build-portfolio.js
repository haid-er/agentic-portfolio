export const meta = {
  name: 'build-portfolio',
  description: 'Agent team that builds the admin-configurable, zero-cost Next.js portfolio (~45 agents)',
  whenToUse: 'Scaffold or rebuild the portfolio site from scratch. Pass args.profile (text about the owner) to seed real content.',
  phases: [
    { title: 'Foundation', detail: 'architect scaffolds app, content schema, contracts, stubs' },
    { title: 'Build', detail: 'one builder per module, disjoint file ownership' },
    { title: 'Review', detail: 'one reviewer per module' },
    { title: 'Fix', detail: 'fixers for blocking review findings' },
    { title: 'Integrate', detail: 'build + lint + responsive smoke test, loop until green' },
    { title: 'Critique', detail: 'completeness check against requirements' },
  ],
}

// ---------------------------------------------------------------------------
// Product requirements (shared by every agent)
// ---------------------------------------------------------------------------
const PRODUCT = `
PRODUCT: Personal portfolio web app, deployed on Vercel free tier, $0 running cost.
- Everything visible on the site is configurable from /admin, so future updates need NO code changes.
- Content lives as JSON in /content/*.json committed to the repo. Admin saves = commit via GitHub
  Contents API (env GITHUB_TOKEN, GITHUB_REPO "owner/name", GITHUB_BRANCH) -> Vercel auto-redeploys.
  In local dev without GITHUB_TOKEN, saves write to disk.
- Fully responsive (mobile 360px first, tablet, desktop), accessible, fast (static by default).
- Sections: Hero, About, Skills, Experience timeline, Projects, Services, Testimonials, Resume (downloadable/printable), Contact.
  Each section can be toggled and reordered from admin.
- Theming & SEO: dark/light, brand colors from admin, metadata, OG image, sitemap, robots, optional Vercel Analytics.
- Playground: many small, simple but creative, *working* mini-projects. Every skill listed on the site
  links to at least one live demo that proves it (skills.json -> demoSlugs[]).
`

const STACK = `
STACK (do not add other dependencies without strong reason):
next@15 (App Router, TypeScript strict), react@19, tailwindcss@4, zod, lucide-react, @vercel/analytics.
No database, no paid services, no CSS-in-JS, no animation libraries (CSS + canvas/SVG only).
`

const RULES = `
TEAM RULES:
- You own ONLY the paths listed for your module. Never edit files outside them. If you need a change
  elsewhere, describe it in your final output under "requests".
- Read CONTRACTS.md first; it is the source of truth for types, content schema and shared components.
- Never run git commit/push, npm install, or next build/dev (other agents share this working tree).
  You MAY run: npx tsc --noEmit -p . and npx eslint <your files>. Fix only errors in files you own.
- Keep code simple and readable: small components, no premature abstraction, server components by default,
  "use client" only where interaction requires it.
`

// ---------------------------------------------------------------------------
// Modules: each builder owns a disjoint set of paths. Foundation stubs all of them.
// ---------------------------------------------------------------------------
const MODULES = [
  { key: 'shell', title: 'Layout shell & navigation',
    paths: ['components/layout/**', 'app/not-found.tsx'],
    brief: 'Header with responsive nav + mobile menu, footer with socials, theme toggle (dark/light, no flash), skip-link, scroll-spy for section anchors. Nav items derive from enabled sections in site.json.' },
  { key: 'hero-about', title: 'Hero & About sections',
    paths: ['components/sections/Hero.tsx', 'components/sections/About.tsx'],
    brief: 'Creative but lightweight hero (name, role, tagline, CTA buttons, avatar, subtle CSS/canvas background). About with bio (markdown-lite), highlights/stats.' },
  { key: 'skills-experience', title: 'Skills & Experience sections',
    paths: ['components/sections/Skills.tsx', 'components/sections/Experience.tsx'],
    brief: 'Skills grouped by category with level; each skill links to its playground demos (demoSlugs). Experience as responsive vertical timeline with role, company, dates, bullets, tech tags.' },
  { key: 'projects', title: 'Projects section & detail pages',
    paths: ['components/sections/Projects.tsx', 'app/projects/**'],
    brief: 'Filterable project grid (by tag), cards with image, links (live, repo, demo). /projects/[slug] static detail pages with generateStaticParams + metadata.' },
  { key: 'services-testimonials', title: 'Services & Testimonials sections',
    paths: ['components/sections/Services.tsx', 'components/sections/Testimonials.tsx'],
    brief: 'Services cards with icon (lucide name from content). Testimonials carousel (accessible, keyboard, no library, reduced-motion aware).' },
  { key: 'resume-contact', title: 'Resume & Contact',
    paths: ['components/sections/Resume.tsx', 'components/sections/Contact.tsx', 'app/resume/**'],
    brief: 'Resume section + /resume print-optimised page (print CSS, "Download PDF" = window.print, or link to uploaded PDF if set). Contact: email/social links plus form that posts to a free endpoint configured in admin (e.g. Formspree/Web3Forms URL) with mailto fallback.' },
  { key: 'seo-theme', title: 'SEO, theming & analytics',
    paths: ['app/sitemap.ts', 'app/robots.ts', 'app/opengraph-image.tsx', 'lib/seo/**', 'lib/theme/**'],
    brief: 'generateMetadata helpers from site.json seo block, dynamic OG image (next/og), sitemap incl. projects + playground, robots. Theme: map admin brand colors/radius/font to CSS variables injected in root layout; analytics on/off from admin.' },
  { key: 'admin-core', title: 'Admin core (auth, save pipeline, shell)',
    paths: ['app/admin/login/**', 'app/admin/layout.tsx', 'app/admin/page.tsx', 'app/api/admin/**', 'lib/admin/**', 'middleware.ts'],
    brief: 'Password login (ADMIN_PASSWORD env) -> HMAC-signed httpOnly cookie via Web Crypto (ADMIN_SECRET env); middleware guards /admin/* and /api/admin/*. POST /api/admin/content/[collection] validates with zod then saves via GitHub Contents API (fetch, handle sha) or local fs in dev. POST /api/admin/upload stores images/PDF under public/uploads the same way. Admin dashboard lists collections + deploy status hint. Rate-limit login attempts.' },
  { key: 'admin-editors', title: 'Admin content editors',
    paths: ['app/admin/(editors)/**', 'components/admin/**'],
    brief: 'One editor page per collection (site/profile, sections order+visibility, theme, seo, skills, experience, projects, services, testimonials, resume, playground visibility). Reusable form primitives: text, textarea, markdown, list-of-items with add/remove/reorder, image upload, color, toggle. Client-side zod validation, save button with status toast, unsaved-changes guard. Mobile usable.' },
  { key: 'playground-hub', title: 'Playground hub',
    paths: ['app/playground/**', 'components/playground/**'],
    brief: '/playground gallery of all demos with search + filter by skill; /playground/[slug] page renders the demo via registry with title, description, skills proven, "how it works" notes and source link. Hidden demos (admin toggle) excluded.' },
  { key: 'demos-frontend', title: 'Demos: frontend craft',
    paths: ['components/demos/kanban-board/**', 'components/demos/generative-art/**', 'components/demos/theme-builder/**'],
    brief: 'kanban-board: drag & drop (pointer + keyboard), localStorage persistence. generative-art: canvas flow-field/particles with seed + export PNG. theme-builder: live design-token editor with contrast checker and copyable CSS.' },
  { key: 'demos-algorithms', title: 'Demos: algorithms & visualisation',
    paths: ['components/demos/pathfinding/**', 'components/demos/sorting/**', 'components/demos/game-of-life/**'],
    brief: 'pathfinding: grid A*/Dijkstra/BFS with walls, step/play. sorting: bar visualiser for 4 algorithms with speed control + comparisons count. game-of-life: canvas, patterns, speed, wraparound.' },
  { key: 'demos-backend', title: 'Demos: backend & APIs',
    paths: ['components/demos/api-explorer/**', 'components/demos/rate-limiter/**', 'components/demos/jwt-debugger/**', 'app/api/demos/**'],
    brief: 'api-explorer: UI calling real edge routes under /api/demos/* (echo, zod validation errors, pagination) showing request/response/timing. rate-limiter: token-bucket simulation + live endpoint returning 429 with headers. jwt-debugger: decode/sign/verify HS256 with Web Crypto, fully client-side.' },
  { key: 'demos-data', title: 'Demos: data & tools',
    paths: ['components/demos/live-dashboard/**', 'components/demos/markdown-editor/**', 'components/demos/regex-tester/**'],
    brief: 'live-dashboard: simulated real-time metrics stream with SVG line/bar charts (no chart lib). markdown-editor: split view with safe rendering + localStorage. regex-tester: highlights matches/groups, flags, cheat sheet.' },
]

const DEMO_SLUGS = [
  'kanban-board', 'generative-art', 'theme-builder',
  'pathfinding', 'sorting', 'game-of-life',
  'api-explorer', 'rate-limiter', 'jwt-debugger',
  'live-dashboard', 'markdown-editor', 'regex-tester',
]

const profile = (args && args.profile) || ''

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    requests: { type: 'array', items: { type: 'string' }, description: 'changes needed outside owned paths' },
  },
  required: ['summary', 'files', 'requests'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'issue', 'fix'],
      },
    },
  },
  required: ['findings'],
}

const QA_SCHEMA = {
  type: 'object',
  properties: {
    green: { type: 'boolean', description: 'typecheck, lint, build and smoke tests all pass' },
    report: { type: 'string' },
    remaining: { type: 'array', items: { type: 'string' } },
  },
  required: ['green', 'report', 'remaining'],
}

const GAPS_SCHEMA = {
  type: 'object',
  properties: {
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['gaps'],
}

// ---------------------------------------------------------------------------
// 1. Foundation (single architect, owns everything not owned by a module)
// ---------------------------------------------------------------------------
phase('Foundation')
const moduleTable = MODULES.map(m => `- ${m.key}: ${m.paths.join(', ')}`).join('\n')

await agent(`You are the ARCHITECT. Scaffold the foundation of this repo so ${MODULES.length} builders can work in parallel.
${PRODUCT}
${STACK}
Deliver, in the repo root:
1. package.json (scripts: dev, build, start, lint, typecheck), tsconfig (strict, "@/*" alias), next.config, eslint, tailwind v4 setup, .gitignore, .env.example (ADMIN_PASSWORD, ADMIN_SECRET, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH). Run npm install.
2. lib/content/schema.ts: zod schemas + inferred types for every collection: site (profile, hero, about, contact, socials, sections[{id, enabled}], theme, seo, analytics, contactFormEndpoint), skills (with demoSlugs[]), experience, projects, services, testimonials, resume, playground (per-demo visibility).
3. content/*.json seeded with realistic content that validates. ${profile ? `Use this owner profile:\n${profile}` : 'Use clearly-marked placeholder content (the owner will replace it via admin).'} Map every skill to at least one of these demo slugs: ${DEMO_SLUGS.join(', ')}.
4. lib/content/index.ts: typed, validated getters (static JSON import; build fails loudly on invalid content). COLLECTIONS map (name -> schema -> file path) reused by admin.
5. lib/demos/registry.ts: metadata for each demo slug {slug, title, description, skills[], component: next/dynamic import of components/demos/<slug>/index.tsx}.
6. Design system in components/ui/** (Button, Card, Badge, Section, Container, Input, etc.) and app/globals.css with CSS-variable tokens for light/dark.
7. app/layout.tsx and app/page.tsx: page renders sections in the order/visibility from site.json via a section map.
8. STUB every file owned by the modules below (minimal compiling component/route with a TODO) so the app typechecks and builds NOW:
${moduleTable}
9. CONTRACTS.md: stack, folder map, module ownership table above, content schema summary, shared component APIs, conventions (server-first, "use client" rules, a11y + responsive checklist, how admin save works).
10. README.md: local setup, Vercel deploy steps, env vars, how to create a fine-grained GitHub token (Contents read/write on this repo only).
Verify with npm run typecheck && npm run lint && npm run build. All must pass. Do NOT git commit.`,
  { label: 'architect', phase: 'Foundation' })

// ---------------------------------------------------------------------------
// 2-4. Build -> Review -> Fix, pipelined per module (no barriers)
// ---------------------------------------------------------------------------
const results = await pipeline(
  MODULES,

  m => agent(`You are the builder for module "${m.key}" — ${m.title}.
${PRODUCT}
${STACK}
${RULES}
OWNED PATHS: ${m.paths.join(', ')}
TASK: ${m.brief}
Replace the stubs with complete, production-quality implementations. Read content via lib/content getters; everything user-facing must come from content, never hard-coded. Mobile-first responsive, keyboard accessible, respects prefers-reduced-motion.`,
    { label: `build:${m.key}`, phase: 'Build', schema: BUILD_SCHEMA }),

  (built, m) => agent(`Review module "${m.key}" (${m.title}). Files: ${(built?.files || m.paths).join(', ')}.
Requirements: ${m.brief}
${PRODUCT}
Check, reading the actual code: correctness & type safety; content comes from lib/content (admin-configurable, nothing hard-coded);
responsive at 360/768/1280px; a11y (semantics, labels, focus, contrast, reduced motion); security (admin auth, input validation, XSS);
server vs client component split; simplicity. Only report real problems with a concrete fix. high = broken/insecure/requirement missed.`,
    { label: `review:${m.key}`, phase: 'Review', schema: REVIEW_SCHEMA })
    .then(r => ({ built, findings: (r?.findings || []).filter(f => f.severity !== 'low') })),

  ({ built, findings }, m) => {
    if (!findings.length) return { module: m.key, built, fixed: 0, requests: built?.requests || [] }
    return agent(`You are the fixer for module "${m.key}".
${RULES}
OWNED PATHS: ${m.paths.join(', ')}
Fix these review findings (verify each first; skip any that are wrong and say why):
${JSON.stringify(findings, null, 2)}`,
      { label: `fix:${m.key}`, phase: 'Fix', schema: BUILD_SCHEMA })
      .then(f => ({ module: m.key, built, fixed: findings.length, requests: [...(built?.requests || []), ...(f?.requests || [])] }))
  },
)

const done = results.filter(Boolean)
const failed = MODULES.filter((m, i) => !results[i]).map(m => m.key)
if (failed.length) log(`Modules that did not complete: ${failed.join(', ')}`)
const requests = done.flatMap(r => r.requests.map(q => `[${r.module}] ${q}`))

// ---------------------------------------------------------------------------
// 5. Integrate: whole-repo QA, loop until green (max 3 rounds)
// ---------------------------------------------------------------------------
phase('Integrate')
const integrate = (extra) => agent(`You are the INTEGRATOR. All builders are done; you may now edit any file.
${PRODUCT}
1. Apply these cross-module requests where sensible:
${requests.length ? requests.join('\n') : '(none)'}
${extra ? `2. Also address:\n${extra}` : ''}
3. Run npm run typecheck, npm run lint, npm run build and fix every error at its root cause.
4. Start the production server and smoke-test with Playwright (Chromium is preinstalled; do not run "playwright install")
   at 360px and 1280px: /, every /projects/[slug], /playground and every /playground/[slug], /resume, /admin/login.
   Fail on console errors, horizontal overflow, broken links, or unrendered demos. Log in to admin with a test
   ADMIN_PASSWORD, edit one field, confirm the local save writes content/*.json, then revert it.
5. Stop the server. Do NOT git commit. Report green only if everything passes.`,
  { label: 'integrator', phase: 'Integrate', schema: QA_SCHEMA })

let qa = await integrate('')
for (let round = 2; round <= 3 && qa && !qa.green; round++) {
  log(`Integration round ${round}: ${qa.remaining.length} issues remaining`)
  qa = await integrate(qa.remaining.join('\n'))
}

// ---------------------------------------------------------------------------
// 6. Critique: what is missing against the requirements?
// ---------------------------------------------------------------------------
phase('Critique')
const critic = await agent(`Act as a skeptical product owner. Compare the repo against these requirements and list concrete gaps only
(missing feature, something not editable from admin, a skill without a working demo, non-responsive page, cost-incurring dependency).
${PRODUCT}`,
  { label: 'critic', phase: 'Critique', schema: GAPS_SCHEMA })

if (critic?.gaps?.length) {
  log(`Critic found ${critic.gaps.length} gaps; running a final integration pass`)
  qa = await integrate(critic.gaps.join('\n'))
}

return {
  green: !!qa?.green,
  qa: qa?.report,
  remaining: qa?.remaining || [],
  modules: done.map(r => ({ module: r.module, fixedFindings: r.fixed })),
  failedModules: failed,
  criticGaps: critic?.gaps || [],
}
