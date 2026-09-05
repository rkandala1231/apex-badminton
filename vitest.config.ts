import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts (the production build config) so adding a unit-test
// runner can't affect `npm run build` / `vercel-build` in any way. Scoped to pure-function
// modules only (src/lib/standings/*) -- no jsdom/browser environment needed since nothing here
// touches React or the DOM; that's what the existing Playwright smoke test and network-mocked
// verification passes are for.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
