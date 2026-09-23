import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/app'
import { mockVerifyToken, mockUser } from '../../setup'
import type { ContextEntry } from '../../../src/lib/contextTypes'

vi.mock('../../../src/lib/context', () => ({ buildProjectContext: vi.fn() }))
vi.mock('../../../src/lib/ai', () => ({ generateReply: vi.fn() }))

import { buildProjectContext } from '../../../src/lib/context'
import { generateReply } from '../../../src/lib/ai'
import { HttpError } from '../../../src/lib/errors'

const app = createApp({ verifyToken: mockVerifyToken })

const sampleContext: ContextEntry[] = [
  { content: 'requirements go here', type: 'requirement', contributedBy: 'u1', role: 'BA' },
]

describe('POST /api/chat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without a valid session', async () => {
    vi.mocked(mockVerifyToken).mockRejectedValue(new Error('invalid'))
    const res = await request(app).post('/api/chat').send({ projectId: 'p1', message: 'hi' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when the body is invalid', async () => {
    vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer fake')
      .send({ projectId: 'p1' })
    expect(res.status).toBe(400)
  })

  it('pulls context, passes it to generateReply, and returns the reply', async () => {
    vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
    vi.mocked(buildProjectContext).mockResolvedValue(sampleContext)
    vi.mocked(generateReply).mockResolvedValue('Here is my response.')

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer fake')
      .send({ projectId: 'p1', message: 'summarise the requirements' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ reply: 'Here is my response.' })
    expect(buildProjectContext).toHaveBeenCalledWith('p1', mockUser.uid)
    // The pulled context array was handed to the AI as-is.
    expect(generateReply).toHaveBeenCalledWith(sampleContext, 'summarise the requirements')
  })

  it('returns 404 when the caller is not a project member', async () => {
    vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
    vi.mocked(buildProjectContext).mockRejectedValue(HttpError.notFound('Project', 'p1'))
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', 'Bearer fake')
      .send({ projectId: 'p1', message: 'hi' })
    expect(res.status).toBe(404)
  })
})
