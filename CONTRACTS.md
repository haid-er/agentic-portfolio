# CONTRACTS.md: how the pieces fit

This file is binding for every builder, along with `DESIGN.md` (look and motion) and `docs/BRIEF.md` (policy).
If you need something outside your owned paths, **don't edit it**. Put it in your output `requests`, and the integrator applies it.

---

## 1. Folder map

```
app/
  layout.tsx            root: fonts, no-flash theme script, token overrides, JSON-LD, chrome, toasts, analytics   [architect]
  page.tsx              homepage: renders content sections in order via SECTION_COMPONENTS                      [architect]
  globals.css           design tokens for both worlds + Tailwind bridge + shared keyframes                       [architect]
  fonts.ts              six next/font families -> --ff-* variables                                              [architect]
  not-found.tsx error.tsx                                                                                       [shell]
  projects/[slug]/      project detail pages                                                                    [projects]
  playground/           gallery + /playground/[slug]                                                            [playground-hub]
  resume/               print-optimised résumé                                                                  [resume-contact]
  admin/                login, layout, dashboard [admin-core]; (editors)/** [admin-editors]
  api/ai/**             AI gateway routes                                                                       [ai-gateway]
  api/admin/**          login/logout/content save/upload                                                        [admin-core]
  api/github/**         GitHub activity proxy (ISR)                                                             [hero-about]
  api/demos/<x>/**      demo back-ends (telemetry, lab, limited, pvgis, items)                                  [demo modules]
  sitemap.ts robots.ts opengraph-image.tsx manifest.ts                                                          [seo-theme]
components/
  ui/**                 design-system primitives (section 4)                                                    [architect]
  layout/**             Header, Footer, ThemeSwitch, PublicOnly, SkipLink, nav, command palette                 [shell]
  sections/<Name>.tsx   homepage sections (section 6); sections/types.ts is architect-owned
  playground/**         cards, gallery, FeaturedDemo (the homepage "playground" section)                        [playground-hub]
  admin/**              admin form primitives + editors                                                         [admin-editors]
  demos/<slug>/**       one folder per demo: index.tsx (default export) + notes.ts                              [demo modules]
content/*.json          all visible copy + settings (section 3)                                                 [content editor]
lib/
  content/              schema.ts (zod) + index.ts (validated getters, COLLECTIONS)                             [architect]
  demos/                slugs.ts, registry.ts, index.ts (getDemos), loaders.tsx, notes.ts, types.ts             [architect]
  ai/**                 AI gateway: client API, types, server router, embeddings                                [ai-gateway]
  admin/**              session (HMAC cookie), save pipeline                                                    [admin-core]
  seo/** theme/**       metadata + JSON-LD; theme helpers (no-flash, overrides, setTheme/useThemeKey)           [seo-theme]
  hooks/**              useReducedMotion, useInView, usePageVisible, useLocalStorage                            [architect]
  utils.ts              cx, formatPartialDate, formatRange, folio, seeded                                       [architect]
middleware.ts           guards /admin/* and /api/admin/*                                                        [admin-core]
e2e/                    Playwright smoke tests                                                                  [integrator]
public/uploads/         admin uploads (résumé PDF, images)                                                      [content / admin]
```

## 2. Ownership

| Module | Owned paths |
|---|---|
| shell | `components/layout/**`, `app/not-found.tsx`, `app/error.tsx` |
| hero-about | `components/sections/Hero.tsx`, `About.tsx`, `GitHubActivity.tsx`, `app/api/github/**` |
| skills-experience | `components/sections/Skills.tsx`, `Experience.tsx` |
| projects | `components/sections/Projects.tsx`, `app/projects/**` |
| credentials | `components/sections/Research.tsx`, `Education.tsx`, `Certifications.tsx`, `Achievements.tsx` |
| services-testimonials | `components/sections/Services.tsx`, `Testimonials.tsx` |
| resume-contact | `components/sections/Resume.tsx`, `Contact.tsx`, `app/resume/**` |
| seo-theme | `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `app/manifest.ts`, `lib/seo/**`, `lib/theme/**` |
| admin-core | `app/admin/login/**`, `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/api/admin/**`, `lib/admin/**`, `middleware.ts` |
| admin-editors | `app/admin/(editors)/**`, `components/admin/**` |
| ai-gateway | `lib/ai/**`, `app/api/ai/**` |
| playground-hub | `app/playground/**`, `components/playground/**` |
| demos-ai-docs | `components/demos/{org-chart-extractor,esg-gap-checker,ownership-extractor}/**` |
| demos-ai-agents | `components/demos/{ask-malik,agent-orchestra,mcp-tool-lab}/**` |
| demos-ai-rag | `components/demos/{vector-space-explorer,legal-rag-assistant,prompt-cost-lab}/**` |
| demos-sensors-ml | `components/demos/{har-live,sensor-pipeline,neural-playground}/**` |
| demos-realtime | `components/demos/{rabbitmq-sim,bullmq-jobs,live-telemetry}/**`, `app/api/demos/telemetry/**` |
| demos-backend | `components/demos/{layered-api-lab,rbac-audit-lab,rate-limiter}/**`, `app/api/demos/lab/**`, `app/api/demos/limited/**` |
| demos-esg-climate | `components/demos/{ghg-calculator,grid-carbon-live,solar-pv-estimator}/**`, `app/api/demos/pvgis/**` |
| demos-product | `components/demos/{stripe-connect-flow,web-perf-lab,dispatch-board}/**` |
| demos-realtime-chat | `components/demos/{live-chat,kanban-board,data-grid}/**`, `app/api/demos/items/**` |
| demos-cs | `components/demos/{algo-visualizer,code-judge,sql-playground}/**` |
| demos-craft | `components/demos/{design-studio,theme-lab,cricket-sim}/**` |
| demos-automation | `components/demos/{automation-recorder,ci-pipeline,system-design-canvas}/**` |
| content editor | `content/**`, `public/uploads/**` |
| architect (shared, change via `requests`) | everything else listed as [architect] in section 1 |

Every file above already exists as a stub, so the app typechecks and builds. Replace stubs; keep export names and signatures.

---

## 3. Content (`lib/content`)

- `content/<name>.json` is imported statically and parsed with zod at module load. **Invalid content fails `next build`.**
- Site code uses the getters, which return **enabled items only**:
  `getSite() getProfile() getSocials() getSeo() getTheme() getSections() isSectionEnabled(id) getSection(id) getSkills() getExperience() getProjects() getProject(slug) getResearch() getEducation() getCertifications() getAchievements() getServices() getTestimonials() getResume() getPlayground() getAiConfig() projectLinks(p)`.
- Admin uses `COLLECTIONS` (`{name, file, label, description, kind, schema}`), `getRawCollection(name)` (includes disabled items) and `validateCollection(name, data)`.
- Types: `import type { Skill, Project, ... } from '@/lib/content'` (re-exported from `schema.ts`).

**Item rules.** Every list item has a unique `id` (kebab-case; project slugs and playground demo slugs are unique too, enforced by the schema), `enabled`, optional `verified` (`false` = unverified: seeded disabled, "unverified" badge in admin) and an optional `source` (provenance, admin-only, never rendered). Missing data is `""` or omitted, and **must be hidden** by the component. Never render placeholders like "TODO".

| Collection (file) | Shape (abridged) |
|---|---|
| `site` | `profile{name, headline, tagline, shortBio, location, email, phone?, avatar?, motto, pillars[{id,title,summary}], languages[{name,level}], interests[]}`, `hero{kicker[], role, lede, ctas[{label,href,variant}], plateTitle, plateNote, showGridReading, plateLayers?['collection:id']}`, `about{body[]}`, `contact{blurb, formEnabled, availability?}`, `socials[]`, `sections[{id, enabled, title, navLabel?, note?}]`, `seo{title, titleTemplate, description, keywords[], siteUrl, ogImage?, twitterHandle?, sameAs[]}`, `analytics{enabled}`, `contactFormEndpoint`, `masthead{location, strapline, colophon}`, `privacy?{excluded[]}` (extra never-render terms on top of the contract floor in `lib/content/privacy.ts`) |
| `theme` | DESIGN.md 2.4: `{default: 'auto'|'almanac'|'strata', themes: {almanac|strata: {label, reads, swapLabel, tokens: {'--bg': '#…'}}}}` |
| `skills` | `items[{name, pillar, level: core|working|exploring, demoSlugs[≥1], keywords?}]` |
| `experience` | `items[{role, org, orgUrl?, product?, location?, mode?, start, end('' = present), summary?, highlights[{text, proofDemo?}], stack[], metric?{from,to,label}}]` |
| `projects` | `items[{slug, title, summary, story[], role?, pillar, tags[], stack[], start?, end?, ongoing?, outcome?, links{live?, repo?}, private, featured, demoSlugs[], image?}]` (`private: true` never renders the repo link: use `projectLinks(p)`) |
| `research` | `items[{title, venue, volume?, article?, year, doi?, url?, authorPosition?, authorCount?, abstract?, results[{label,value,unit,note?}], resultsCaption?, bibtex?, demoSlugs[]}]`, `pipeline{enabled, title, note, steps[], demoSlug?}` |
| `education` | `items[{institution, degree, field?, location?, start, end, grade?, notes[], demoSlugs?}]` |
| `certifications` | `items[{name, issuer, date, url?, credentialId?, demoSlugs?}]` |
| `achievements` | `items[{title, detail?, date?, url?, kind, stamp?, demoSlugs?}]` |
| `services` | `items[{title, summary, icon, demoSlugs[]}]` |
| `testimonials` | `items[{quote, author, role?, org?, url?}]` (the section hides when none are enabled) |
| `resume` | `{enabled, pdfUrl, summary, expertise[], technologies[], updated}` |
| `playground` | `{intro, featured: DemoSlug, demos[{slug, enabled, title?, summary?, mirrors?}]}` |
| `ai` | `{providers{groq,gemini,deepseek: {enabled, model, visionModel?}}, maxTokens, perIpPerMinute, maxInputChars, deepseekBudgetTokens, browserFallback}` |

Dates are `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (`formatPartialDate`, `formatRange` in `lib/utils`). Hrefs are `https://…`, `mailto:`, `tel:`, `/path`, `#hash` or `""`.
Pillars: `fullstack | ai | realtime | esg | fundamentals | craft` (labels in `site.profile.pillars`).
Section ids: `hero about experience skills projects playground research education certifications achievements services testimonials github resume contact`.
Deviation from DESIGN.md: section order and visibility live in `site.sections` (not a separate `sections.json`). The theme is its own collection, `theme.json`, as DESIGN.md 2.4 describes.

---

## 4. UI primitives (`@/components/ui`)

All primitives read tokens only: no hex values, font names or theme names. World-specific styling uses the Tailwind variants `almanac:` / `strata:`.

| Export | Props / notes |
|---|---|
| `Icon` | `{name: IconName, size?, title?}`. In-house 24px family: `register arrow arrow-up-right leaders strata core pulse sine square saw flat leaf broadsheet nodes menu close search check alert info play pause step plus minus copy upload download external refresh lock mail github linkedin x facebook instagram globe phone doc`. Decorative unless `title` is given. `socialIcon(id)` maps a social id to a glyph. |
| `SwatchGlyph` | `{from, to, size?}`: the two-ink theme-control glyph |
| `Button` / `ButtonLink` | `{variant: primary\|secondary\|ghost\|danger, size: md\|sm, icon?, arrow?}`. `ButtonLink` takes `href` (internal links use next/link; external links get `rel=noopener`). `buttonClasses()` returns the classes for custom elements. |
| `Card` | `{as?, feature?, layer?: 1-6, padded?}`: Almanac border (+ hard shadow when `feature`); Strata soft shadow + 4px layer top edge |
| `SectionShell` | `{id, folio?, title, note?, aside?, hideTitle?}`: every homepage section wraps in this (folio + h2 + rhythm + scroll-margin) |
| `Mono`, `Kicker` | `Mono {as?, tone: ink\|ink-2\|ink-3\|accent}`. `Kicker {parts: string[]}` renders "A / B / C" |
| `ProofChip` | `{skill, slug, extra?, layer?}`: skill → slug chip linking to `/playground/{slug}` |
| `Tag` | mono tag (stack lists) |
| `ProofLink`, `ProofRow` | "Proof: slug →" link(s) |
| `Badge` | `{tone: neutral\|ok\|warn\|danger\|accent}`: always text |
| `Metric` | `{from, to, label?}`: the 27s → 3.5s treatment (only values from content) |
| `TableWrap`, `Table`, `Th`, `Td`, `Tr` | scroll box with edge fade (`label` is required) + mono heads + tabular nums |
| `Field`, `Input`, `Textarea`, `Select`, `Toggle` | visible mono label, 44px, hint + error wired with `aria-describedby` (client) |
| `Loading`, `EmptyState`, `ErrorState` | register-mark spinner; flat-line empty state; honest error (role=alert) |
| `Meter` | `{label, value, max?, unit?, ink?: 1-4, note?}`: accuracy bar that fills once on view (client) |
| `Segmented` | `{label, options[{value,label}], value, onChange}`: radiogroup with arrow keys (client) |
| `CopyButton` | `{text, label?, copiedLabel?, targetId?, variant?}`: clipboard copy with toast + aria-live; on failure selects `targetId` and asks for Ctrl/Cmd+C (client) |
| `Range` | `{label, value, min, max, step?, format?, onChange, hint?, disabled?}`: slider with mono read-out, 44px (client) |
| `ToastProvider`, `useToast` | `toast(message, {tone?, ms?})`. The provider is already in the root layout |
| `DemoPanel`, `DemoGrid`, `DemoToolbar` | shared demo layout: titled panel, stage/controls split at ≥900px, wrapping toolbar |

**Tailwind names** (from `app/globals.css` `@theme`):
- colours `bg bg-2 surface ink ink-2 ink-3 accent accent-2 accent-ink on-accent rule rule-soft focus ok warn danger data-1..4 layer-1..6`
- fonts `font-display font-body font-mono`
- sizes `text-00 text-0 … text-5 text-hero`
- radii `rounded-0 rounded-1 rounded-2 rounded-pill`
- shadows `shadow-plate` (= `--shadow-card`) and `shadow-press` (= `--shadow-pop`)
- spacing `p-s1 … p-s9`, `gap-s*`, `min-h-tap`
- breakpoints `xs` (480) `md` (768) `mid` (900) `lg` (1024) `xl` (1280)

Classes: `.wrap` (page container), `.display` (display type), `.mono` (mono label), `.measure`, `.nums`, `.scroll-x`, `.skip-link`.
Keyframes: `misregister contour-drift settle print-in roll-in roll-out fade-in drill spin-reg`.

**Hooks** (`@/lib/hooks`): `useReducedMotion()`, `useInView({once?, rootMargin?, threshold?})` → `[ref, inView]`, `usePageVisible()`, `useLocalStorage(key, initial)` (namespaced `ghp:`).
**Theme** (`@/lib/theme/client`): `useThemeKey()`, `setTheme(key)`, `readToken('--data-1')`. Canvas demos re-read their inks when `useThemeKey()` changes.

---

## 5. AI gateway (`@/lib/ai`)

The gateway is live; the full docs (files, router rules, cooldowns) are in `lib/ai/README.md`, which is the source of truth. Demos never call providers directly and never see keys. The router order is **groq → gemini → deepseek** (DeepSeek only when `content/ai.json` enables it, with hard `max_tokens ≤ 512` and a per-instance token budget). When every provider fails the server returns `503 quota_exhausted`; the demo may then offer the in-browser model or a clearly labelled sample.

**Client** (`import { … } from '@/lib/ai'`):
```ts
generateText(req: AiTextRequest, opts?: { signal?: AbortSignal }): Promise<AiTextResult>          // tools -> toolCalls (no streaming)
streamText(req: Omit<AiTextRequest, 'tools'>, opts?: { signal?; onToken?: (chunk: string) => void }): Promise<AiTextResult>
generateObject<S extends z.ZodType>(req: AiTextRequest & { schema: S; schemaName: string }, opts?: { signal? }): Promise<AiObjectResult<z.infer<S>>>
getAiStatus(opts?: { fresh?: boolean }): Promise<AiStatus>                                         // does not spend a rate-limit request
useAI(demo: DemoSlug, options?: { system?; maxTokens?; temperature?; browserFallback?: boolean })
  -> { run(messages, extra?), runInBrowser(messages?), abort, reset, status, text, error, meta, busy, fallback, retryIn, loadProgress }
imageToDataUrl(file: Blob, opts?: { maxSide?; type?: 'image/jpeg' | 'image/webp'; quality? }): Promise<string>  // fits the 4.5 MB body
isQuotaError(e): e is AiError        aiErrorMessage(e): string
BROWSER_MODEL, BROWSER_MODEL_DOWNLOAD ('~140 MB', SmolLM2-135M, opt-in only), AI_LIMITS, AI_HEADERS
class AiError { code: AiErrorCode; status; retryAfterSec? }
```
`AiTextRequest = { demo: DemoSlug; messages: AiMessage[]; system?; maxTokens?; temperature?; vision?; tools?: AiToolDef[] }`
`AiMessage.content` is a string or parts: `{type:'text',text}` / `{type:'image',dataUrl}` (vision).
`AiMeta` adds `route` (router trail, e.g. groq failed rate_limited → gemini ok) and `rateLimit {limit, remaining, resetSec}` (filled by the client from the headers).
`AiStatus.providers[]` carries `state` (`ready | off | no-key | cooling | budget`), `retryInSec`, `visionModel`; plus `AiStatus.vision`, `limits.maxImageBytes` / `limits.maxImages` and `deepseekBudgetLeft`.
A provider `model` / `visionModel` field may list **comma-separated alternates**, tried in order.

**Embeddings (browser)** (`@/lib/ai/embeddings`): `embed(texts, onProgress?) → Float32Array[]` (all-MiniLM-L6-v2, 384-d, normalised), `loadEmbedder()`, `cosine(a,b)`.

**Wire protocol** (`app/api/ai/**` using `lib/ai/server.ts`):
- `POST /api/ai/chat`: body `AiTextRequest & {stream?: boolean}`. With `stream: true` it sends SSE (`event: token` with a JSON string, `event: done` with `AiMeta`, `event: error` with `{code,message}`); otherwise JSON `AiTextResult`. Streams fail over only before the first token. Tools work only without streaming.
- `POST /api/ai/object`: body `AiObjectWireRequest` (adds `schemaName`, `jsonSchema` from `z.toJSONSchema`), returns `AiObjectResult<unknown>`. Vision requests are supported. The server runs one repair turn; the client validates again with zod and retries once. It rejects JSON Schemas with a `$ref` other than `#` or `#/$defs/...`, or with a `$ref` cycle that never descends through `properties`/`items`, with `400 bad_request` (recursive zod tree schemas are fine). `pattern` is enforced only by the client's zod schema.
- `GET /api/ai/status`: returns `AiStatus`.
- Timeouts: 20 s per attempt, a stream must start within 12 s, 50 s overall.

| Status | Codes |
|---|---|
| 400 | `bad_request` |
| 413 | `input_too_large` |
| 429 | `rate_limited` (with `Retry-After`) |
| 499 | `aborted` |
| 502 | `invalid_output`, `upstream` |
| 503 | `unavailable`, `quota_exhausted` (quota carries `Retry-After`) |

Errors are `{error:{code,message,retryAfterSec?}}`.
Headers on every response: `x-ai-provider`, `x-ai-model`, `ratelimit-limit|remaining|reset`, `cache-control: no-store`; when known, `x-ai-route` (e.g. `groq:rate_limited>gemini:ok`), `x-ai-latency-ms`, `x-ai-input-tokens`, `x-ai-output-tokens`.

| Limit (server-enforced) | Value |
|---|---|
| Requests per IP per minute | `ai.perIpPerMinute` (plus an instance ceiling) |
| Input characters | `ai.maxInputChars` (system + all text parts) |
| Output tokens | clamped to `min(request.maxTokens, ai.maxTokens)`; DeepSeek ≤ 512 |
| Images | ≤ `AI_LIMITS.maxImages` (4) per request, ≤ 4 MB decoded each, needs `vision: true` |
| Request body | 4.5 MB (Vercel limit): use `imageToDataUrl(file)` |
| Tools / JSON schema | ≤ 16 tools, ≤ 16,000 serialized chars |
| Demo gate | demos hidden in `content/playground.json` get `503 unavailable` |

Every AI demo **must** handle `503` (unavailable or quota) and `429` honestly: a countdown, the in-browser fallback, or a sample result, clearly labelled.

### Admin API (`app/api/admin/**`, admin session cookie required)

- `POST /api/admin/content/[collection]`: body `{data, baseSha?, note?}` (a bare collection object is also accepted) → `SaveResult {ok, mode: 'github'|'disk', sha, commitSha?, commitUrl?, unchanged?, summary?, message, code?, issues?[{path,message}]}`. Statuses: 422 `invalid` (zod issues, or the theme contrast gate for `theme`), 409 `conflict` (`baseSha` is stale), 503 `unconfigured`, 502 `upstream`, 429 `rate_limited`, 401 `unauthorized`.
- `GET /api/admin/content/[collection]` → `{ok, data, sha, mode}`: the latest stored copy (fresher than the build on Vercel).
- `POST /api/admin/upload` multipart `{file, name?}` → `{ok, url: '/uploads/x.pdf', name, bytes, kind, replaced, availableAfterDeploy}`; `GET` lists the files.
- `GET /api/admin/status` → `Activity` (recent content commits + deploy state).
- Browser helpers in `@/lib/admin/client`: `saveContent(name, data, {baseSha?, note?})`, `loadContent(name)`, `uploadFile(file, {name?})`, `listUploadsClient()`, `getActivityClient()`. All resolve (never throw), with `{ok:false, code, message}` on failure. Editors keep the returned `sha` and send it as `baseSha` on the next save.
- Without `GITHUB_TOKEN` (local `next start`/`next dev`) saves run in disk mode and write `content/<name>.json`; identical content is not rewritten.

---

## 6. Demo component contract

```
components/demos/<slug>/
  index.tsx   'use client'; export default function Demo({ slug }: DemoProps); export { notes } from './notes'
  notes.ts    export const notes: DemoNotes = { howItWorks, limits[], stack[] }   // server safe: no JSX, no browser APIs
  *.ts(x)     anything else the demo needs (workers, data, sub-components)
```
- `/playground/[slug]` loads the demo with `next/dynamic` (`ssr: false`) from `lib/demos/loaders.tsx`, and renders `notes` from `lib/demos/notes.ts`. Title, summary, mirrors, skills, runsIn and mobile note come from `lib/demos/registry.ts`, merged with admin overrides by `getDemos()` / `getDemo(slug)` in `lib/demos`.
- A demo renders **inside** the page layout. Don't render an `h1` (start at `h2`/`h3`), and don't add page margins (the page provides `.wrap`).
- Mobile first at 360px, with no horizontal overflow: wide canvases scale to the container width, and tables use `TableWrap`. If the phone experience is limited, say so (the registry `mobile` note is shown on the page).
- States: loading, empty and error are always handled (`Loading`, `EmptyState`, `ErrorState`). Live data shows a timestamp and an honest failure ("Nothing is estimated").
- Motion: honour `useReducedMotion()`. Pause canvas/rAF loops when `usePageVisible()` is false or the element is off-screen (`useInView`).
- Theme: colours only via tokens. Canvas code reads `readToken('--data-1')` etc. and redraws on `useThemeKey()` change.
- Storage: `useLocalStorage` (`ghp:` namespace). Never store secrets. Nothing leaves the browser unless the demo says so.
- Demo API routes live under `app/api/demos/<name>/**` (owned as listed). They validate input with zod, cap sizes, set `cache-control`, and never proxy to arbitrary hosts.
- Allowed extras only where needed: `sql.js`, `@huggingface/transformers`, `@tensorflow/tfjs`, `pdfjs-dist`. Import them dynamically (`await import(...)`) so they never enter shared chunks. Copy WASM/worker assets into `public/demos/<slug>/` (request it) or load them from jsDelivr.
- No chart, UI or animation libraries: draw with SVG, canvas or CSS.

---

## 7. Conventions

- TypeScript strict; `@/*` path alias. Server components by default; `'use client'` only for interaction. Keep client islands small (homepage JS stays under 150 KB gzip).
- **All user-facing text about Malik comes from content (`lib/content`) or the demo registry.** Demo UI copy (labels, instructions) may live in the demo.
- Never render: co-author or colleague names, VLAD / CCNL-FallNet / LOGICCOVE, private repo links, star counts, invented metrics.
- Never say "light mode" or "dark mode" (ESLint enforces this). The worlds have names: read `theme.themes.<key>.label`.
- Accessibility: every interactive element has a visible `:focus-visible` outline (global), 44px targets, labels for inputs, `aria-live` for async results, and colour is never the only signal.
- Links: internal links use `next/link`; external links use `target="_blank" rel="noopener noreferrer"`.
- Env vars are read only on the server (`process.env.X` in route handlers or `lib/*/server.ts`). Nothing secret is prefixed with `NEXT_PUBLIC_`.
- Allowed checks: `npm run typecheck`, `npm run lint`, `npm test` (vitest unit tests, `*.test.ts` next to pure modules). Don't run `npm install`, `next build` or `next dev` in the shared tree during the parallel build phase.
- Tests: Playwright in `e2e/` against `next start` (Chromium in `/opt/pw-browsers`, which `playwright.config.ts` sets). Run with `npm run build && npm run test:e2e`.
- `DemoProps.data` carries server-resolved content to a demo that needs it (e.g. web-perf-lab's `{reported}`), so demo chunks never import `lib/content`. PDF demos load pdf.js through `loadPdfjs()` from `@/lib/pdf` (bundled worker, works offline).
- If a CSP with `connect-src` / `img-src` / `worker-src` is ever added, allow: `api.open-meteo.com`, `geocoding-api.open-meteo.com`, `api.carbonintensity.org.uk`, `huggingface.co` + `cdn.jsdelivr.net` (transformers.js models, sql.js fallback), `tile.openstreetmap.org` (img). Keep `geolocation=(self)` in Permissions-Policy (solar-pv-estimator).
