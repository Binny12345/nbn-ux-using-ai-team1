# Garage Boilerplate

> Streamlined Next.js + Firebase monorepo for student capstone projects — batteries included, beginner friendly, free-tier only.

**New here? Read the [step-by-step guide](docs/GUIDE.md)** — it walks you from clone to shipping your first feature. The system diagrams are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Note for the PR** if you cannot merge your pr is because there is a high veulnerability and the system doesn't allow for pr with high vulnerabilities to be merged. Instructions are below to fix this.

## Stack

| | |
|-|-|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 |
| **Backend** | Firebase Cloud Functions v2 · Express (single "fat lambda") |
| **Database / Auth** | Firestore · Firebase Authentication (free Spark plan) |
| **Package manager** | pnpm workspaces — always `pnpm`, never `npm`/`yarn` |
| **Testing** | Vitest · Testing Library · supertest |
| **Quality gates** | Lefthook (Conventional Commits, lint, format) · GitHub Actions CI |

There's no local emulator and no Docker — the app always talks to a real (free) Firebase project. Firebase Cloud Storage isn't used either, since real usage requires the paid Blaze plan; store file metadata in Firestore or use a free third-party host if a feature needs uploads.

## Quick Start

### 0. Prerequisites

- **Node.js 22** — [nodejs.org](https://nodejs.org)
- **pnpm** — `npm install -g pnpm`
- No Firebase CLI install needed — `npx firebase-tools` runs it on demand for rule deploys

### 1. Bootstrap

```bash
git clone https://github.com/Binny12345/nbn-ux-using-ai-team1 my-project
cd my-project
pnpm run bootstrap
```

> **Easiest path:** open the project in Claude Code and run **`/bootstrap`** — it does everything below, walks you through creating a free Firebase project, handles the common failure modes, and finishes with a verified auth smoke test.

Bootstrap installs dependencies, creates the root `.env` from `.env.example` (only if missing), and generates the per-package env files.

### 2. Connect Firebase — one env file

**All env values live in the root `.env`.** `frontend/.env.local` and `backend/.env` are generated from it by `pnpm run env:sync` (runs automatically before `pnpm run dev`) — never edit them by hand.

Create a project at [console.firebase.google.com](https://console.firebase.google.com) — the free Spark plan is enough, no billing required — then:

1. Enable **Authentication** (Email/Password + Google) and create a **Firestore** database
2. Register a **web app** (Project settings → Your apps → Web) and copy each `firebaseConfig` value into the matching `NEXT_PUBLIC_FIREBASE_*` variable in `.env`
3. Generate a **service account key** (Project settings → Service accounts), base64-encode it, and set `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` in `.env`:
   ```bash
   # macOS (BSD base64 — no -w flag)
   base64 -i service-account.json | tr -d '\n'
   # Linux (GNU base64)
   base64 -w 0 service-account.json
   # Windows PowerShell (single quotes around the path)
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\to\service-account.json'))
   ```
4. Set `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `.env` and the same id in `.firebaserc` (`projects.default`)

Full variable reference: [docs/ENV-VARS.md](docs/ENV-VARS.md).

### 3. Run

```bash
pnpm run dev
```

- App → [http://localhost:3000](http://localhost:3000)

Restart the dev server after changing `.env` — `NEXT_PUBLIC_*` variables are baked in at startup.

## Troubleshooting

| Symptom | What to try |
|--------|-------------|
| `auth/invalid-api-key` | Fill every `NEXT_PUBLIC_FIREBASE_*` value in the root `.env`, run `pnpm run env:sync`, then restart the dev server. |
| "Firebase web config is incomplete" on Vercel | A `NEXT_PUBLIC_FIREBASE_*` env var is missing in Vercel. Add it under Project Settings → Environment Variables (same names as your local `.env`), then redeploy — existing deployments don't pick up new env vars automatically. See [docs/CI-CD.md § Vercel Setup](docs/CI-CD.md#vercel-setup-frontend). |
| `Invalid project id: REPLACE_WITH_...` | Set the real project id in `.firebaserc`. |
| `'next' is not recognized` / `Command "next" not found` | Run `pnpm install` from the **repo root**. If it persists, delete all `node_modules` folders and reinstall. |
| Ignored build scripts warning from pnpm | Build approvals live in `pnpm-workspace.yaml` (`allowBuilds`) — re-run `pnpm install`. |
| "Missing or insufficient permissions" | Firestore security rules don't allow that access — add rules in `firebase/firestore.rules`, then deploy them (`npx firebase-tools deploy --only firestore:rules`). |
| Commit rejected | Message must be Conventional Commits (`feat: …`, `fix: …`). |

More beginner-oriented pitfalls: [docs/GUIDE.md § Common pitfalls](docs/GUIDE.md#6-common-pitfalls).

## Project Structure

```
/
├── frontend/          Next.js 16 App Router
│   └── src/
│       ├── app/       Pages (route groups: (auth), (dashboard))
│       ├── components/ UI components (layout, shared)
│       ├── features/  Feature modules (one folder per business domain)
│       ├── lib/       Firebase client/admin (lazy init), validations, utils
│       ├── hooks/     Custom React hooks
│       ├── providers/ React context providers
│       ├── actions/   Next.js Server Actions
│       └── types/     TypeScript type definitions
├── backend/           Cloud Functions v2 — Express fat-lambda
│   └── src/
│       ├── app.ts     Express app factory
│       ├── routes/    One file per resource
│       ├── middleware/ auth (ID token → req.user), errorHandler (RFC 9457)
│       └── lib/       firebase (Admin singleton), errors (HttpError), zodConverter
├── firebase/          Firestore rules, indexes
├── docs/              Guides and reference docs — start with GUIDE.md
└── .claude/           Claude Code harness (agents, skills, MCP, hooks)
```

## Commands

```bash
pnpm run bootstrap        # First-time: install deps, env templates
pnpm run dev              # Frontend dev server (talks to your real Firebase project)
pnpm run build            # Build all packages
pnpm run test             # Backend unit tests (mocked Firebase Admin)
pnpm run test:component   # Frontend unit tests
pnpm run test:all         # All tests
pnpm run lint             # ESLint across all packages
pnpm run format           # Prettier across all packages
pnpm run typecheck        # TypeScript check across all packages
pnpm run env:sync         # Regenerate frontend/backend env files from root .env
pnpm run validate         # Check for unreplaced template placeholders
```

## Security

Security is enforced in independent layers — Claude Code guard hooks, HTTP hardening (helmet/CORS/rate limits), token + session-cookie auth, Zod input validation, default-deny Firestore rules, and CI scanning (`pnpm audit`). See [docs/SECURITY.md](docs/SECURITY.md).

### Known `pnpm audit` findings (manual fix)


`pnpm audit` currently flags two high-severity CVEs — both transitive, dev/build-time only, not runtime-reachable:

| Package | Issue | Pulled in by |
|---------|-------|--------------|
| `js-yaml` | CVE-2026-59870 — quadratic CPU DoS on `!!omap` resolution | eslint's dependency chain (lint-time only) |
| `nanoid` | Infinite loop when a custom generator's `size` is 0 | postcss, used by Tailwind/Next/Vitest builds (build-time only) |

To patch: add these two lines under `overrides:` in `pnpm-workspace.yaml`, then run `pnpm install`:

```yaml
  js-yaml: '^4.3.1'
  nanoid: '^3.3.17'
```

Confirm with `pnpm audit` — should show 0 high/critical findings.

## Git Workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production — protected, no direct pushes |
| `feature/*` | New features → PR back to `main` |
| `hotfix/*` | Urgent fixes → PR back to `main` |

Use the Claude Code skills `/git-feature`, `/git-hotfix`, `/git-release`. Details: [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md).

## Claude Code Harness

The repo ships a pre-configured harness: three MCP servers (**context7** for live library docs, **firebase** for Firestore/deploy tooling, **stitch** for design-to-code), three sub-agents (**security-reviewer**, **doc-auditor**, **test-writer**), enforcement hooks (blocks `any`, secret prefixes, direct pushes to `main`, unapproved deploys), and skills for scaffolding and quality:

| Category | Skills |
|----------|--------|
| Setup | `/bootstrap` — guided end-to-end local setup with verification |
| Scaffolding | `/new-feature` · `/new-page` · `/new-component` · `/firebase-collection` · `/add-auth-provider` · `/add-route` · `/evolve-schema` · `/add-env-var` |
| Quality | `/verify` · `/checkpoint` · `/save-session` · `/resume-session` |
| Git | `/git-feature` · `/git-hotfix` · `/git-release` |

See [CLAUDE.md](CLAUDE.md) for the full harness reference.

## Documentation

| Topic | Link |
|-------|------|
| **Beginner guide (start here)** | [docs/GUIDE.md](docs/GUIDE.md) |
| Verified walkthrough (all steps + code) | [docs/TUTORIAL-WALKTHROUGH.md](docs/TUTORIAL-WALKTHROUGH.md) |
| Copy-paste setup (no AI, exact steps) | [docs/COPY-PASTE-SETUP.md](docs/COPY-PASTE-SETUP.md) |
| Copy-paste feature build (no AI, exact file paths) | [docs/COPY-PASTE-FEATURE.md](docs/COPY-PASTE-FEATURE.md) |
| Slide deck — system overview + AI tooling | [docs/garage-boilerplate-guide.pptx](docs/garage-boilerplate-guide.pptx) |
| Slide deck — the notes feature, step by step | [docs/notes-feature-tutorial.pptx](docs/notes-feature-tutorial.pptx) |
| Architecture + diagrams | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Frontend conventions | [docs/FRONTEND.md](docs/FRONTEND.md) |
| Backend conventions | [docs/BACKEND.md](docs/BACKEND.md) |
| Design system | [docs/DESIGN.md](docs/DESIGN.md) |
| Firestore schema | [docs/FIRESTORE-SCHEMA.md](docs/FIRESTORE-SCHEMA.md) |
| Environment variables | [docs/ENV-VARS.md](docs/ENV-VARS.md) |
| Testing | [docs/TESTING.md](docs/TESTING.md) |
| Security | [docs/SECURITY.md](docs/SECURITY.md) |
| Git workflow | [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) |
| CI/CD & deployment | [docs/CI-CD.md](docs/CI-CD.md) |

## Deployment

The frontend deploys to **Vercel** (free Hobby tier, no billing account needed — this app is server-rendered, so it needs a server host, not static hosting). 
Use this to depoy to Vercel - [DEPLOY-TO-VERCEL.md](DEPLOY-TO-VERCEL.md)



## Forking for a Client Project

Follow the checklist in [CLAUDE.md — Forking for a New Client Project](CLAUDE.md#forking-for-a-new-client-project), then run `pnpm run validate` to confirm no template placeholders remain.

## Credits

Original boilerplate by **Duc Gia Tin Huynh** ([LinkedIn](https://www.linkedin.com/in/huynhducgiatin/)).
