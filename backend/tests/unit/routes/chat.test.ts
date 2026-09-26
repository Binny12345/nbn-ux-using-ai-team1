import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/app'
import { mockVerifyToken, mockUser } from '../../setup'
import type { ContextEntry } from '../../../src/lib/contextTypes'

vi.mock('../../../src/lib/context', () => ({
  buildProjectContext: vi.fn(),
  getUserRoleForProject: vi.fn(),
}))
vi.mock('../../../src/lib/ai', () => ({ generateReply: vi.fn(), extractEntries: vi.fn() }))
vi.mock('../../../src/lib/persistContext', () => ({ persistContext: vi.fn() }))

import { buildProjectContext, getUserRoleForProject } from '../../../src/lib/context'
import { generateReply, extractEntries } from '../../../src/lib/ai'
import { persistContext } from '../../../src/lib/persistContext'
import { HttpError } from '../../../src/lib/errors'

const app = createApp({ verifyToken: mockVerifyToken })

const sampleContext: ContextEntry[] = [
  {
    content: 'requirements go here',
    type: 'requirement',
    contributedBy: 'u1',
    role: 'BA',
    sourceChatId: 'chat1',
    status: 'Active',
  },
]

const validBody = { projectId: 'p1', sessionId: 's1', message: 'summarise the requirements' }

function authed() {
  vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
  return (body: object) =>
    request(app).post('/api/chat').set('Authorization', 'Bearer fake').send(body)
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // Default: caller is a valid project member with role BA, unless overridden per-test.
    vi.mocked(getUserRoleForProject).mockResolvedValue('BA')
  })

  it('returns 401 without a valid session', async () => {
    vi.mocked(mockVerifyToken).mockRejectedValue(new Error('invalid'))
    const res = await request(app).post('/api/chat').send(validBody)
    expect(res.status).toBe(401)
  })

  it('returns 400 when message is missing', async () => {
    const post = authed()
    const res = await post({ projectId: 'p1', sessionId: 's1' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when sessionId is missing', async () => {
    const post = authed()
    const res = await post({ projectId: 'p1', message: 'hi' })
    expect(res.status).toBe(400)
    expect(buildProjectContext).not.toHaveBeenCalled()
  })

  it('pulls context, replies, extracts entries and persists them attributed to the caller and session', async () => {
    const post = authed()
    const extracted = [{ content: 'Use CSV', type: 'decision' }]
    vi.mocked(buildProjectContext).mockResolvedValue(sampleContext)
    vi.mocked(generateReply).mockResolvedValue('Here is my response.')
    vi.mocked(extractEntries).mockResolvedValue(extracted)
    vi.mocked(persistContext).mockResolvedValue(1)

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ reply: 'Here is my response.', entriesWritten: 1 })
    expect(buildProjectContext).toHaveBeenCalledWith('p1', mockUser.uid)
    expect(getUserRoleForProject).toHaveBeenCalledWith('p1', mockUser.uid)
    expect(generateReply).toHaveBeenCalledWith(sampleContext, 'summarise the requirements', {
      uid: mockUser.uid,
      role: 'BA',
    })
    expect(extractEntries).toHaveBeenCalledWith(
      'summarise the requirements',
      'Here is my response.'
    )
    expect(persistContext).toHaveBeenCalledWith('p1', mockUser.uid, 's1', extracted)
  })

  it('reports entriesWritten from persistContext (0 when nothing durable was extracted)', async () => {
    const post = authed()
    vi.mocked(buildProjectContext).mockResolvedValue([])
    vi.mocked(generateReply).mockResolvedValue('ok')
    vi.mocked(extractEntries).mockResolvedValue([])
    vi.mocked(persistContext).mockResolvedValue(0)

    const res = await post(validBody)
    expect(res.status).toBe(200)
    expect(res.body.entriesWritten).toBe(0)
  })

  it('still returns the reply when writing context fails (write-back is best-effort)', async () => {
    const post = authed()
    vi.mocked(buildProjectContext).mockResolvedValue([])
    vi.mocked(generateReply).mockResolvedValue('Here is my response.')
    vi.mocked(extractEntries).mockResolvedValue([{ content: 'x', type: 'note' }])
    vi.mocked(persistContext).mockRejectedValue(new Error('firestore down'))

    const res = await post(validBody)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ reply: 'Here is my response.', entriesWritten: 0 })
  })

  it('does not write anything when the AI reply fails', async () => {
    const post = authed()
    vi.mocked(buildProjectContext).mockResolvedValue([])
    vi.mocked(generateReply).mockRejectedValue(
      new HttpError(502, 'Bad Gateway', 'The AI service failed to respond')
    )

    const res = await post(validBody)
    expect(res.status).toBe(502)
    expect(persistContext).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller is not a project member', async () => {
    const post = authed()
    vi.mocked(buildProjectContext).mockRejectedValue(HttpError.notFound('Project', 'p1'))
    const res = await post(validBody)
    expect(res.status).toBe(404)
    expect(generateReply).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller has no role on the project', async () => {
    const post = authed()
    vi.mocked(buildProjectContext).mockResolvedValue(sampleContext)
    vi.mocked(getUserRoleForProject).mockResolvedValue(null)

    const res = await post(validBody)
    expect(res.status).toBe(404)
    expect(generateReply).not.toHaveBeenCalled()
  })
})