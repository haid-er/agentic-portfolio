/** Toggle copy and the representative code each optimisation stands for. */
import type { Opts } from './model'

export const TOGGLES: ReadonlyArray<{ key: keyof Opts; label: string; short: string; hint: string }> = [
  { key: 'split', label: 'Code splitting', short: 'Split', hint: 'One 4 MB bundle becomes a vendor chunk plus the dashboard route. Other routes load when opened.' },
  { key: 'lazy', label: 'Lazy loading', short: 'Lazy', hint: 'Below-the-fold tiles, avatars, invoices and customers wait until the dashboard is usable.' },
  { key: 'compress', label: 'Compression', short: 'Brotli', hint: 'Text assets (HTML, CSS, JS, JSON) travel compressed. Images and fonts are already compressed.' },
  { key: 'dedupe', label: 'Request dedupe', short: 'Dedupe', hint: 'Components share one in-flight request, and 12 per-technician calls become one batch.' },
]

export const SNIPPETS: Record<keyof Opts, string> = {
  split: `// webpack.config.js
optimization: {
  runtimeChunk: 'single',
  splitChunks: { chunks: 'all' },
}

// routes.tsx
const Invoices = lazy(() => import('./routes/Invoices'))
const Reports  = lazy(() => import('./routes/Reports'))`,
  lazy: `<img src={tile.url} loading="lazy" decoding="async" />

// mount heavy panels only when they scroll into view
const InvoicesPanel = lazy(() => import('./InvoicesPanel'))
{inView && (
  <Suspense fallback={<Skeleton />}>
    <InvoicesPanel />
  </Suspense>
)}`,
  compress: `// build: pre-compress text assets
new CompressionPlugin({
  algorithm: 'brotliCompress',
  test: /\\.(js|css|html|svg)$/,
})

// server: compress API responses
app.use(compression())`,
  dedupe: `const inflight = new Map<string, Promise<unknown>>()

export function getJSON<T>(url: string): Promise<T> {
  if (!inflight.has(url)) {
    inflight.set(url, fetch(url).then((r) => r.json())
      .finally(() => inflight.delete(url)))
  }
  return inflight.get(url) as Promise<T>
}

// N+1 -> one call
getJSON(\`/api/availability?ids=\${ids.join(',')}\`)`,
}
