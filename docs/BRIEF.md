# Build brief — Malik Haider Ali portfolio

The source of truth for every agent. Facts about Malik come **only** from `docs/context/` (`research-findings.md` wins on conflicts). The module and demo catalog lives in `.claude/workflows/build-portfolio.js`.

## 1. Product
A portfolio that **proves** instead of claims. Every skill, role and project on the site links to a working playground tool that shows it in action.

- **Zero running cost.** Vercel Hobby, free APIs only, no database.
- **Admin-configurable.** Everything visible is editable at `/admin`. Content is stored as JSON in `content/`. Saving commits through the GitHub Contents API, and Vercel then redeploys.
- **Responsive.** Mobile-first from 360px, then 768 and 1280. Every demo must be usable on a phone, or show an honest mobile fallback.
- **Accessible** (WCAG AA) and **fast**: static by default, demos lazy-loaded, homepage JS under 150 KB gzip.

## 2. Content policy
- ✅ and 🗒️ facts: publish.
- ⚠️ unverified facts: seed in content with `enabled: false`. They show in admin with an "unverified" badge.
- Excluded entirely: the VLAD fall-detection and CCNL-FallNet papers (he is not an author), LOGICCOVE, and colleague names.
- Private repos: never link or quote them. Projects derived from them are seeded disabled.
- Missing data (TODO): keep the field empty and hide it on the site. Never invent metrics.
- Use a Person JSON-LD with `sameAs` links to disambiguate him from others with the same name.

## 3. Design — "Surprise me"
A design panel of 3 designers produces distinct concepts, and a judge picks one and grafts in the best ideas from the others.

**Hard constraints**
- Banned: dark-navy with purple or cyan gradients, glassmorphism, the generic SaaS hero, Inter as the only typeface, emoji as icons.
- Needs a real point of view drawn from his story: sensor signals and HAR research, message queues and agent pipelines, ESG and decarbonisation, graphic design.
- **Two themes, both surprising, NOT "light/dark".** They are two named, distinct worlds that share one layout, for example "Field Notes" and "Signal Room". Each has its own palette, texture and accent motion.
  - The switcher is part of the experience (a memorable transition), not a sun/moon icon.
  - One theme reads light and one reads dark. `prefers-color-scheme` picks the default, and both must pass WCAG AA.
  - Admin can rename and retune both themes' tokens.
- Fonts: Google Fonts via `next/font`. Motion: CSS/canvas/SVG only, honouring `prefers-reduced-motion`.

## 4. AI policy (free-first, capped)
- Env vars: `GROQ_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`.
- Router order: Groq → Gemini → DeepSeek → in-browser fallback (transformers.js) or a graceful "demo quota reached" message.
- **DeepSeek is paid.** It is disabled in production by default (admin toggle). It has hard per-request `max_tokens`, plus a per-instance token budget.
  - During build/testing, total DeepSeek usage must stay **under 1M input and 1M output tokens**. In practice, only a few tiny smoke-test calls.
- Every AI route has:
  - per-IP rate limiting
  - input size limits
  - Zod-validated structured output
  - no secrets sent to the client
- Other free keyless APIs allowed: carbonintensity.org.uk, PVGIS (EU JRC), Open-Meteo, GitHub public REST API (cached with ISR).

## 5. Admin
- **Login:** `ADMIN_PASSWORD`. Sessions use an HMAC-signed cookie (`ADMIN_SECRET`).
- **Saving:** content is saved with `GITHUB_TOKEN` + `GITHUB_REPO` + `GITHUB_BRANCH` (production branch `main`).
- **Coverage:** editors for every collection, including section order and visibility, theme tokens, SEO, AI provider toggles and limits, and per-demo visibility.
- **Mobile:** admin must be usable on a phone.

## 6. Delivery
1. Work on the session branch, then open a PR into `main`. Merge when CI and QA are green.
2. Deploy to the **existing** Vercel project `agentic-portfolio` (URL https://malik-haider-portfolio.vercel.app, already Git-connected to this repo).
   - Set its production branch to `main`; merging the PR then deploys.
   - Do NOT touch the old `malikhaider.vercel.app` project or domain; the switch happens later, after Malik approves.
   - Vercel env: `ADMIN_PASSWORD` (from session env), `ADMIN_SECRET` (random, never printed), `GITHUB_TOKEN` (from `GITHUB_FINE_GRAIN_PERMISSION_TOKEN`), `GITHUB_REPO=haid-er/agentic-portfolio`, `GITHUB_BRANCH=main`, and the AI keys.
3. Smoke-test the live URL at 360px and 1280px, then report.
