/** Route-level smoke checks (no browser rendering). */
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
test.skip(({ viewport }) => (viewport?.width ?? 0) < 400, 'API checks run once (desktop project)')

test('GET /api/github returns ok + handle', async ({ request }) => {
  const r = await request.get('/api/github')
  expect(r.ok()).toBe(true)
  const j = await r.json()
  expect(j).toHaveProperty('ok')
  expect(j).toHaveProperty('handle')
})

test('telemetry SSE says hello; bad rate is 400', async ({ baseURL }) => {
  const ctl = new AbortController()
  const r = await fetch(`${baseURL}/api/demos/telemetry?hz=2`, { signal: ctl.signal })
  expect(r.headers.get('content-type')).toContain('text/event-stream')
  const reader = r.body!.getReader()
  const { value } = await reader.read()
  expect(new TextDecoder().decode(value)).toContain('event: hello')
  ctl.abort()
  const bad = await fetch(`${baseURL}/api/demos/telemetry?hz=99`)
  expect(bad.status).toBe(400)
})

test('rate limiter: 5 x 200 then 429 with Retry-After and RateLimit', async ({ request }) => {
  const codes: number[] = []
  let last
  for (let i = 0; i < 6; i++) { last = await request.get('/api/demos/limited?algo=sliding-window', { headers: { 'x-forwarded-for': '203.0.113.77' } }); codes.push(last.status()) }
  expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200])
  expect(codes[5]).toBe(429)
  const h = last!.headers()
  expect(h['retry-after']).toBeTruthy()
  expect(Object.keys(h).some((k) => k === 'ratelimit' || k.startsWith('ratelimit'))).toBe(true)
})

test('layered API lab: malformed JSON 400, missing site 404', async ({ request }) => {
  const headers = { 'x-lab-session': 'e2e-session-1' }
  const bad = await request.post('/api/demos/lab/sites', { data: Buffer.from('{nope'), headers: { ...headers, 'content-type': 'application/json' } })
  expect(bad.status()).toBe(400)
  expect((await bad.json()).body.error.code).toBe('MALFORMED_JSON')
  const missing = await request.get('/api/demos/lab/sites/999', { headers })
  expect(missing.status()).toBe(404)
})

test('AI status never leaks keys', async ({ request }) => {
  const r = await request.get('/api/ai/status')
  const text = await r.text()
  expect(r.ok()).toBe(true)
  expect(text).not.toMatch(/gsk_|AIza|sk-[a-z0-9]{10}/i)
  expect(JSON.parse(text)).toHaveProperty('providers')
})

test('sitemap, robots, manifest and icons resolve', async ({ request }) => {
  const sm = await (await request.get('/sitemap.xml')).text()
  expect(sm).toContain('/projects</loc>')
  expect((await request.get('/robots.txt')).ok()).toBe(true)
  const mf = await (await request.get('/manifest.webmanifest')).json()
  for (const icon of mf.icons as { src: string }[]) expect((await request.get(icon.src)).ok(), icon.src).toBe(true)
  expect((await request.get('/apple-icon')).ok()).toBe(true)
  expect((await request.get('/projects/motioniq/opengraph-image')).headers()['content-type']).toContain('image/png')
  expect((await request.get('/playground/rate-limiter/opengraph-image')).headers()['content-type']).toContain('image/png')
})

test('admin pages are noindex and gated', async ({ request }) => {
  const r = await request.get('/admin/login')
  expect(r.headers()['x-robots-tag']).toContain('noindex')
  const api = await request.post('/api/admin/content/site', { data: {} })
  expect([401, 403]).toContain(api.status())
})

test('carbon feed proxy only forwards whitelisted paths', async ({ request }) => {
  expect((await request.get('/api/demos/carbon?path=/intensity/stats/2020-01-01/2020-01-02')).status()).toBe(400)
  expect((await request.get(`/api/demos/carbon?path=${encodeURIComponent('https://evil.example/')}`)).status()).toBe(400)
})
