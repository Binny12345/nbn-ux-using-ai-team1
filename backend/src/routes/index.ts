import { Router, type Router as ExpressRouter } from 'express'
import { chatRouter } from './chat'

const router: ExpressRouter = Router()

// Mount routes here. Use the /add-route skill to scaffold new routes.
// Example:
//   import { usersRouter } from './users'
//   router.use('/users', usersRouter)

router.use('/chat', chatRouter)

export { router as apiRouter }
