# AI gateway (`lib/ai`, `app/api/ai`)

Free first, capped, honest. Demos never see keys or call providers directly.

```
demo ──> lib/ai (client) ──> /api/ai/{chat,object,status} ──> lib/ai/server.ts
                                                               ├─ per-IP limit, input caps, demo gate
                                                               └─ router: groq → gemini → deepseek*
                                                                          │ (each model in order, per-attempt timeouts)
                                                                          └─ all failed → 503 quota_exhausted
demo shows `ai.fallback` ──> user opts in ──> lib/ai/browser.ts (SmolLM2-135M, on device)
* DeepSeek is paid: off unless admin enables it, max_tokens ≤ 512, per-instance token budget.
```

## Files

| File | Side | What |
|---|---|---|
| `types.ts` | shared | Wire contract: `AiTextRequest`, `AiMeta` (+ `route`, `rateLimit`), `AiStatus`, `AiError`, `AI_HEADERS`, `AI_LIMITS`, `BROWSER_MODEL(_DOWNLOAD)` |
| `wire.ts` | shared | Zod schemas for request bodies |
| `index.ts` | client | `generateText`, `streamText`, `generateObject`, `getAiStatus`, `useAI`, `imageToDataUrl`, `isQuotaError`, `aiErrorMessage` |
| `browser.ts` | client | `generateInBrowser`, `loadBrowserModel` (lazy; `useAI().runInBrowser` imports it on demand) |
| `embeddings.ts` | client | `embed`, `loadEmbedder`, `cosine` (MiniLM, 384-d) |
| `server.ts` | server | `complete`, `openStream`/`stream`, `completeObject`, `getStatus`, `admit`, HTTP helpers |
| `gateway/router.ts` | server | Route planning, failover, stream first-token gate |
| `gateway/providers/*` | server | Groq + DeepSeek (OpenAI dialect), Gemini (native API) |
| `gateway/limits.ts` | server | Sliding-window per-IP limiter (+ instance ceiling), input caps |
| `gateway/health.ts` | server | Per-model cooldowns, DeepSeek budget |
| `gateway/json.ts` | server | JSON extraction + JSON Schema check (with extra-key pruning) |
| `gateway/think.ts` | server | Strips `<think>` blocks from answers, streaming-safe |

## Router rules

- Order is fixed: **groq → gemini → deepseek**. A provider is tried when admin enabled it, its env key is set, and (for images) it has a `visionModel`.
- A model field may list **alternates separated by commas** (`"gemini-3.8-flash, gemini-3.5-flash-lite"`). They are tried in order.
- Timeouts: 20 s per non-streaming attempt; streams must show a first visible token within 12 s and never go silent for 15 s; 50 s overall (`maxDuration = 60`).
- Failover: non-streaming calls move on after any provider error. Streams move on only **before** the first token; after it, an `event: error` ends the stream and the client keeps the partial text.
- Cooldowns (per provider + model, in memory): 429 → Retry-After (or 30 s), 5xx → 10–20 s, timeout → 15 s, bad key or unknown model → 5 min.
- Reasoning models are kept brief so answers fit the cap: Groq gpt-oss `reasoning_effort: low`, Qwen3 `none`, DeepSeek `none` (thinking off: its max_tokens counts reasoning, and tools fail in thinking mode), Gemini 2.5 `thinkingBudget: 0`, Gemini 3.x Flash-Lite `thinkingLevel: minimal`, other Gemini 3.x `thinkingLevel: low`. Models that cannot switch reasoning off (gpt-oss, Gemini 3.x at `low`) get +256 tokens of provider-side headroom on top of the requested cap, because their reasoning counts against it and a small cap otherwise came back empty (checked live 2026-09-26). DeepSeek never gets headroom. When a model rejects a knob (400), the request is retried once without the optional knobs.
- DeepSeek: `max_tokens ≤ 512`; before each call it reserves `estimated input + max_tokens` from `deepseekBudgetTokens` and settles with real usage.

## Limits (server-enforced)

| Limit | Value |
|---|---|
| Requests per IP per minute | `content/ai.json perIpPerMinute` (plus an instance ceiling of 10× that) |
| Input characters | `maxInputChars` (system + all text parts) |
| Output tokens | `min(request.maxTokens, maxTokens)`; DeepSeek ≤ 512 |
| Images | ≤ 4 per request, ≤ 4 MB decoded each, png/jpeg/webp/gif data URLs, needs `vision: true` |
| Request body | 4.5 MB (the Vercel limit). Use `imageToDataUrl(file)` to downscale |
| Tools / JSON schema | ≤ 16 tools, ≤ 16,000 serialized chars |
| Demo gate | demos hidden in `content/playground.json` get `503 unavailable` |

## Wire protocol

- `POST /api/ai/chat` with `AiTextRequest & {stream?}`. JSON → `AiTextResult`. With `stream: true` → SSE: `event: token` (JSON string), `event: done` (`AiMeta`), `event: error` (`{code,message}`). Tools work only without streaming.
- `POST /api/ai/object` with `AiObjectWireRequest` → `AiObjectResult<unknown>`. The server adds schema instructions, uses JSON mode (Groq/DeepSeek `json_object`, Gemini `responseJsonSchema`), validates, and runs **one repair turn** on failure. The client validates again with zod and retries once. The server check is bounded (a visit budget; `pattern` is not evaluated server-side) and rejects schemas whose `$ref` is not `#`/`#/$defs/...` or that recurse without descending into the value (`400 bad_request`); recursive tree schemas from zod are fine. DeepSeek budget: an object attempt reserves two calls' worth, affordability is re-checked right before each DeepSeek call, and failed or abandoned attempts are charged (estimated) instead of released.
- `GET /api/ai/status` → `AiStatus` with each provider's `state` (`ready | off | no-key | cooling | budget`) and this IP's `ratelimit-*` headers (it does not spend a request).
- Errors: `{error:{code,message,retryAfterSec?}}` with status 400/413/429/499/502/503; 429 and 503 quota carry `Retry-After`.
- Headers on every response: `x-ai-provider`, `x-ai-model`, `ratelimit-limit|remaining|reset`, `cache-control: no-store`; when known, `x-ai-route` (`groq:rate_limited>gemini:ok`), `x-ai-latency-ms`, `x-ai-input-tokens`, `x-ai-output-tokens`.

## Using it in a demo

```tsx
'use client'
import { useAI, aiErrorMessage, BROWSER_MODEL_DOWNLOAD } from '@/lib/ai'

const ai = useAI('ask-malik', { system: SYSTEM_PROMPT, maxTokens: 400 })
ai.run([{ role: 'user', content: question }])
// ai.status: idle | loading | streaming | done | error;  ai.text streams in
// ai.meta?.route  → show "served by gemini after groq was rate limited"
// ai.meta?.rateLimit?.remaining → "6 questions left this minute"
// ai.retryIn → live countdown after a 429
// ai.fallback → offer: "Run a small model on this device (~140 MB, nothing leaves your browser)"
//               onClick={() => ai.runInBrowser()}  with ai.loadProgress 0..1 while downloading
```

Every AI demo must still handle `503 unavailable` with an honest fallback (sample result, clearly labelled, or the in-browser path).
