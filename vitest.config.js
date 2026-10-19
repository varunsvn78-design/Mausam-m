/**
 * Vitest configuration, intentionally separate from vite.config.js so tests
 * never trigger the PWA plugin (service-worker generation) or the dev server.
 *
 * All current tests are pure Node tests for the service layer (no DOM).
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    globals: false,
  },
})
