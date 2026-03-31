import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import boundaries from 'eslint-plugin-boundaries'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  // ── Next.js core rules ────────────────────────────────────
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // ── Module boundary rules (ND-2) ─────────────────────────
  // contracts/ and buses/ may only import from (shared)/.
  // They must not import from each other.
  {
    plugins: { boundaries },

    settings: {
      'boundaries/elements': [
        {
          type: 'shared',
          pattern: 'app/\\(shared\\)/**/*',
        },
        {
          type: 'contracts',
          pattern: 'app/contracts/**/*',
        },
        {
          type: 'buses',
          pattern: 'app/buses/**/*',
        },
        {
          type: 'dashboard',
          pattern: 'app/dashboard/**/*',
        },
        {
          type: 'auth',
          pattern: 'app/auth/**/*',
        },
        {
          type: 'api',
          pattern: 'app/api/**/*',
        },
        {
          type: 'app-shell',
          pattern: 'app/\\(app\\)/**/*',
        },
      ],
      'boundaries/ignore': ['**/*.test.*', '**/*.spec.*'],
    },

    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            // contracts/* must not import from buses/*
            {
              from: ['contracts'],
              disallow: ['buses'],
              message: 'contracts/ must not import from buses/ — use (shared)/ for cross-module code',
            },
            // buses/* must not import from contracts/*
            {
              from: ['buses'],
              disallow: ['contracts'],
              message: 'buses/ must not import from contracts/ — use (shared)/ for cross-module code',
            },
          ],
        },
      ],
    },
  },
]
