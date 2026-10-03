// Runs the compiled Express app locally against real Firebase/OpenRouter/Blob —
// a manual testing shim, not how production works (production uses the Vercel
// entry in api/index.ts). See docs/TUTORIAL-WALKTHROUGH.md for the full flow.
//
// Usage (from anywhere):
//   pnpm --filter backend build
//   pnpm --filter backend run serve:local
const fs = require('fs')
const path = require('path')

// Resolve relative to this file, not process.cwd(), so it works no matter
// which directory you run it from.
const backendRoot = path.resolve(__dirname, '..')
const envPath = path.join(backendRoot, '.env')

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath} — run "pnpm run env:sync" from the repo root first.`)
  process.exit(1)
}

for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  if (line.includes('=') && line[0] !== '#') {
    const i = line.indexOf('=')
    process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

const libPath = path.join(backendRoot, 'lib', 'app.js')
if (!fs.existsSync(libPath)) {
  console.error('Missing backend/lib/app.js — run "pnpm --filter backend build" first.')
  process.exit(1)
}

const { createApp } = require(libPath)
const PORT = 5099
createApp().listen(PORT, () => console.log(`backend test server on :${PORT}`))
