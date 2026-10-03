import { Router, type Router as ExpressRouter } from 'express'
import { chatRouter } from './chat'
import { artifactsRouter } from './artifacts'

const router: ExpressRouter = Router()

// Mount routes here. Use the /add-route skill to scaffold new routes.
// Example:
//   import { usersRouter } from './users'
//   router.use('/users', usersRouter)

router.use('/chat', chatRouter)
router.use('/projects', artifactsRouter)

export { router as apiRouter }
