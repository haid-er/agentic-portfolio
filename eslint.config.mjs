import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
  {
    ignores: [
      '.next/**', 'node_modules/**', 'out/**', 'public/**', 'design/**',
      'playwright-report/**', 'test-results/**', 'next-env.d.ts', '.claude/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      'no-restricted-syntax': ['error', {
        selector: "Literal[value=/\\b(light mode|dark mode)\\b/i]",
        message: 'The worlds have names. Never say "light mode" / "dark mode" (DESIGN.md 12).',
      }],
    },
  },
]
export default config
