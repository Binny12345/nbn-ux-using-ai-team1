import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/app'
import { mockVerifyToken, mockUser } from '../../setup'
import type { ProjectBriefing } from '../../../src/lib/contextTypes'

vi.mock('../../../src/lib/context', () => ({ buildProjectBriefing: vi.fn() }))
vi.mock('../../../src/lib/ai', () => ({ generateReply: vi.fn(), extractEntries: vi.fn() }))
vi.mock('../../../src/lib/persistContext', () => ({ persistContext: vi.fn() }))
vi.mock('../../../src/lib/artifacts', () => ({
  extractFileReferences: vi.fn(),
  fetchArtifactContentByName: vi.fn(),
  listProjectArtifacts: vi.fn(),
}))

import { buildProjectBriefing } from '../../../src/lib/context'
import { generateReply, extractEntries } from '../../../src/lib/ai'
import { persistContext } from '../../../src/lib/persistContext'
import { extractFileReferences, fetchArtifactContentByName } from '../../../src/lib/artifacts'
import { HttpError } from '../../../src/lib/errors'

const app = createApp({ verifyToken: mockVerifyToken })

const sampleBriefing: ProjectBriefing = {
  projectName: 'Test Project',
  projectDescription: 'A test project',
  status: 'active',
  members: [{ uid: mockUser.uid, role: 'BA', displayName: 'Test User' }],
  currentUser: { uid: mockUser.uid, role: 'BA' },
  context: [
    {
      id: 'c1',
      content: 'requirements go here',
      type: 'requirement',
      contributedBy: 'u1',
      role: 'BA',
      sourceChatId: 'chat1',
      status: 'Active',
    },
  ],
  artifacts: [],
}

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
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(buildProjectBriefing).mockResolvedValue(sampleBriefing)
    vi.mocked(extractFileReferences).mockReturnValue([])
    vi.mocked(generateReply).mockResolvedValue('Here is my response.')
    vi.mocked(extractEntries).mockResolvedValue({ entries: [], failed: false })
    vi.mocked(persistContext).mockResolvedValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
    expect(buildProjectBriefing).not.toHaveBeenCalled()
  })

  it('replies, extracts entries against the existing context, and persists them attributed to the caller and session', async () => {
    const post = authed()
    const entries = [{ content: 'Use CSV', type: 'decision' as const }]
    vi.mocked(extractEntries).mockResolvedValue({ entries, failed: false })
    vi.mocked(persistContext).mockResolvedValue(1)

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ reply: 'Here is my response.', entriesWritten: 1 })
    expect(buildProjectBriefing).toHaveBeenCalledWith('p1', mockUser.uid)
    expect(generateReply).toHaveBeenCalledWith(sampleBriefing, 'summarise the requirements', [])
    expect(extractEntries).toHaveBeenCalledWith(
      'summarise the requirements',
      'Here is my response.',
      sampleBriefing.context,
      { budgetMs: expect.any(Number) }
    )
    expect(persistContext).toHaveBeenCalledWith('p1', mockUser.uid, 's1', entries)
  })

  it('gives the AI the content of files referenced with /file(name), skipping ones it cannot read', async () => {
    const post = authed()
    vi.mocked(extractFileReferences).mockReturnValue(['plan.md', 'missing.md'])
    vi.mocked(fetchArtifactContentByName).mockImplementation(async (_projectId, name) =>
      name === 'plan.md' ? '# The plan' : null
    )

    await post({ ...validBody, message: 'read /file(plan.md) and /file(missing.md)' })

    expect(generateReply).toHaveBeenCalledWith(
      sampleBriefing,
      'read /file(plan.md) and /file(missing.md)',
      [{ fileName: 'plan.md', content: '# The plan' }]
    )
  })

  it('reads at most 3 referenced files per message', async () => {
    const post = authed()
    vi.mocked(extractFileReferences).mockReturnValue(['a.md', 'b.md', 'c.md', 'd.md', 'e.md'])
    vi.mocked(fetchArtifactContentByName).mockResolvedValue('x')

    await post(validBody)

    expect(fetchArtifactContentByName).toHaveBeenCalledTimes(3)
  })

  it('treats "nothing worth saving" as success: no failure flag, entriesWritten 0', async () => {
    const post = authed()

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ reply: 'Here is my response.', entriesWritten: 0 })
    expect(res.body).not.toHaveProperty('contextSaveFailed')
  })

  it('flags contextSaveFailed (and writes nothing) when extraction could not run', async () => {
    const post = authed()
    vi.mocked(extractEntries).mockResolvedValue({ entries: [], failed: true })

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      reply: 'Here is my response.',
      entriesWritten: 0,
      contextSaveFailed: true,
    })
    expect(persistContext).not.toHaveBeenCalled()
  })

  it('flags contextSaveFailed but still returns the reply when writing to Firestore fails', async () => {
    const post = authed()
    vi.mocked(extractEntries).mockResolvedValue({
      entries: [{ content: 'x', type: 'note' }],
      failed: false,
    })
    vi.mocked(persistContext).mockRejectedValue(new Error('firestore down'))

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      reply: 'Here is my response.',
      entriesWritten: 0,
      contextSaveFailed: true,
    })
  })

  it('flags contextSaveFailed when extraction throws unexpectedly', async () => {
    const post = authed()
    vi.mocked(extractEntries).mockRejectedValue(new Error('boom'))

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body.contextSaveFailed).toBe(true)
  })

  it('skips extraction, and says so, when the reply used up the turn', async () => {
    const post = authed()
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    vi.mocked(generateReply).mockImplementation(async () => {
      now += 54_000
      return 'Here is my response.'
    })

    const res = await post(validBody)

    expect(res.status).toBe(200)
    expect(res.body.contextSaveFailed).toBe(true)
    expect(extractEntries).not.toHaveBeenCalled()
    expect(persistContext).not.toHaveBeenCalled()
  })

  it('does not write anything when the AI reply fails', async () => {
    const post = authed()
    vi.mocked(generateReply).mockRejectedValue(
      new HttpError(502, 'Bad Gateway', 'The AI service failed to respond')
    )

    const res = await post(validBody)

    expect(res.status).toBe(502)
    expect(extractEntries).not.toHaveBeenCalled()
    expect(persistContext).not.toHaveBeenCalled()
  })

  it('refuses new messages on an archived project', async () => {
    const post = authed()
    vi.mocked(buildProjectBriefing).mockResolvedValue({ ...sampleBriefing, status: 'archived' })

    const res = await post(validBody)

    expect(res.status).toBe(400)
    expect(generateReply).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller is not a project member', async () => {
    const post = authed()
    vi.mocked(buildProjectBriefing).mockRejectedValue(HttpError.notFound('Project', 'p1'))
    const res = await post(validBody)
    expect(res.status).toBe(404)
    expect(generateReply).not.toHaveBeenCalled()
  })
})
