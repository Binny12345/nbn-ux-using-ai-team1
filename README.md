# NBN UX Design Practices Using AI

A shared project workspace where a team (Project Manager, Business Analyst, UX Designer, Developer) chats with an AI assistant that remembers what the team has decided. Decisions, requirements and notes from every chat are saved as attributed **shared context**, and uploaded files and AI-generated documents are available to the whole project.

Built by RMIT Capstone Team 21 for NBN. Handed over as **`v1.0-handover`**.

## Handover documentation

The full documentation is in the **Handover Document**: `https://rmiteduau.sharepoint.com/:w:/r/sites/CapstoneProgrammingProject2026-21-NBN-UXDesignPracticesUsingAITeam1/Shared%20Documents/Client%20Project%20-%20NBN/Final%20Presentation%20+%20Handover/21%20-%20NBN%20UX%20Design%20Practices%20Using%20AI%20-%20handover.docx?d=wd1708fbed41845f6ab85023a5410d041&csf=1&web=1&e=5zFDvO`

| You want to... | Go to |
|---|---|
| Set the project up from scratch (accounts, env vars, local run) | **Section 9.1**, Reproducing This Project From Scratch |
| Understand how the system is built | **Section 5**, Architecture: 5.1 System Context Diagram, 5.2 Architecture Overview, 5.4 Key Technical Decisions |
| Deploy and operate it | **Section 9.2**, Deployment & Operations |
| See known issues and technical debt | **Section 9.4**, Known Issues & Technical Debt |

This README is the quick start. If it disagrees with the Handover Document, the Handover Document wins.

## Release

| | |
|---|---|
| Tag | `v1.0-handover` |
| Production | `https://nbn-ux-using-ai-team1-backend.vercel.app/` |


## Stack

| | |
|-|-|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 |
| **Backend** | Express 5 on Node 22, deployed on Vercel (60 s function limit) |
| **Database / Auth** | Firestore · Firebase Authentication |
| **AI** | OpenRouter (OpenAI-compatible SDK) with an ordered fallback list of free models |
| **File storage** | Vercel Blob (private), metadata in Firestore |
| **Package manager** | pnpm workspaces. Always `pnpm`, never `npm` or `yarn` |
| **Testing** | Vitest · Testing Library · supertest |
| **Quality gates** | Lefthook (Conventional Commits, lint, format) · GitHub Actions CI |

There is no local emulator and no Docker. The app always talks to a real Firebase project.

## Quick start

For the complete, verified setup (accounts, keys and how to obtain them), use **Handover Document section 9.1**. The short version:

### 0. Prerequisites

- **Node.js 22**
- **pnpm**: `npm install -g pnpm`
- A Firebase project (Authentication and Firestore enabled), an OpenRouter API key and a Vercel Blob read/write token

### 1. Bootstrap

```bash
git clone https://github.com/Binny12345/nbn-ux-using-ai-team1
cd nbn-ux-using-ai-team1
pnpm run bootstrap
```

Bootstrap installs dependencies and creates the root `.env` from `.env.example` if it is missing.

### 2. Configure environment

**All values live in the root `.env`.** `frontend/.env.local` and `backend/.env` are generated from it by `pnpm run env:sync` (this runs automatically before `pnpm run dev`). Never edit the generated files by hand.

Key variables (full reference in [docs/ENV-VARS.md](docs/ENV-VARS.md) and Handover Document section 9.1):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web app config (public by design) |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` | Base64 service account key for the backend (**secret**) |
| `OPENROUTER_API_KEY` | AI model access (**secret**) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob file storage (**secret**) |
| `NEXT_PUBLIC_API_URL` | URL of the backend the frontend calls |

Never commit `.env`, the service account JSON or its base64. Never put a secret in a `NEXT_PUBLIC_*` variable, because those are shipped to the browser.

### 3. Run

```bash
pnpm run dev
```

App at [http://localhost:3000](http://localhost:3000). Restart the dev server after changing `.env`.

## Commands

```bash
pnpm run bootstrap        # First-time: install deps, env templates
pnpm run dev              # Dev server
pnpm run build            # Build all packages
pnpm run test             # Backend unit tests (mocked Firebase Admin)
pnpm run test:component   # Frontend unit tests
pnpm run test:all         # All tests
pnpm run lint             # ESLint across all packages
pnpm run format           # Prettier across all packages
pnpm run typecheck        # TypeScript check across all packages
pnpm run env:sync         # Regenerate frontend/backend env files from root .env
```

## Project structure

```
/
├── frontend/          Next.js App Router
│   └── src/
│       ├── app/        Pages
│       ├── features/   Feature modules (chat, projects, files, ...)
│       ├── components/ Shared UI
│       └── lib/        Firebase client, utilities
├── backend/           Express API
│   └── src/
│       ├── routes/     One file per resource (chat, projects, artifacts, ...)
│       ├── middleware/ Firebase ID-token auth, RFC 9457 error handler
│       └── lib/        Firebase Admin, AI (OpenRouter), errors
├── firebase/          Firestore rules and indexes
├── docs/              Reference docs
└── scripts/           Env sync and tooling
```

## Troubleshooting

| Symptom | What to try |
|--------|-------------|
| `auth/invalid-api-key` | Fill every `NEXT_PUBLIC_FIREBASE_*` value in the root `.env`, run `pnpm run env:sync`, restart the dev server. |
| "Firebase web config is incomplete" on Vercel | A `NEXT_PUBLIC_FIREBASE_*` variable is missing in Vercel. Add it, then redeploy (existing deployments don't pick up new variables). |
| AI replies fail or time out | The free OpenRouter models can be slow or unavailable. See Handover Document section 9.4. |
| `'next' is not recognized` | Run `pnpm install` from the repo root. |
| "Missing or insufficient permissions" | Check `firebase/firestore.rules`, then deploy them with `npx firebase-tools deploy --only firestore:rules`. |
| Commit rejected | The message must follow Conventional Commits (`feat: ...`, `fix: ...`). |

## Git workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production. Protected, no direct pushes |
| `feature/*` | New features, PR back to `main` |
| `hotfix/*` | Urgent fixes, PR back to `main` |

Details: [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md).

## Deployment

Frontend and backend deploy to **Vercel**. Steps: [DEPLOY-TO-VERCEL.md](DEPLOY-TO-VERCEL.md) and Handover Document section 9.2.

## Other documentation

| Topic | Link |
|-------|------|
| Architecture (template diagrams) | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Frontend / Backend conventions | [docs/FRONTEND.md](docs/FRONTEND.md) · [docs/BACKEND.md](docs/BACKEND.md) |
| Firestore schema | [docs/FIRESTORE-SCHEMA.md](docs/FIRESTORE-SCHEMA.md) |
| Environment variables | [docs/ENV-VARS.md](docs/ENV-VARS.md) |
| Testing · Security · CI/CD | [docs/TESTING.md](docs/TESTING.md) · [docs/SECURITY.md](docs/SECURITY.md) · [docs/CI-CD.md](docs/CI-CD.md) |

Some files in `docs/` come from the original template and may not match this project (see Handover Document section 9.4).

## Credits

Built on the Garage Boilerplate by **Duc Gia Tin Huynh** ([LinkedIn](https://www.linkedin.com/in/huynhducgiatin/)).
