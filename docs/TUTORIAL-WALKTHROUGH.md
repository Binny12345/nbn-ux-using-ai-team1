# Tutorial Walkthrough — Every Step, Every Code Change (Verified)

This is the companion to [GUIDE.md](GUIDE.md): the tutorial **as actually executed and
verified** — every code block below was applied to a fresh clone, compiled, passed lint/tests,
and every request in Part 3 was run for real against a live (free-tier) Firebase project
(Node 24, pnpm 11). There is no local emulator in this boilerplate — every command below runs
against your actual Firebase project. Use a separate free project for local dev so you're not
testing against production data.

**What gets built:** the "notes" feature — users create and see only their own notes.

---

## Part 1 — Setup

### 1.1 Install tools (once per machine)

- Node.js 22, pnpm (`npm install -g pnpm`)

### 1.2 Bootstrap (once per project)

```bash
pnpm run bootstrap
```

This installs dependencies, wires up git hooks, creates `.env` from `.env.example`, and
generates the per-package env files.

### 1.3 Fill the ONE env file

All configuration lives in the root `.env`. Create a free Firebase project (Spark plan, no
billing required) at [console.firebase.google.com](https://console.firebase.google.com),
enable Authentication and Firestore, then copy the web app config and service account key
into `.env` — see [GUIDE.md §2](GUIDE.md) for the exact steps.

Then sync and set the same project id in `.firebaserc`:

```bash
pnpm run env:sync        # generates frontend/.env.local + backend/.env
```

### 1.4 Run and verify the baseline

```bash
pnpm run dev
```

Verified results:

| Check | Result |
|-------|--------|
| `GET /` | ✅ 200 |
| `GET /auth/signin`, `/auth/signup` | ✅ 200 |
| `GET /dashboard` (no session) | ✅ 307 → `/auth/signin` |
| Sign-up (real Firebase Auth) → session cookie → `GET /dashboard` | ✅ 200, session cookie accepted |

---

## Part 2 — The code changes, file by file

The core feature touches nine files (Changes 1–9); there's also an optional three-file backend
API bundle (Change 10).

### Change 1 — `frontend/src/types/firestore.ts` (append)

```typescript
export interface Note {
  id: string
  uid: string // owner's user id — used by security rules
  title: string
  body: string
  createdAt: Timestamp
  updatedAt: Timestamp
  _schemaVersion: 1
}
```

### Change 2 — `frontend/src/lib/firebase/firestore.ts` (append + extend import)

```typescript
// change the existing type import:
import type { Note, UserProfile } from '@/types/firestore'

// append:
export function getNotesCollection() {
  return typedCollection<Note>('notes')
}

export function noteDoc(id: string) {
  return doc(getNotesCollection(), id)
}
```

### Change 3 — `firebase/firestore.rules` (add above the "Add new collection rules" comment)

```javascript
// notes/{noteId}
// Users can only read and write their own notes.
match /notes/{noteId} {
  allow read: if isAuthenticated() && isOwner(resource.data.uid) && notDeleted();

  allow create: if isAuthenticated() && isOwner(request.resource.data.uid)
    && request.resource.data.keys().hasAll(['uid', 'title', 'body', 'createdAt', 'updatedAt', '_schemaVersion'])
    && request.resource.data.keys().hasOnly(['uid', 'title', 'body', 'createdAt', 'updatedAt', '_schemaVersion']);

  allow update: if isAuthenticated() && isOwner(resource.data.uid)
    && request.resource.data.uid == resource.data.uid  // uid is immutable
    && request.resource.data.keys().hasOnly(['uid', 'title', 'body', 'createdAt', 'updatedAt', 'deletedAt', '_schemaVersion']);

  allow delete: if false; // soft-delete only — set deletedAt instead
}
```

Deploy the updated rules before testing them: `npx firebase-tools deploy --only firestore:rules`.

### Change 4 — `frontend/src/features/notes/actions/notes.actions.ts` (new file)

```typescript
'use server'

import { z } from 'zod'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'
import { Timestamp } from 'firebase-admin/firestore'
import type { ActionResult } from '@/types'

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(10_000),
})

export async function createNote(input: unknown): Promise<ActionResult<string>> {
  const session = await requireAuth()

  const parsed = createNoteSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }

  try {
    const now = Timestamp.now()
    const ref = await adminDb.collection('notes').add({
      ...parsed.data,
      uid: session.uid,
      createdAt: now,
      updatedAt: now,
      _schemaVersion: 1,
    })
    return { success: true, data: ref.id }
  } catch {
    return { success: false, error: 'Failed to create note' }
  }
}
```

The three-beat pattern for **every** Server Action: `requireAuth()` → Zod parse → `ActionResult`.

### Change 5 — `frontend/src/features/notes/components/CreateNoteForm.tsx` (new file)

The piece the original version of this tutorial was missing: without this, `createNote` is
defined but nothing ever calls it, and the notes list stays permanently empty.

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createNote } from '@/features/notes/actions/notes.actions'

const createNoteFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().max(10_000),
})

type CreateNoteFormInput = z.infer<typeof createNoteFormSchema>

export function CreateNoteForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateNoteFormInput>({
    resolver: zodResolver(createNoteFormSchema),
  })

  const onSubmit = async (data: CreateNoteFormInput) => {
    const result = await createNote(data)
    if (result.success) {
      toast.success('Note created')
      reset()
    } else {
      toast.error(result.error ?? 'Failed to create note')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">Title</label>
        <input
          id="title"
          type="text"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 focus:outline-none aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Note title"
          {...register('title')}
        />
        {errors.title && (
          <p id="title-error" className="text-xs text-red-500" role="alert">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="body" className="text-sm font-medium">Body</label>
        <textarea
          id="body"
          rows={3}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Write something..."
          {...register('body')}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {isSubmitting ? 'Saving…' : 'Add note'}
      </button>
    </form>
  )
}
```

No refresh needed after submit — `NotesList` below is a live `onSnapshot` subscription, so the new note appears the moment the write lands.

**`frontend/tests/unit/features/notes/CreateNoteForm.test.tsx`** (new file) — mocks the Server Action and `sonner`, then drives the form with `@testing-library/user-event` exactly like a real user would:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateNoteForm } from '@/features/notes/components/CreateNoteForm'
import { createNote } from '@/features/notes/actions/notes.actions'

vi.mock('@/features/notes/actions/notes.actions', () => ({
  createNote: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('CreateNoteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a validation error and does not call createNote when title is empty', async () => {
    const user = userEvent.setup()
    render(<CreateNoteForm />)

    await user.click(screen.getByRole('button', { name: /add note/i }))

    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    expect(createNote).not.toHaveBeenCalled()
  })

  it('submits the form and resets it on success', async () => {
    vi.mocked(createNote).mockResolvedValue({ success: true, data: 'new-note-id' })
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<CreateNoteForm />)

    await user.type(screen.getByLabelText(/title/i), 'My first note')
    await user.type(screen.getByLabelText(/body/i), 'Hello world')
    await user.click(screen.getByRole('button', { name: /add note/i }))

    await waitFor(() => {
      expect(createNote).toHaveBeenCalledWith({ title: 'My first note', body: 'Hello world' })
    })
    expect(toast.success).toHaveBeenCalledWith('Note created')
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toHaveValue('')
    })
  })

  it('shows an error toast when the action fails', async () => {
    vi.mocked(createNote).mockResolvedValue({ success: false, error: 'Failed to create note' })
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<CreateNoteForm />)

    await user.type(screen.getByLabelText(/title/i), 'My first note')
    await user.click(screen.getByRole('button', { name: /add note/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create note')
    })
  })
})
```

### Change 6 — `frontend/src/features/notes/components/NotesList.tsx` (new file)

```typescript
'use client'

import { where } from 'firebase/firestore'
import { useCollection } from '@/hooks/useFirestore'
import { useAuth } from '@/hooks/useAuth'
import { getNotesCollection } from '@/lib/firebase/firestore'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

export function NotesList() {
  const { user } = useAuth()
  const { data: notes, loading } = useCollection(getNotesCollection(), where('uid', '==', user?.uid ?? ''))

  if (loading) return <LoadingSpinner />
  if (notes.length === 0) return <EmptyState title="No notes yet" />

  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border p-4">
          <h3 className="font-medium">{note.title}</h3>
          <p className="text-sm text-zinc-500">{note.body}</p>
        </li>
      ))}
    </ul>
  )
}
```

### Change 7 — `frontend/src/app/(dashboard)/notes/page.tsx` (new file)

```typescript
import type { Metadata } from 'next'
import { requireAuth } from '@/actions/auth.actions'
import { PageHeader } from '@/components/layout/PageHeader'
import { CreateNoteForm } from '@/features/notes/components/CreateNoteForm'
import { NotesList } from '@/features/notes/components/NotesList'

export const metadata: Metadata = { title: 'Notes' }

export default async function NotesPage() {
  await requireAuth()
  return (
    <div className="space-y-6">
      <PageHeader title="Notes" description="Your personal notes" />
      <CreateNoteForm />
      <NotesList />
    </div>
  )
}
```

### Change 8 — `frontend/src/components/layout/Sidebar.tsx` (two-line diff)

```diff
-import { LayoutDashboard, User, Settings } from 'lucide-react'
+import { LayoutDashboard, StickyNote, User, Settings } from 'lucide-react'

 const navItems = [
   { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
+  { href: '/notes', label: 'Notes', icon: StickyNote },
   { href: '/profile', label: 'Profile', icon: User },
```

### Change 9 — `docs/FIRESTORE-SCHEMA.md` (append)

```markdown
## `notes` collection

**Path:** `/notes/{noteId}`
**Access:** Owner-only

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | `string` | Yes | Owner's Firebase Auth UID |
| `title` | `string` | Yes | Note title (1–200 chars) |
| `body` | `string` | Yes | Note body (≤10 000 chars) |
| `createdAt` | `Timestamp` | Yes | Creation time |
| `updatedAt` | `Timestamp` | Yes | Last update time |
| `_schemaVersion` | `1` | Yes | Schema version for lazy migration |
```

### Change 10 (optional) — backend API endpoint

**`backend/src/routes/notes.ts`** (new file):

```typescript
import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { adminDb } from '../lib/firebase'

const router: ExpressRouter = Router()

const createNoteSchema = z
  .object({
    title: z.string().min(1).max(200),
    body: z.string().max(10_000),
  })
  .strict()

/**
 * GET /api/notes
 * List the authenticated user's notes.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest
    const snap = await adminDb.collection('notes').where('uid', '==', user.uid).get()
    res.json({ notes: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/notes
 * Create a note owned by the authenticated user.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest

    const parsed = createNoteSchema.safeParse(req.body)
    if (!parsed.success) {
      return next(HttpError.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input'))
    }

    const ref = adminDb.collection('notes').doc()
    await ref.set({ ...parsed.data, uid: user.uid, _schemaVersion: 1 })

    res.status(201).json({ id: ref.id })
  } catch (err) {
    next(err)
  }
})

export { router as notesRouter }
```

**`backend/src/routes/index.ts`** (mount it):

```diff
 import { Router, type Router as ExpressRouter } from 'express'
+import { notesRouter } from './notes'

 const router: ExpressRouter = Router()
+
+router.use('/notes', notesRouter)
```

**`backend/tests/unit/routes/notes.test.ts`** (new file):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/app'
import { mockVerifyToken, mockUser } from '../../setup'
import { adminDb } from '../../../src/lib/firebase'

const app = createApp({ verifyToken: mockVerifyToken })

describe('Notes routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/notes', () => {
    it('returns 401 without a token', async () => {
      vi.mocked(mockVerifyToken).mockRejectedValue(new Error('invalid'))
      const res = await request(app).get('/api/notes')
      expect(res.status).toBe(401)
    })

    it('returns 200 with the user notes for authenticated request', async () => {
      vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
      const get = vi.fn().mockResolvedValue({
        docs: [{ id: 'n1', data: () => ({ uid: mockUser.uid, title: 'A', body: 'B' }) }],
      })
      const where = vi.fn().mockReturnValue({ get })
      vi.mocked(adminDb.collection).mockReturnValue({ where } as never)

      const res = await request(app).get('/api/notes').set('Authorization', 'Bearer fake-token')
      expect(res.status).toBe(200)
      expect(res.body.notes).toHaveLength(1)
      expect(where).toHaveBeenCalledWith('uid', '==', mockUser.uid)
    })
  })

  describe('POST /api/notes', () => {
    it('returns 400 for invalid input', async () => {
      vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer fake-token')
        .send({ title: '' })
      expect(res.status).toBe(400)
      expect(res.body.title).toBe('Bad Request')
    })

    it('returns 201 and the new id for valid input', async () => {
      vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
      const set = vi.fn().mockResolvedValue(undefined)
      const doc = vi.fn().mockReturnValue({ id: 'new-note-id', set })
      vi.mocked(adminDb.collection).mockReturnValue({ doc } as never)

      const res = await request(app)
        .post('/api/notes')
        .set('Authorization', 'Bearer fake-token')
        .send({ title: 'First', body: 'Hello' })
      expect(res.status).toBe(201)
      expect(res.body.id).toBe('new-note-id')
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ uid: mockUser.uid, _schemaVersion: 1 }),
      )
    })
  })
})
```

---

## Part 3 — Verification (executed and verified)

### Quality gates

| Gate | Command | Result |
|------|---------|--------|
| No unreplaced placeholders | `pnpm run validate` | ✅ |
| Types | `pnpm run typecheck` (both packages) | ✅ |
| Lint | `pnpm run lint` (both packages) | ✅ |
| Backend unit tests | `pnpm run test` | ✅ 9/9 — includes the conventions test and the 4 new notes-route tests |
| Frontend unit tests | `pnpm run test:component` | ✅ 9/9 — includes 3 new `CreateNoteForm` tests: validation blocks submit, successful submit calls the action and resets the form, failure shows an error toast (driven with `@testing-library/user-event`, not just rendered) |
| Production build | `pnpm run build` | ✅ `/notes` appears in the route tree as a dynamic (server-rendered) route |

### Routes

| Check | Result |
|-------|--------|
| `GET /notes` without session | ✅ 307 → `/auth/signin` |
| `GET /notes` with session | ✅ 200, no server errors |

### Security rules — verified with real HTTP calls against a live Firebase project

After `npx firebase-tools deploy --only firestore:rules`, two throwaway test users were created via the
Identity Toolkit REST API and used to hit the Firestore REST API directly — the same rules the
client SDK is subject to:

| Operation | Expected | Result |
|-----------|----------|--------|
| Owner creates their own note | allow → 200 | ✅ 200 |
| Another user creates a note pretending to be owner (forged `uid`) | deny → 403 | ✅ 403 |
| Owner reads their note | allow → 200 | ✅ 200 |
| Another user reads the owner's note | deny → 403 | ✅ 403 |
| Unauthenticated read | deny → 403 | ✅ 403 |
| Owner hard-deletes (soft-delete only) | deny → 403 | ✅ 403 |

Both test notes and both test users were deleted afterward via the Admin SDK.

### Optional backend API — verified against real Firestore

The Express route was run locally (see the appendix for how, since there's no `pnpm run
emulator` or Functions runner in this boilerplate) and exercised with a real ID token:

| Request | Expected | Result |
|---------|----------|--------|
| `GET /api/notes` without a token | 401 | ✅ 401 |
| `GET /api/notes` with a token, no notes yet | 200, `{ notes: [] }` | ✅ 200 |
| `POST /api/notes` with `{ title: "" }` | 400 | ✅ 400 |
| `POST /api/notes` with valid input | 201, `{ id }` | ✅ 201 |
| `GET /api/notes` again | 200, the created note | ✅ 200, 1 note returned |

### Git workflow

| Check | Expected |
|-------|----------|
| `git commit -m "feat: add notes feature"` on `feature/notes` | accepted |
| `git commit -m "this is not conventional"` | **rejected** by the commit-msg hook |

---

## Appendix — replicating the rules test yourself

With a test user created via the sign-up page (or the Identity Toolkit REST API below), you can
hit Firestore directly with the user's ID token to confirm the rules behave as expected:

```bash
API_KEY=<NEXT_PUBLIC_FIREBASE_API_KEY from .env>
PROJECT_ID=<NEXT_PUBLIC_FIREBASE_PROJECT_ID from .env>

# get a token
curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@test.com","password":"test1234","returnSecureToken":true}'

# try to read someone else's note with it → expect 403
curl -s -o /dev/null -w '%{http_code}' \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/notes/<noteId>" \
  -H "Authorization: Bearer <idToken>"
```

Use a throwaway test user in your dev Firebase project — delete it afterwards from the Firebase
console (Authentication → Users).

## Appendix — running the backend Express app locally (no emulator, no Functions runner)

`pnpm --filter backend run dev` only type-checks and watches — it doesn't start an HTTP server
(the Cloud Function entry in `src/index.ts` needs the Functions runtime to invoke it, and the
Vercel entry in `api/index.ts` needs Vercel's runtime). To exercise `backend/` routes locally
against real Firestore, build it and run the `serve:local` script, from anywhere in the repo:

```bash
pnpm --filter backend build       # compiles src/ -> lib/
pnpm --filter backend run serve:local   # starts createApp() on :5099, reading backend/.env
```

(`backend/scripts/dev-server.js` is the script behind this — resolves `backend/.env` relative to
itself, so it works whether you run it from the repo root or from inside `backend/`.)

Then hit it with a real ID token (from the sign-up REST call above):

```bash
curl -s http://localhost:5099/api/notes -H "Authorization: Bearer $IDTOKEN"
curl -s -X POST http://localhost:5099/api/notes \
  -H "Authorization: Bearer $IDTOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Test","body":"Hello"}'
```

Stop the process (`Ctrl+C` or `kill`) when done — this is a manual testing shim, not something
the app runs in production (production uses the real Cloud Function entry point).
