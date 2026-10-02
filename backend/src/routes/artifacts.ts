import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { put, del } from '@vercel/blob'
import type { AuthenticatedRequest } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { adminDb, FieldValue } from '../lib/firebase'

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
        createdAt: FieldValue.serverTimestamp(),
      }

      await artifactRef.set(record)

      res.status(201).json({ id: artifactRef.id, ...record, createdAt: undefined })
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

    const artifacts = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        fileName: data.fileName,
        contentType: data.contentType,
        size: data.size,
        uploadedBy: data.uploadedBy,
        role: data.role,
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
