import { createApp } from '../src/app'

const app = createApp()

// Vercel terminates TLS at its proxy; trust one hop so req.ip (used by the rate limiter) is the real client.
app.set('trust proxy', 1)

export default app
