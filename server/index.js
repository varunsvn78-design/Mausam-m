/**
 * Community reporting API entry point (Phase 5).
 *
 * Starts the Express server and connects to MongoDB only when MONGODB_URI is
 * configured. Without it the server still starts in in-memory mode so the
 * frontend and demos work out of the box — the mode is reported via /api/health
 * and in every /api/reports response.
 *
 * Environment:
 *   MONGODB_URI  - optional. MongoDB connection string for persistent shared
 *                  reporting. When absent, reports are kept in memory only.
 *   PORT         - optional. Defaults to 4000.
 */

import { createApp } from './app.js'
import { initStore } from './store.js'

const PORT = Number.parseInt(process.env.PORT, 10) || 4000

async function start() {
  let startupNote

  try {
    const { persistent } = await initStore({ uri: process.env.MONGODB_URI })
    startupNote = persistent
      ? 'storage: MongoDB (persistent, shared)'
      : 'storage: in-memory (NOT persistent — set MONGODB_URI to enable shared reports)'
  } catch (error) {
    // A configured-but-unreachable database must not take the whole demo down.
    console.error(`[mausam-api] ${error.message}`)
    console.error('[mausam-api] Falling back to in-memory storage for this session.')
    await initStore({}) // no uri -> memory
    startupNote = 'storage: in-memory (MongoDB unavailable)'
  }

  const app = createApp()
  app.listen(PORT, () => {
    console.log(`[mausam-api] listening on http://localhost:${PORT}`)
    console.log(`[mausam-api] ${startupNote}`)
  })
}

start().catch((error) => {
  console.error('[mausam-api] failed to start:', error.message)
  process.exitCode = 1
})
