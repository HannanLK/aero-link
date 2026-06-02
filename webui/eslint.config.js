import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // ── TypeScript ──────────────────────────────────────────────────────────
      // API responses are untyped pending backend DTO codegen
      '@typescript-eslint/no-explicit-any': 'off',

      // ── React Hooks ─────────────────────────────────────────────────────────
      // Downgrade to warn — patterns are intentional (portal positioning, async setState)
      'react-hooks/exhaustive-deps': 'warn',
      // React hooks v7 experimental rules — patterns are intentional in this project
      'react-hooks/react-compiler': 'off',
      // setState inside useEffect is the correct pattern for derived state from props/query
      'react-hooks/set-state-in-effect': 'off',
      // Date.now() in useState initializer runs once — purity violation is acceptable
      'react-hooks/purity': 'off',

      // ── React Refresh ───────────────────────────────────────────────────────
      // Warn only; does not affect production build
      'react-refresh/only-export-components': 'warn',

      // ── General ─────────────────────────────────────────────────────────────
      // Empty catch blocks are acceptable in logout/cleanup flows
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Relax rules for generated shadcn/ui components (they export non-components)
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
