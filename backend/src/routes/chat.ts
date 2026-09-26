import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { buildProjectBriefing } from '../lib/context'
import { generateReply, extractEntries } from '../lib/ai'
import { persistContext } from '../lib/persistContext'

const router: ExpressRouter = Router()

// sessionId is required so extracted entries can record which chat they came
// from (sourceChatId). The client generates it once on entering a project chat
// and sends it with every turn.
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

    // Full project briefing: who's talking, who else is on the project, what
    // the project is, and the shared context contributed so far.
    const briefing = await buildProjectBriefing(projectId, user.uid)

    // Generate the reply from that briefing.
    const reply = await generateReply(briefing, message)

    // Write side: pull durable entries from the exchange and persist them,
    // attributed. Best-effort — a failure to extract or write must not fail
    // the user's chat turn, so it is caught and logged and the reply is still
    // returned.
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