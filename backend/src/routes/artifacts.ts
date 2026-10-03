import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { put, del } from '@vercel/blob'
import type { AuthenticatedRequest } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { adminDb, FieldValue } from '../lib/firebase'
import { buildProjectContext } from '../lib/context'
import { generateDocument } from '../lib/ai'

const router: ExpressRouter = Router()

// Files are held in memory as a Buffer so we can hand them straight to put().
// 10mb cap — adjust to taste; keep it under the function body limit.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

/**
 * Resolve the caller's role on a project, or throw 404 if they are not a
 * member (don't leak project existence). Membership + role live in the
 * members subcollection — same source context.ts/persistContext.ts and the
 * frontend's getUserRoleForProject() use, not a field on the project doc.
 */
async function requireMember(projectId: string, uid: string): Promise<string> {
  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectSnap = await projectRef.get()
  if (!projectSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }
  const memberSnap = await projectRef.collection('members').doc(uid).get()
  if (!memberSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }
  return memberSnap.get('role') as string
}

// Express 5 types req.params values as string | string[] | undefined.
// Narrow to a plain string, 400 if missing/malformed.
function reqParam(req: Request, name: string): string {
  const v = req.params[name]
  if (typeof v !== 'string') {
    throw HttpError.badRequest(`Missing or invalid route parameter: ${name}`)
  }
  return v
}

// ── Upload ────────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/artifacts   (multipart/form-data, field "file")
router.post(
  '/:projectId/artifacts',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!BLOB_TOKEN) throw HttpError.internal('BLOB_READ_WRITE_TOKEN is not set')

      const { user } = req as AuthenticatedRequest
      const projectId = reqParam(req, 'projectId')

      if (!req.file) {
        return next(HttpError.badRequest('No file uploaded (expected field "file")'))
      }

      const role = await requireMember(projectId, user.uid)

      // Store under a project-scoped path so the blob store stays organised.
      const blob = await put(`projects/${projectId}/${req.file.originalname}`, req.file.buffer, {
        access: 'private',
        token: BLOB_TOKEN,
        contentType: req.file.mimetype,
        addRandomSuffix: true, // avoid collisions on same-named files
      })

      // Record the artifact in Firestore — this is what makes it queryable
      // and attributed. The blob holds the bytes; this holds the metadata.
      const artifactRef = adminDb
        .collection('projects')
        .doc(projectId)
        .collection('artifacts')
        .doc()

      const record = {
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        size: req.file.size,
        blobUrl: blob.url, // used to fetch/delete the blob later
        blobPathname: blob.pathname,
        uploadedBy: user.uid, // attribution: who — from the verified session
        role, // their project role at upload time
        source: 'upload', // how it was produced (the generate route writes 'ai')
        createdAt: FieldValue.serverTimestamp(),
      }

      await artifactRef.set(record)

      res.status(201).json({ id: artifactRef.id, ...record, createdAt: undefined })
    } catch (err) {
      next(err)
    }
  }
)

// ── Generate (AI) ─────────────────────────────────────────────────────────
// POST /api/projects/:projectId/artifacts/generate   body: { prompt }
// Creates a new Markdown file from the project context + the prompt. The "file" is
// produced server-side, so this is the upload route minus multer. Always create-new —
// no editing of existing artifacts, so no versioning.
const generateSchema = z
  .object({
    prompt: z.string().trim().min(1, 'prompt is required').max(4000, 'prompt is too long'),
  })
  .strict()

// Readable, filesystem- and header-safe name from the document's first "# Heading",
// falling back to the first words of the prompt.
function documentSlug(markdown: string, prompt: string): string {
  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '')

  const heading = /^#\s+(.+)$/m.exec(markdown)?.[1]
  return (
    (heading && slugify(heading)) ||
    slugify(prompt.split(/\s+/).slice(0, 6).join(' ')) ||
    'generated-document'
  )
}

// A generated file whose name is already taken in this project gets the "name_(2).md"
// style in its DISPLAYED name (per the requirements' duplicate-filename rule). The blob
// path keeps the plain slug; uniqueness there comes from addRandomSuffix.
async function uniqueFileName(projectId: string, slug: string): Promise<string> {
  const snap = await adminDb
    .collection('projects')
    .doc(projectId)
    .collection('artifacts')
    .where('fileName', '>=', slug)
    .where('fileName', '<', `${slug}\uf8ff`)
    .get()
  const taken = new Set(snap.docs.map((d) => String(d.get('fileName')).toLowerCase()))

  let name = `${slug}.md`
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${slug}_(${n}).md`
  return name
}

router.post(
  '/:projectId/artifacts/generate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!BLOB_TOKEN) throw HttpError.internal('BLOB_READ_WRITE_TOKEN is not set')

      const { user } = req as AuthenticatedRequest
      const projectId = reqParam(req, 'projectId')

      const parsed = generateSchema.safeParse(req.body)
      if (!parsed.success) {
        return next(HttpError.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input'))
      }
      const { prompt } = parsed.data

      // Membership first, so a non-member never reaches the (slow) AI call.
      const role = await requireMember(projectId, user.uid)
      const context = await buildProjectContext(projectId, user.uid)
      const markdown = await generateDocument(context, prompt)

      const slug = documentSlug(markdown, prompt)
      const fileName = await uniqueFileName(projectId, slug)
      const buffer = Buffer.from(markdown, 'utf8')

      const blob = await put(`projects/${projectId}/${slug}.md`, buffer, {
        access: 'private',
        token: BLOB_TOKEN,
        contentType: 'text/markdown',
        addRandomSuffix: true, // avoid collisions on same-named files
      })

      const artifactRef = adminDb
        .collection('projects')
        .doc(projectId)
        .collection('artifacts')
        .doc()

      // Same shape as an upload. Attribution is the triggering user's real uid
      // (stored in `uploadedBy`, the schema's attribution field); `source` marks it as AI-made.
      await artifactRef.set({
        fileName,
        contentType: 'text/markdown',
        size: buffer.length,
        blobUrl: blob.url,
        blobPathname: blob.pathname,
        uploadedBy: user.uid,
        role,
        source: 'ai',
        createdAt: FieldValue.serverTimestamp(),
      })

      // Same shape as the list route: blobUrl is deliberately not handed to the client.
      res.status(201).json({
        id: artifactRef.id,
        fileName,
        contentType: 'text/markdown',
        size: buffer.length,
        uploadedBy: user.uid,
        role,
        source: 'ai',
      })
    } catch (err) {
      next(err)
    }
  }
)

// ── List ──────────────────────────────────────────────────────────────────
// GET /api/projects/:projectId/artifacts
router.get('/:projectId/artifacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest
    const projectId = reqParam(req, 'projectId')

    await requireMember(projectId, user.uid)

    const snap = await adminDb
      .collection('projects')
      .doc(projectId)
      .collection('artifacts')
      .orderBy('createdAt', 'desc')
      .get()

    // Contributor display names for the Files panel (project members only see this).
    const uids = [
      ...new Set(snap.docs.map((d) => d.get('uploadedBy') as string | undefined)),
    ].filter((uid): uid is string => typeof uid === 'string' && uid.length > 0)
    const names = new Map<string, string | null>()
    if (uids.length > 0) {
      const userSnaps = await adminDb.getAll(
        ...uids.map((uid) => adminDb.collection('users').doc(uid))
      )
      for (const u of userSnaps) {
        names.set(u.id, (u.get('displayName') as string | null | undefined) ?? null)
      }
    }

    const artifacts = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        fileName: data.fileName,
        contentType: data.contentType,
        size: data.size,
        uploadedBy: data.uploadedBy,
        uploadedByName: names.get(data.uploadedBy) ?? null,
        role: data.role,
        // Documents created before `source` existed are uploads.
        source: data.source ?? 'upload',
        // blobUrl deliberately NOT returned — downloads go through the
        // download route below, which re-checks membership. Don't hand the
        // raw blob URL to the client.
      }
    })

    res.json({ artifacts })
  } catch (err) {
    next(err)
  }
})

// ── Download ────────────────────────────────────────────────────────────────
// GET /api/projects/:projectId/artifacts/:artifactId
// Streams the private blob after a membership check.
router.get(
  '/:projectId/artifacts/:artifactId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!BLOB_TOKEN) throw HttpError.internal('BLOB_READ_WRITE_TOKEN is not set')

      const { user } = req as AuthenticatedRequest
      const projectId = reqParam(req, 'projectId')
      const artifactId = reqParam(req, 'artifactId')

      await requireMember(projectId, user.uid)

      const artifactSnap = await adminDb
        .collection('projects')
        .doc(projectId)
        .collection('artifacts')
        .doc(artifactId)
        .get()

      if (!artifactSnap.exists) {
        throw HttpError.notFound('Artifact', artifactId)
      }
      const data = artifactSnap.data()!

      // Fetch the private blob from the store, authenticated with the token,
      // and stream it back to the member. Private blobs are not publicly
      // reachable — this Function is the only path to the bytes.
      const blobRes = await fetch(data.blobUrl, {
        headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
      })
      if (!blobRes.ok || !blobRes.body) {
        throw HttpError.internal('Failed to fetch artifact from storage')
      }

      res.setHeader('Content-Type', data.contentType ?? 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="${data.fileName}"`)
      // Don't let the CDN/proxies cache a member-gated private file.
      res.setHeader('Cache-Control', 'private, no-store')

      // Stream the body through to the client.
      const reader = blobRes.body.getReader()
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read()
        if (done) {
          res.end()
          return
        }
        res.write(Buffer.from(value))
        await pump()
      }
      await pump()
    } catch (err) {
      next(err)
    }
  }
)

// ── Delete ──────────────────────────────────────────────────────────────────
// DELETE /api/projects/:projectId/artifacts/:artifactId
// Removes both the blob and the Firestore record.
router.delete(
  '/:projectId/artifacts/:artifactId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!BLOB_TOKEN) throw HttpError.internal('BLOB_READ_WRITE_TOKEN is not set')

      const { user } = req as AuthenticatedRequest
      const projectId = reqParam(req, 'projectId')
      const artifactId = reqParam(req, 'artifactId')

      await requireMember(projectId, user.uid)

      const artifactRef = adminDb
        .collection('projects')
        .doc(projectId)
        .collection('artifacts')
        .doc(artifactId)

      const snap = await artifactRef.get()
      if (!snap.exists) {
        throw HttpError.notFound('Artifact', artifactId)
      }

      // Remove the blob first, then the record. del() is free.
      await del(snap.data()!.blobUrl, { token: BLOB_TOKEN })
      await artifactRef.delete()

      res.status(204).end()
    } catch (err) {
      next(err)
    }
  }
)

export { router as artifactsRouter }
