import type { NextConfig } from 'next'

/**
 * Security headers applied to every route.
 * CSP is intentionally not strict-dynamic: demos load WASM/model files
 * (sql.js, transformers.js, tfjs) and the theme no-flash script is inline.
 * frame-ancestors / object-src / base-uri are still locked down.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    // har-live needs motion sensors on this origin; everything else is off.
    value: 'accelerometer=(self), gyroscope=(self), magnetometer=(), camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https:" },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // app/fontPreload.ts reads the generated font CSS; ship it with pages that re-render
  // at runtime (ISR), so their HTML keeps the per-world font preloads.
  outputFileTracingIncludes: { '/**': ['./.next/static/css/*.css'] },
  // Keep native/server-only deps of in-browser ML libs out of the server bundle.
  serverExternalPackages: ['onnxruntime-node', 'sharp'],
  webpack(config, { isServer }) {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // transformers.js: browser build only (docs: huggingface.co/docs/transformers.js)
      'onnxruntime-node$': false,
      'sharp$': false,
    }
    if (!isServer) {
      // sql.js / pdfjs reference node builtins behind runtime checks.
      config.resolve.fallback = { ...(config.resolve.fallback ?? {}), fs: false, path: false, crypto: false }
    }
    return config
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}

export default nextConfig
