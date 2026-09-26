import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for pure modules (demo engines, content rules). E2E lives in e2e/ (Playwright).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['{components,lib,app}/**/*.test.ts'],
    environment: 'node',
  },
})
