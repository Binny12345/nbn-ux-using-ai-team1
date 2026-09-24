import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { buildProjectContext } from '../lib/context'
import { generateReply } from '../lib/ai'

const router: ExpressRouter = Router()

const chatSchema = z
  .object({
    projectId: z.string().min(1, 'projectId is required'),
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

    const { projectId, message } = parsed.data

    const context = await buildProjectContext(projectId, user.uid)
    const reply = await generateReply(context, message)

    res.json({ reply })
  } catch (err) {
    next(err)
  }
})

export { router as chatRouter }
