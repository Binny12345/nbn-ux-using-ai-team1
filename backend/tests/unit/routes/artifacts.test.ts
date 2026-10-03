import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// artifacts.ts reads the token at import time, so set it before anything loads.
vi.hoisted(() => {
  process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token'
})

vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }))
vi.mock('../../../src/lib/ai', () => ({
  generateDocument: vi.fn(),
  generateReply: vi.fn(),
  extractEntries: vi.fn(),
}))
vi.mock('../../../src/lib/context', () => ({ buildProjectContext: vi.fn() }))

import { put } from '@vercel/blob'
import { createApp } from '../../../src/app'
import { adminDb } from '../../../src/lib/firebase'
import { generateDocument } from '../../../src/lib/ai'
import { buildProjectContext } from '../../../src/lib/context'
import { HttpError } from '../../../src/lib/errors'
import { mockVerifyToken, mockUser } from '../../setup'
import type { ContextEntry } from '../../../src/lib/contextTypes'

const app = createApp({ verifyToken: mockVerifyToken })

const projectGet = vi.fn()
const memberGet = vi.fn()
const artifactSet = vi.fn()
const existingNamesGet = vi.fn()
const listGet = vi.fn()

const sampleContext: ContextEntry[] = [
  {
    content: 'Login is email/password only',
    type: 'decision',
    contributedBy: 'u1',
    role: 'BA',
    sourceChatId: 's1',
    status: 'Active',
  },
]

const MARKDOWN = '# Login Page Requirements\n\n## Scope\n\nEmail and password only.'

// Snapshot of existing artifact docs, as returned by the fileName range query.
function namesSnapshot(...fileNames: string[]) {
  return { docs: fileNames.map((fileName) => ({ get: () => fileName })) }
}

function asMember(role = 'UX') {
  projectGet.mockResolvedValue({ exists: true })
  memberGet.mockResolvedValue({ exists: true, get: () => role })
}

function authed() {
  vi.mocked(mockVerifyToken).mockResolvedValue(mockUser)
}

function generate(body: object = { prompt: 'write the login requirements' }) {
  return request(app)
    .post('/api/projects/p1/artifacts/generate')
    .set('Authorization', 'Bearer fake')
    .send(body)
}

beforeEach(() => {
  vi.clearAllMocks()
  authed()

  const membersRef = { doc: vi.fn(() => ({ get: memberGet })) }
  const artifactsRef = {
    doc: vi.fn(() => ({ id: 'a1', set: artifactSet })),
    // uniqueFileName: where(>=).where(<).get()
    where: vi.fn(() => ({ where: vi.fn(() => ({ get: existingNamesGet })) })),
    // list route: orderBy().get()
    orderBy: vi.fn(() => ({ get: listGet })),
  }
  const projectRef = {
    get: projectGet,
    collection: vi.fn((name: string) => (name === 'members' ? membersRef : artifactsRef)),
  }
  vi.mocked(adminDb.collection).mockImplementation(((name: string) =>
    name === 'users'
      ? { doc: (uid: string) => ({ id: uid }) }
      : { doc: () => projectRef }) as never)
  existingNamesGet.mockResolvedValue(namesSnapshot())

  asMember('UX')
  vi.mocked(buildProjectContext).mockResolvedValue(sampleContext)
  vi.mocked(generateDocument).mockResolvedValue(MARKDOWN)
  vi.mocked(put).mockResolvedValue({
    url: 'https://blob.example/projects/p1/login-page-requirements-abc.md',
    pathname: 'projects/p1/login-page-requirements-abc.md',
  } as never)
  artifactSet.mockResolvedValue(undefined)
})

describe('POST /api/projects/:projectId/artifacts/generate', () => {
  it('returns 401 without a valid session', async () => {
    vi.mocked(mockVerifyToken).mockRejectedValue(new Error('invalid'))
    const res = await request(app).post('/api/projects/p1/artifacts/generate').send({ prompt: 'x' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when the prompt is missing, blank or has unknown fields', async () => {
    expect((await generate({})).status).toBe(400)
    expect((await generate({ prompt: '   ' })).status).toBe(400)
    expect((await generate({ prompt: 'x', extra: 1 })).status).toBe(400)
    expect(generateDocument).not.toHaveBeenCalled()
  })

  it('returns 404 for a non-member without calling the AI or storing anything', async () => {
    projectGet.mockResolvedValue({ exists: true })
    memberGet.mockResolvedValue({ exists: false })

    const res = await generate()

    expect(res.status).toBe(404)
    expect(generateDocument).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(artifactSet).not.toHaveBeenCalled()
  })

  it('generates from the project context and prompt, stores a private markdown blob and an ai artifact record', async () => {
    const res = await generate({ prompt: 'write the login requirements' })

    expect(res.status).toBe(201)
    expect(buildProjectContext).toHaveBeenCalledWith('p1', mockUser.uid)
    expect(generateDocument).toHaveBeenCalledWith(sampleContext, 'write the login requirements')

    const [path, body, options] = vi.mocked(put).mock.calls[0] as [string, Buffer, object]
    expect(path).toBe('projects/p1/login-page-requirements.md')
    expect(body.toString('utf8')).toBe(MARKDOWN)
    expect(options).toMatchObject({
      access: 'private',
      contentType: 'text/markdown',
      addRandomSuffix: true,
      token: 'test-blob-token',
    })

    expect(artifactSet).toHaveBeenCalledWith({
      fileName: 'login-page-requirements.md',
      contentType: 'text/markdown',
      size: Buffer.byteLength(MARKDOWN, 'utf8'),
      blobUrl: 'https://blob.example/projects/p1/login-page-requirements-abc.md',
      blobPathname: 'projects/p1/login-page-requirements-abc.md',
      uploadedBy: mockUser.uid,
      role: 'UX',
      source: 'ai',
      createdAt: 'SERVER_TIMESTAMP',
    })
  })

  it('returns the artifact without the raw blob url', async () => {
    const res = await generate()
    expect(res.body).toEqual({
      id: 'a1',
      fileName: 'login-page-requirements.md',
      contentType: 'text/markdown',
      size: Buffer.byteLength(MARKDOWN, 'utf8'),
      uploadedBy: mockUser.uid,
      role: 'UX',
      source: 'ai',
    })
    expect(res.body).not.toHaveProperty('blobUrl')
  })

  it('falls back to the prompt for the file name when the document has no heading', async () => {
    vi.mocked(generateDocument).mockResolvedValue('Just some text, no heading.')
    const res = await generate({ prompt: 'Draft a Test Plan for sprint 3!' })
    expect(res.body.fileName).toBe('draft-a-test-plan-for-sprint.md')
  })

  it('produces a safe file name even from hostile headings', async () => {
    vi.mocked(generateDocument).mockResolvedValue('# ../../etc/passwd "; rm -rf\n\nbody')
    const res = await generate()
    expect(res.body.fileName).toMatch(/^[a-z0-9-]+\.md$/)
  })

  it('uses the name_(2).md style when the name is already taken in the project', async () => {
    existingNamesGet.mockResolvedValue(namesSnapshot('login-page-requirements.md'))

    const res = await generate()

    expect(res.body.fileName).toBe('login-page-requirements_(2).md')
    expect(artifactSet).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'login-page-requirements_(2).md' })
    )
    // The blob path keeps the plain slug; uniqueness there comes from addRandomSuffix.
    expect(vi.mocked(put).mock.calls[0]?.[0]).toBe('projects/p1/login-page-requirements.md')
  })

  it('takes the first free number and treats names case-insensitively', async () => {
    existingNamesGet.mockResolvedValue(
      namesSnapshot(
        'Login-Page-Requirements.md',
        'login-page-requirements_(2).md',
        'login-page-requirements_(4).md',
        'login-page-requirements-extra.md'
      )
    )
    const res = await generate()
    expect(res.body.fileName).toBe('login-page-requirements_(3).md')
  })

  it('stores nothing when the AI call fails', async () => {
    vi.mocked(generateDocument).mockRejectedValue(
      new HttpError(502, 'Bad Gateway', 'The AI service failed to respond')
    )

    const res = await generate()

    expect(res.status).toBe(502)
    expect(put).not.toHaveBeenCalled()
    expect(artifactSet).not.toHaveBeenCalled()
  })
})

describe('POST /api/projects/:projectId/artifacts (upload)', () => {
  it("records source 'upload' on uploaded files", async () => {
    const res = await request(app)
      .post('/api/projects/p1/artifacts')
      .set('Authorization', 'Bearer fake')
      .attach('file', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' })

    expect(res.status).toBe(201)
    expect(artifactSet).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'notes.txt',
        uploadedBy: mockUser.uid,
        role: 'UX',
        source: 'upload',
      })
    )
  })
})

describe('GET /api/projects/:projectId/artifacts (list)', () => {
  function listDoc(id: string, data: Record<string, unknown>) {
    return { id, data: () => data, get: (key: string) => data[key] }
  }

  it('returns source and the contributor display name, and never the blob url', async () => {
    listGet.mockResolvedValue({
      docs: [
        listDoc('a1', {
          fileName: 'plan_(2).md',
          contentType: 'text/markdown',
          size: 10,
          uploadedBy: 'u1',
          role: 'BA',
          source: 'ai',
          blobUrl: 'https://blob.example/secret',
        }),
      ],
    })
    vi.mocked(adminDb.getAll).mockResolvedValue([{ id: 'u1', get: () => 'Alice' }] as never)

    const res = await request(app)
      .get('/api/projects/p1/artifacts')
      .set('Authorization', 'Bearer fake')

    expect(res.status).toBe(200)
    expect(res.body.artifacts).toEqual([
      {
        id: 'a1',
        fileName: 'plan_(2).md',
        contentType: 'text/markdown',
        size: 10,
        uploadedBy: 'u1',
        uploadedByName: 'Alice',
        role: 'BA',
        source: 'ai',
      },
    ])
    expect(JSON.stringify(res.body)).not.toContain('blob.example')
  })

  it('treats documents without a source as uploads and tolerates missing display names', async () => {
    listGet.mockResolvedValue({
      docs: [
        listDoc('a1', { fileName: 'old.docx', uploadedBy: 'u2', role: 'UX' }),
        listDoc('a2', { fileName: 'new.docx', uploadedBy: 'u2', role: 'UX', source: 'upload' }),
      ],
    })
    vi.mocked(adminDb.getAll).mockResolvedValue([{ id: 'u2', get: () => undefined }] as never)

    const res = await request(app)
      .get('/api/projects/p1/artifacts')
      .set('Authorization', 'Bearer fake')

    expect(res.body.artifacts.map((a: { source: string }) => a.source)).toEqual([
      'upload',
      'upload',
    ])
    expect(res.body.artifacts[0].uploadedByName).toBeNull()
    expect(adminDb.getAll).toHaveBeenCalledTimes(1)
  })

  it('does not look up any users for an empty project', async () => {
    listGet.mockResolvedValue({ docs: [] })
    const res = await request(app)
      .get('/api/projects/p1/artifacts')
      .set('Authorization', 'Bearer fake')
    expect(res.body).toEqual({ artifacts: [] })
    expect(adminDb.getAll).not.toHaveBeenCalled()
  })

  it('returns 404 for a non-member', async () => {
    projectGet.mockResolvedValue({ exists: true })
    memberGet.mockResolvedValue({ exists: false })
    const res = await request(app)
      .get('/api/projects/p1/artifacts')
      .set('Authorization', 'Bearer fake')
    expect(res.status).toBe(404)
  })
})
