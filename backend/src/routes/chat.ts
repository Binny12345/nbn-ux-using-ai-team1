import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { buildProjectBriefing } from '../lib/context'
import { generateReply, extractEntries } from '../lib/ai'
import { persistContext } from '../lib/persistContext'
import { extractFileReferences, fetchArtifactContentByName } from '../lib/artifacts'

const router: ExpressRouter = Router()

// Vercel stops the function at 60s. Extraction only starts if enough of this turn's time is
// left for it to finish and write; otherwise the reply is returned and the UI is told the
// exchange wasn't saved, instead of the whole request being killed.
const TURN_DEADLINE_MS = 55_000
const MIN_EXTRACTION_MS = 4_000
const MAX_FILE_REFERENCES = 3

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
    const startedAt = Date.now()

    const parsed = chatSchema.safeParse(req.body)
    if (!parsed.success) {
      return next(HttpError.badRequest(parsed.error.errors[0]?.message ?? 'Invalid input'))
    }

    const { projectId, sessionId, message } = parsed.data

    // Full project briefing: who's talking, who else is on the project, what
    // the project is, and the shared context contributed so far.
    const briefing = await buildProjectBriefing(projectId, user.uid)

    // Checks if project is archived
    if (briefing.status === 'archived') {
      return next(
        HttpError.badRequest('This project is archived and no longer accepts new messages')
      )
    }

    // On-demand file content: only fetched when the user explicitly
    // references a file with /file(name), never on every turn.
    const referencedNames = extractFileReferences(message).slice(0, MAX_FILE_REFERENCES)
    const fileContents: { fileName: string; content: string }[] = []
    for (const name of referencedNames) {
      const content = await fetchArtifactContentByName(projectId, name)
      if (content !== null) fileContents.push({ fileName: name, content })
    }

    // Generate the reply from that briefing, including any referenced file content.
    const reply = await generateReply(briefing, message, fileContents)

    // Write side: pull durable entries from the exchange and persist them, attributed.
    // A failure here must not fail the user's chat turn, so the reply is still returned, but
    // it is no longer silent: contextSaveFailed tells the UI this exchange was not saved.
    // (An exchange with nothing worth saving is not a failure: entriesWritten is just 0.)
    let entriesWritten = 0
    let contextSaveFailed = false
    const timeLeft = TURN_DEADLINE_MS - (Date.now() - startedAt)
    if (timeLeft < MIN_EXTRACTION_MS) {
      console.warn(`skipping context extraction: only ${timeLeft}ms left in this turn`)
      contextSaveFailed = true
    } else {
      try {
        const extraction = await extractEntries(message, reply, briefing.context, {
          budgetMs: timeLeft - 1_500,
        })
        if (extraction.failed) {
          contextSaveFailed = true
        } else {
          entriesWritten = await persistContext(projectId, user.uid, sessionId, extraction.entries)
        }
      } catch (writeErr) {
        console.error('context write-back failed (reply still returned):', writeErr)
        contextSaveFailed = true
      }
    }

    res.json({ reply, entriesWritten, ...(contextSaveFailed ? { contextSaveFailed } : {}) })
  } catch (err) {
    next(err)
  }
})

export { router as chatRouter }
