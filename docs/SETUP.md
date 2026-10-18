# Setup from scratch

Everything you need to run, test and deploy this project on a machine that has never seen it.
Every version below was **tested on a fresh `git clone`** with an empty package store (see
[§5 How this was tested](#5-how-this-was-tested)). Where something could not be tested here it is
marked **not tested**.

---

## 1. Tools to install

| Tool | Version to use | Why / where it comes from | Check |
|------|----------------|---------------------------|-------|
| **Node.js** | **22.23.3** — tested. 24.6.0 also tested. Other 22.x / 24.x releases should work but weren't tested | `engines.node` is `>=22` in all three `package.json` files, and CI runs Node 22. **Node 20 does not work** (see §5). | `node -v` |
| **pnpm** | **10.28.0** — tested. 11.18.0 also tested | The version Vercel installs with and CI uses (`version: 10`). The lockfile is format `9.0`; both versions read it and neither rewrites it. **Not** npm or yarn. | `pnpm -v` |
| **Git** | **2.39.5** (the version tested) | Cloning, and the commit hooks. | `git --version` |
| **Firebase CLI** | **15.34.0**, run on demand as `npx firebase-tools@15.34.0` | Only needed to deploy Firestore rules (§3, step 9). Not installed globally. Runs on Node 22.23.3 (`--version` tested). | `npx firebase-tools@15.34.0 --version` |

Install Node and pnpm, for example:

```bash
# Node (pick one): installer from https://nodejs.org (choose 22.x LTS), or
nvm install 22.23.3 && nvm use 22.23.3        # nvm
fnm install 22.23.3 && fnm use 22.23.3        # fnm

# pnpm (pick one)
npm install -g pnpm@10.28.0
corepack enable && corepack prepare pnpm@10.28.0 --activate
```

> **Do not run a bare `npm install -g pnpm`.** It installs the newest pnpm, not the one CI and Vercel use.

**Operating system:** tested on macOS 15.7.3 (Apple silicon). Linux and Windows are **not tested here**;
`.npmrc` sets `node-linker=hoisted`, which exists to help on Windows.

**Network:** the first install downloads about 900 packages plus native binaries (lefthook, esbuild,
sharp). Each `git commit` also runs `npx --yes prettier`, so committing needs internet access too.

**Optional:** a current browser (Chrome, Edge, Firefox or Safari) to use the app;
[Claude Code](https://claude.com/claude-code) for the `/bootstrap` skill and the repo's guard hooks
(`.claude/`). The app does not need either to run.

**Not needed:** Docker, Java, Python, Firebase emulators, a local database, the Vercel CLI.

### Libraries (installed by `pnpm install`, locked in `pnpm-lock.yaml`)

You never install these by hand. Listed so you know what you are running:

| Package | Version | Used by |
|---------|---------|---------|
| TypeScript | 5.9.3 | both |
| Next.js / React / React DOM | 16.2.12 / 19.2.4 / 19.2.4 | frontend |
| Tailwind CSS | 4.3.3 | frontend |
| Firebase JS SDK | 11.10.0 | frontend (browser) |
| firebase-admin | 13.10.0 (frontend) · 14.4.0 (backend) | server-side Firebase |
| react-hook-form · @hookform/resolvers · zod | 7.83.0 · 5.9.1 · 3.25.76 | forms and validation |
| Express | 5.2.1 | backend |
| openai SDK (talks to OpenRouter) | 7.23.0 — **requires Node >=22** | backend |
| @vercel/blob · multer | 2.8.0 · 2.4.0 | backend file storage |
| Vitest | 3.2.7 (frontend) · 5.0.1 (backend) | tests |
| ESLint · Prettier | 9.39.5 · 3.9.6 | lint and format |
| lefthook | 1.13.6 | git hooks |

---

## 2. Accounts you need (all have a free tier)

| Account | Needed for | What to set up |
|---------|------------|----------------|
| **GitHub** | Cloning, pull requests, and Vercel deploys from the repo | Access to `Binny12345/nbn-ux-using-ai-team1`. Set `git config user.name` and `user.email` before committing. |
| **Google account → Firebase** (Spark plan, no billing) | Sign-in and the database | See below. |
| **A real email inbox** | Signing up in the app | Sign-up sends a verification email and the app **blocks unverified users** from signing in. |
| **OpenRouter** — [openrouter.ai](https://openrouter.ai) | The AI chat | Create an API key and put it in `OPENROUTER_API_KEY`. The app only uses `:free` models, so no card is needed, but free models are rate-limited and come and go. Your daily free-model allowance is shown by `GET https://openrouter.ai/api/v1/auth/key` (this project's key shows 1000 per day; brand-new accounts may get less). |
| **Vercel** (Hobby plan is enough) | Hosting, and file storage (Blob) | Two projects plus one Blob store — see §3, step 10. |
| *(optional)* Google Stitch | The design MCP in Claude Code | `STITCH_API_KEY` |

### What the Firebase project needs

Create it at [console.firebase.google.com](https://console.firebase.google.com), then:

1. **Authentication → Sign-in method:** enable **Email/Password** and **Google** (the app uses both).
2. **Authentication → Settings → Authorized domains:** `localhost` is there by default; **add every
   domain you deploy the frontend to** (e.g. `your-app.vercel.app`) or Google sign-in fails there.
3. **Firestore Database → Create database:** Native mode, **(default)** database. Pick the location
   carefully — it cannot be changed later. (This project uses `australia-southeast2`.)
4. **Project settings → Your apps → Web app:** register one and copy its `firebaseConfig` values.
5. **Project settings → Service accounts → Generate new private key:** keep the JSON file private;
   it is base64-encoded into `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` (§3, step 5).

All five were checked against this project's live configuration (Email/Password on, Google on,
`localhost` authorized, Firestore Native in `australia-southeast2`).

---

## 3. Steps

### 1. Check your tools

```bash
node -v      # v22.23.3  (24.6.0 also tested)
pnpm -v      # 10.28.0   (11.18.0 also tested)
git --version
```

### 2. Clone and bootstrap

```bash
git clone https://github.com/Binny12345/nbn-ux-using-ai-team1 my-project
cd my-project
pnpm run bootstrap
```

`bootstrap` runs `pnpm install` (about 11 seconds), installs the git hooks, creates `.env` from
`.env.example` if it is missing, and generates `frontend/.env.local` and `backend/.env`.
It leaves `pnpm-lock.yaml` untouched.

### 3. Create the Firebase project

Follow §2. Then set the project id in **both** places — they must match:

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `.env`
- `projects.default` in `.firebaserc`

### 4. Get the other keys

OpenRouter key (§2). The Blob token is only needed once you use file uploads locally; see step 10.

### 5. Fill in the root `.env`

**Only edit the root `.env`.** `frontend/.env.local` and `backend/.env` are generated from it — never
edit those. **Do not wrap values in quotes**: the quotes become part of the value (this broke the
Blob token once — Vercel answered "Access denied").

| Variable | Where the value comes from |
|----------|----------------------------|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase → Project settings |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_MESSAGING_SENDER_ID`, `_APP_ID` | Firebase web app config |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` | The service-account JSON, base64 on one line (below) |
| `NEXT_PUBLIC_APP_NAME` | Any display name |
| `NEXT_PUBLIC_API_URL` | **Local:** `http://localhost:5099`. **Deployed:** the backend's production URL, with `https://` and no trailing slash |
| `CORS_ORIGIN` | The origin the **browser** loads the app from, exactly: `http://localhost:3000` locally (use `3001` if the dev server picks that port — see step 8), or your frontend's Vercel URL |
| `OPENROUTER_API_KEY` | OpenRouter |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store (step 10) |

Encode the service-account key:

```bash
base64 -i service-account.json | tr -d '\n'        # macOS
base64 -w 0 service-account.json                    # Linux
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\to\service-account.json'))   # Windows PowerShell
```

Variables that exist but are **not read by any code today**: `PORT`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`, `BLOB_STORE_ID`, `STITCH_API_KEY` (the last is only for Claude
Code). Leaving them empty is fine. Full reference: [ENV-VARS.md](ENV-VARS.md).

Then regenerate the per-package files:

```bash
pnpm run env:sync
```

### 6. Verify the install (needs no keys)

These need no Firebase, OpenRouter or Vercel access. Expected results on a fresh clone:

| Command | Expected |
|---------|----------|
| `pnpm run validate` | `No unreplaced placeholders found` |
| `pnpm run lint` | exit 0 |
| `pnpm run typecheck` | exit 0 |
| `pnpm run test` | backend: 86 passed |
| `pnpm run test:component` | frontend: 42 passed |
| `pnpm run build` | exit 0 (about 10 s) |

### 7. Deploy the Firestore rules

```bash
npx firebase-tools@15.34.0 login
npx firebase-tools@15.34.0 deploy --only firestore:rules --project <your-project-id>
```

**Not tested here** (it needs your Google login). Without this step the rules in
`firebase/firestore.rules` are not live.

### 8. Run it locally

The app is **two servers**; chat, files and `/generate` need both.

**Terminal 1 — frontend:**

```bash
pnpm run dev            # http://localhost:3000
```

If port 3000 is busy, Next.js uses 3001 instead (the log says so). Then set `CORS_ORIGIN` to
`http://localhost:3001`, run `pnpm run env:sync`, and restart the backend (it reads its env once, at start).

**Terminal 2 — backend** (compiled first; it runs the built output, so rebuild after backend edits):

```bash
pnpm --filter backend build
pnpm --filter backend run serve:local      # http://localhost:5099
```

The port is fixed at 5099 (`backend/scripts/dev-server.js`). Check it: `curl http://localhost:5099/api/health`
returns `{"status":"ok",…}`, and `POST /api/chat` without a token returns 401.

Open the app, sign up, **click the link in the verification email**, then sign in.

### 9. Day-to-day commands

See the command list in the [README](../README.md#commands).

### 10. Deploy to Vercel (two projects)

Import the same GitHub repo twice. Hobby is enough.

**Frontend project**

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` (**must** be this — the `vercel.json` at the repo root points at the old backend entry and would hijack `/api/auth/session` otherwise) |
| Framework | Next.js |
| Node.js Version | 22.x (set it explicitly; `engines >=22` otherwise moves up with each new Node major) |
| Env vars | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_API_URL` (the backend's production URL), `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` |

`NEXT_PUBLIC_*` values are baked in at build time — **redeploy after changing one.**

**Backend project**

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Framework preset | Other |
| Output Directory | `public` (a placeholder folder, `backend/public/.gitkeep`, is committed so this resolves) |
| Node.js Version | 22.x |
| Env vars | `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`, `CORS_ORIGIN` (the **frontend's** production URL, `https://…`, no trailing slash, no path), `OPENROUTER_API_KEY`, `BLOB_READ_WRITE_TOKEN` |

`backend/vercel.json` already routes every request to the Express app and sets `maxDuration` to 60 seconds.

**Blob store:** in the Vercel dashboard create a **Blob** store (private) and connect it to the backend
project; that provides `BLOB_READ_WRITE_TOKEN`. Paste the same token into your local `.env` without quotes.

**Deployment Protection:** only the project's production domain is public. The per-deployment URLs
(the long `…-abc123-….vercel.app` ones) require a Vercel login, so use the production domain for
`NEXT_PUBLIC_API_URL`, `CORS_ORIGIN` and Firebase's authorized domains.

Details for the frontend project are also in [DEPLOY-TO-VERCEL.md](DEPLOY-TO-VERCEL.md). The Vercel
dashboard steps above were **not re-run for this document** (they match how the live deployment is
configured and what the repo expects).

---

## 4. Troubleshooting (found while testing)

| Symptom | Cause and fix |
|---------|---------------|
| `WARN Unsupported engine: wanted {"node":">=22"}` | You are on Node 20 or older. Install Node 22+. |
| `pnpm run typecheck` fails with `implicitly has an 'any' type` / `Cannot find namespace 'FirebaseFirestore'`, or `next build` says `Cannot find module '@grpc/grpc-js'` | Same cause — Node 20. Node 22+ fixes both. |
| `pnpm run dev` prints "NEXT_PUBLIC_FIREBASE_… are empty in .env" | `.env` is still the template. Fill it in (step 5) and rerun; the dev server starts anyway but the app fails at runtime. |
| Chat says "Could not reach the chat server" | The backend (terminal 2) isn't running, or `NEXT_PUBLIC_API_URL` / `CORS_ORIGIN` don't match the ports in use. |
| `Port 3000 is in use … using available port 3001` | Expected. Update `CORS_ORIGIN` to match, restart the backend. |
| Vercel Blob returns "Access denied" | The token in `.env` (or Vercel) has quotes around it, or is from another store. |
| Sign-in says the email isn't verified | Click the link in the verification email (check spam). |

---

## 5. How this was tested

On 2026-10-18, from a fresh `git clone` of `main` into an empty folder with an **empty pnpm package store**
(nothing reused from the development machine), running `pnpm run bootstrap` and then every command in step 6:

| Node | pnpm | Install | validate | lint | typecheck | tests (backend / frontend) | build |
|------|------|:------:|:--------:|:----:|:---------:|:--------------------------:|:-----:|
| **22.23.3** | **10.28.0** | pass | pass | pass | pass | 86 / 42 pass | pass |
| 24.6.0 | 11.18.0 | pass | pass | pass | pass | 86 / 42 pass | pass |
| 20.20.2 | 10.28.0 | warns | pass | pass | **fail** | 86 / 42 pass | **fail** |

Also checked from the clean clone: with a filled-in `.env`, `pnpm run dev` serves the sign-in page (200) and
redirects signed-out visitors from `/projects` to the sign-in page (307); the backend answers
`/api/health` with 200; and the lockfile is unchanged by install under both pnpm 10.28.0 and 11.18.0.
Cloud settings (sign-in providers, authorized domains, Firestore) were read from the live project.

**Not tested:** Linux and Windows; `firebase login` and the rules deploy; creating the Vercel projects and
Blob store from scratch; signing in through the browser (it needs a real account's password).

The first clean-room run found that `pnpm run typecheck` and `pnpm run test:component` were failing on `main` itself:
`FilesSidebar.test.tsx` had not been updated when the component gained `currentUserId` and `onNewArtifacts`.
The test was fixed and extended (notifications and background polling are now covered).
