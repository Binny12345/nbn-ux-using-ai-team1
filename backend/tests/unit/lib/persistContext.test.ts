import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminDb } from '../../../src/lib/firebase'
import { persistContext } from '../../../src/lib/persistContext'

const projectGet = vi.fn()
const memberGet = vi.fn()
const batchSet = vi.fn()
const batchCommit = vi.fn()
const memberDocIds: string[] = []
let nextDocId = 0

beforeEach(() => {
  vi.clearAllMocks()
  memberDocIds.length = 0
  nextDocId = 0
  batchCommit.mockResolvedValue(undefined)

  const membersRef = {
    doc: vi.fn((uid: string) => {
      memberDocIds.push(uid)
      return { get: memberGet }
    }),
  }
  const contextRef = { doc: vi.fn(() => ({ id: `doc${++nextDocId}` })) }
  const projectRef = {
    get: projectGet,
    collection: vi.fn((name: string) => (name === 'members' ? membersRef : contextRef)),
  }
  vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn(() => projectRef) } as never)
  vi.mocked(adminDb.batch).mockReturnValue({ set: batchSet, commit: batchCommit } as never)
})

function asMember(role: string) {
  projectGet.mockResolvedValue({ exists: true })
  memberGet.mockResolvedValue({ exists: true, get: () => role })
}

describe('persistContext', () => {
  it('writes one attributed document per entry, then commits once', async () => {
    asMember('BA')

    const written = await persistContext('p1', 'u1', 'session-1', [
      { content: 'Use CSV', type: 'decision' },
      { content: 'Support dark mode', type: 'requirement' },
    ])

    expect(written).toBe(2)
    expect(batchSet).toHaveBeenCalledTimes(2)
    expect(batchSet).toHaveBeenNthCalledWith(
      1,
      { id: 'doc1' },
      {
        content: 'Use CSV',
        type: 'decision',
        contributedBy: 'u1',
        role: 'BA',
        sourceChatId: 'session-1',
        status: 'Active',
        createdAt: 'SERVER_TIMESTAMP',
      }
    )
    expect(batchSet).toHaveBeenNthCalledWith(
      2,
      { id: 'doc2' },
      expect.objectContaining({ content: 'Support dark mode', type: 'requirement' })
    )
    expect(batchCommit).toHaveBeenCalledTimes(1)
  })

  it('looks the role up from the members subcollection using the caller uid', async () => {
    asMember('UX')
    await persistContext('p1', 'u-ux', 's', [{ content: 'x', type: 'note' }])
    expect(memberDocIds).toEqual(['u-ux'])
    expect(batchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: 'UX', contributedBy: 'u-ux' })
    )
  })

  it('gives each entry its own document id (append-only, no overwrite)', async () => {
    asMember('BA')
    await persistContext('p1', 'u1', 's', [
      { content: 'a', type: 'note' },
      { content: 'b', type: 'note' },
    ])
    const refs = batchSet.mock.calls.map((c) => c[0])
    expect(new Set(refs.map((r) => r.id)).size).toBe(2)
  })

  it('does nothing when there are no entries', async () => {
    const written = await persistContext('p1', 'u1', 's', [])
    expect(written).toBe(0)
    expect(adminDb.collection).not.toHaveBeenCalled()
    expect(batchCommit).not.toHaveBeenCalled()
  })

  it('rejects a non-member with 404 and writes nothing', async () => {
    projectGet.mockResolvedValue({ exists: true })
    memberGet.mockResolvedValue({ exists: false })
    await expect(
      persistContext('p1', 'stranger', 's', [{ content: 'x', type: 'note' }])
    ).rejects.toMatchObject({ status: 404 })
    expect(batchSet).not.toHaveBeenCalled()
    expect(batchCommit).not.toHaveBeenCalled()
  })

  it('rejects a missing project with 404 and writes nothing', async () => {
    projectGet.mockResolvedValue({ exists: false })
    await expect(
      persistContext('nope', 'u1', 's', [{ content: 'x', type: 'note' }])
    ).rejects.toMatchObject({ status: 404 })
    expect(batchCommit).not.toHaveBeenCalled()
  })

  it('propagates a commit failure so the caller can handle it', async () => {
    asMember('BA')
    batchCommit.mockRejectedValue(new Error('unavailable'))
    await expect(persistContext('p1', 'u1', 's', [{ content: 'x', type: 'note' }])).rejects.toThrow(
      'unavailable'
    )
  })
})
