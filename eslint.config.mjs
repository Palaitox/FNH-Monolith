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
          type: 'employees',
          pattern: 'app/employees/**/*',
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
      // ignoreRestSiblings allows destructuring a variable solely to exclude it
      // from a rest spread (e.g. `({ source, ...e }) => e`). This is standard
      // TypeScript practice and should not be flagged as unused.
      '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true }],

      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            // contracts/* must not import from buses/* or employees/*
            {
              from: ['contracts'],
              disallow: ['buses', 'employees'],
              message: 'contracts/ must not import from other modules — use (shared)/ for cross-module code',
            },
            // buses/* must not import from contracts/* or employees/*
            {
              from: ['buses'],
              disallow: ['contracts', 'employees'],
              message: 'buses/ must not import from other modules — use (shared)/ for cross-module code',
            },
            // employees/* must not import from contracts/* or buses/*
            {
              from: ['employees'],
              disallow: ['contracts', 'buses'],
              message: 'employees/ must not import from other modules — use (shared)/ for cross-module code',
            },
          ],
        },
      ],
    },
  },
]
