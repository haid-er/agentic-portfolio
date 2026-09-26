# Malik Haider Ali: portfolio ("Ground Truth Press")

A portfolio that **proves instead of claims**. Every skill, role and project links to a working demo in the playground.
It runs at zero cost on Vercel Hobby with free APIs and no database. Everything visible can be edited at `/admin`.

- Design: `DESIGN.md` (two printed worlds, **Almanac** and **Strata**)
- Architecture and ownership: `CONTRACTS.md`
- Build policy: `docs/BRIEF.md`. Source facts: `docs/context/`

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · zod · lucide-react · @vercel/analytics.
Some demos also use sql.js, transformers.js, TensorFlow.js or pdf.js, always loaded lazily.

## Local setup

```bash
# Node 20.18+ (22 recommended)
npm install          # .npmrc skips onnxruntime-node's native download (demos use the browser build)
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm test` | Vitest unit tests (`*.test.ts` next to pure modules: content schema, privacy rule, demo engines) |
| `npm run test:e2e` | Playwright e2e against `next start` on :3100 (run `npm run build` first; set `ADMIN_PASSWORD` and `ADMIN_SECRET`) |
| `npm run copy:sqljs` | Copies the sql.js WASM into `public/demos/sql-playground/` (runs on postinstall and prebuild) |

Preview a world directly with `/?theme=almanac` or `/?theme=strata`.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | for admin | Password for `/admin/login` |
| `ADMIN_SECRET` | for admin | HMAC key for the session cookie: **at least 16 characters** (32+ random bytes recommended). `next dev` works without it (a dev fallback key, flagged on the dashboard) |
| `GITHUB_TOKEN` | prod saves | Fine-grained token used to commit content (see below) |
| `GITHUB_REPO` | prod saves | `owner/repo`, e.g. `haid-er/agentic-portfolio` |
| `GITHUB_BRANCH` | prod saves | Branch to commit to (production: `main`) |
| `GROQ_API_KEY` | optional | First AI provider (free tier) |
| `GEMINI_API_KEY` | optional | Second AI provider (free tier) |
| `DEEPSEEK_API_KEY` | optional | **Paid.** Off by default in `content/ai.json`, with hard `max_tokens` and a budget |

Without AI keys, AI demos fall back to in-browser models or a clearly labelled sample, and nothing breaks.
Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Fine-grained GitHub token (for admin saves)

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. **Repository access:** *Only select repositories* → this repository only.
3. **Permissions → Repository → Contents: Read and write** on `haid-er/agentic-portfolio` only. Nothing else is needed (Metadata: read-only is added automatically).
4. Choose an expiry, copy the token, and set it as `GITHUB_TOKEN` in Vercel (Production and Preview).

## How admin saves work

1. Sign in at `/admin/login` with `ADMIN_PASSWORD`. You get an httpOnly, HMAC-signed session cookie; `middleware.ts` guards `/admin/*` and `/api/admin/*`.
2. Each editor posts the whole collection to `POST /api/admin/content/<collection>`. It is validated with the same zod schema the site uses (`lib/content/schema.ts`).
3. In **production**, the server commits `content/<collection>.json` to `GITHUB_BRANCH` through the GitHub Contents API (with sha handling and a clear commit message). Vercel sees the push and redeploys, usually in about a minute.
   In **local dev** (no `GITHUB_TOKEN`), the file is written straight to disk and the dev server hot-reloads.
4. Content is imported statically and validated at build time, so a bad edit can't reach production: the build fails and the previous deploy stays live.

Uploads (images, the résumé PDF) go to `public/uploads/` the same way.

- The dashboard's deploy tracking reads Vercel's `VERCEL_GIT_COMMIT_SHA` / `VERCEL_GIT_COMMIT_REF` system variables (keep **Automatically expose System Environment Variables** on) and only tracks deployments of `GITHUB_BRANCH`.
- Saves send the last-seen `sha`, so two editors get a 409 conflict instead of silently overwriting each other.
- Login is rate limited per instance: 5 failures per 15 minutes per IP.
- Saving `theme.json` runs the same WCAG contrast gate on the server as in the editor.

## Deploy to Vercel

The existing project **agentic-portfolio** (https://malik-haider-portfolio.vercel.app) is Git-connected to this repo.

1. Project → Settings → Git: set the **production branch to `main`**. Framework preset: Next.js (defaults are fine).
2. Project → Settings → Environment Variables: add every variable above for Production and Preview.
3. Merge into `main`. Vercel builds and deploys. Every other branch gets a preview URL.

Free APIs used without keys: carbonintensity.org.uk, PVGIS (EU JRC), Open-Meteo, and the GitHub public REST API (cached with ISR).

## Project layout

See `CONTRACTS.md` §1 for the full folder map and §6 for how to add a demo. In short:
- `content/*.json` holds the copy
- `lib/content` holds the schema and getters
- `lib/demos/registry.ts` holds the demo catalogue
- `components/demos/<slug>/` holds one demo
- `components/ui` holds the design system
