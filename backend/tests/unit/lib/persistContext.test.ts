import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminDb } from '../../../src/lib/firebase'
import { persistContext } from '../../../src/lib/persistContext'

const projectGet = vi.fn()
const memberGet = vi.fn()
const batchSet = vi.fn()
const batchUpdate = vi.fn()
const batchCommit = vi.fn()
// Existing context docs, by id, for the replace flow.
let existingDocs: Record<string, { exists: boolean; status?: string }> = {}
const memberDocIds: string[] = []
let nextDocId = 0

beforeEach(() => {
  vi.clearAllMocks()
  memberDocIds.length = 0
  nextDocId = 0
  existingDocs = {}
  batchCommit.mockResolvedValue(undefined)

  const membersRef = {
    doc: vi.fn((uid: string) => {
      memberDocIds.push(uid)
      return { get: memberGet }
    }),
  }
  const contextRef = {
    // doc(id) is an existing document being looked up; doc() is a new one.
    doc: vi.fn((id?: string) =>
      id === undefined
        ? { id: `doc${++nextDocId}` }
        : {
            id,
            get: async () => {
              const found = existingDocs[id] ?? { exists: false }
              return { exists: found.exists, get: () => found.status }
            },
          }
    ),
  }
  const projectRef = {
    get: projectGet,
    collection: vi.fn((name: string) => (name === 'members' ? membersRef : contextRef)),
  }
  vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn(() => projectRef) } as never)
  vi.mocked(adminDb.batch).mockReturnValue({
    set: batchSet,
    update: batchUpdate,
    commit: batchCommit,
  } as never)
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

describe('persistContext — replacing an existing entry', () => {
  it('writes the new entry and marks the old one Outdated, linked to its successor, in the same commit', async () => {
    asMember('UX')
    existingDocs = { old1: { exists: true, status: 'Active' } }

    const written = await persistContext('p1', 'u1', 'session-2', [
      { content: 'Google sign-in is now in scope', type: 'decision', replaces: 'old1' },
    ])

    expect(written).toBe(1)
    expect(batchSet).toHaveBeenCalledWith(
      { id: 'doc1' },
      expect.objectContaining({
        content: 'Google sign-in is now in scope',
        status: 'Active',
        replaces: 'old1',
        contributedBy: 'u1',
        role: 'UX',
      })
    )
    expect(batchUpdate).toHaveBeenCalledTimes(1)
    expect(batchUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'old1' }), {
      status: 'Outdated',
      supersededBy: 'doc1',
      outdatedAt: 'SERVER_TIMESTAMP',
    })
    expect(batchCommit).toHaveBeenCalledTimes(1)
  })

  it('does not add a replaces field, or touch anything, for a plain new entry', async () => {
    asMember('BA')
    await persistContext('p1', 'u1', 's', [{ content: 'Use CSV', type: 'decision' }])
    expect(batchSet.mock.calls[0]?.[1]).not.toHaveProperty('replaces')
    expect(batchUpdate).not.toHaveBeenCalled()
  })

  it('still saves the new entry, but outdates nothing, when the entry to replace does not exist', async () => {
    asMember('BA')
    existingDocs = {}

    const written = await persistContext('p1', 'u1', 's', [
      { content: 'A new fact', type: 'note', replaces: 'ghost' },
    ])

    expect(written).toBe(1)
    expect(batchSet.mock.calls[0]?.[1]).not.toHaveProperty('replaces')
    expect(batchUpdate).not.toHaveBeenCalled()
  })

  it('does not outdate an entry that is already Outdated', async () => {
    asMember('BA')
    existingDocs = { done: { exists: true, status: 'Outdated' } }

    await persistContext('p1', 'u1', 's', [
      { content: 'Newer fact', type: 'note', replaces: 'done' },
    ])

    expect(batchUpdate).not.toHaveBeenCalled()
    expect(batchSet).toHaveBeenCalledTimes(1)
  })

  it('treats an old document with no status field as Active', async () => {
    asMember('BA')
    existingDocs = { legacy: { exists: true } }

    await persistContext('p1', 'u1', 's', [
      { content: 'Newer fact', type: 'note', replaces: 'legacy' },
    ])

    expect(batchUpdate).toHaveBeenCalledTimes(1)
  })

  it('outdates each old entry only once when two new entries claim to replace it', async () => {
    asMember('BA')
    existingDocs = { old1: { exists: true, status: 'Active' } }

    await persistContext('p1', 'u1', 's', [
      { content: 'First replacement', type: 'note', replaces: 'old1' },
      { content: 'Second replacement', type: 'note', replaces: 'old1' },
    ])

    expect(batchSet).toHaveBeenCalledTimes(2)
    expect(batchUpdate).toHaveBeenCalledTimes(1)
    expect(batchUpdate.mock.calls[0]?.[1]).toMatchObject({ supersededBy: 'doc1' })
  })

  it('never reads or changes anything for a non-member', async () => {
    projectGet.mockResolvedValue({ exists: true })
    memberGet.mockResolvedValue({ exists: false })
    existingDocs = { old1: { exists: true, status: 'Active' } }

    await expect(
      persistContext('p1', 'stranger', 's', [{ content: 'x', type: 'note', replaces: 'old1' }])
    ).rejects.toMatchObject({ status: 404 })
    expect(batchUpdate).not.toHaveBeenCalled()
    expect(batchCommit).not.toHaveBeenCalled()
  })
})
