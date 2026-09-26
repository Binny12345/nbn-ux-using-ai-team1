import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { buildProjectContext, getUserRoleForProject } from '../lib/context'
import { generateReply, extractEntries } from '../lib/ai'
import { persistContext } from '../lib/persistContext'

const router: ExpressRouter = Router()

const chatSchema = z
  .object({
    projectId: z.string().min(1, 'projectId is required'),
    sessionId: z.string().min(1, 'sessionId is required'),
    message: z.string().min(1, 'message is required'),
  })
  .strict()

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest

    const parsed = chatSchema.safeParse(req.body)
    if (!parsed.success) {
      return next(HttpError.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input'))
    }

    const { projectId, sessionId, message } = parsed.data

    // Read side: load the project's active context, membership-gated.
    const context = await buildProjectContext(projectId, user.uid)

    // Look up the current speaker's role for this project, so the AI knows
    // who it's actually talking to right now, separate from historical context.
    const role = await getUserRoleForProject(projectId, user.uid)
    if (!role) {
      return next(HttpError.notFound('Project', projectId))
    }

    // Generate the reply, now with explicit speaker identity.
    const reply = await generateReply(context, message, { uid: user.uid, role })

    // Write side: pull durable entries from the exchange and persist them, attributed.
    let entriesWritten = 0
    try {
      const extracted = await extractEntries(message, reply)
      entriesWritten = await persistContext(projectId, user.uid, sessionId, extracted)
    } catch (writeErr) {
      console.error('context write-back failed (reply still returned):', writeErr)
    }

    res.json({ reply, entriesWritten })
  } catch (err) {
    next(err)
  }
})

export { router as chatRouter }