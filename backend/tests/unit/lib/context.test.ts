import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminDb } from '../../../src/lib/firebase'
import { buildProjectContext, MAX_CONTEXT_ENTRIES } from '../../../src/lib/context'

const projectGet = vi.fn()
const memberGet = vi.fn()
const contextGet = vi.fn()
const orderBy = vi.fn()
const limit = vi.fn()
const memberDocIds: string[] = []

type Stored = Record<string, unknown> & { id: string }

// What Firestore returns for the context query: newest first.
function snapshot(...items: Stored[]) {
  return { docs: items.map(({ id, ...data }) => ({ id, data: () => data })) }
}

function entry(id: string, over: Record<string, unknown> = {}): Stored {
  return {
    id,
    content: `content ${id}`,
    type: 'note',
    contributedBy: 'u1',
    role: 'BA',
    sourceChatId: 's1',
    status: 'Active',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  memberDocIds.length = 0

  const membersRef = {
    doc: vi.fn((uid: string) => {
      memberDocIds.push(uid)
      return { get: memberGet }
    }),
  }
  const contextQuery = {
    orderBy: orderBy.mockImplementation(() => contextQuery),
    limit: limit.mockImplementation(() => contextQuery),
    get: contextGet,
  }
  const projectRef = {
    get: projectGet,
    collection: vi.fn((name: string) => (name === 'members' ? membersRef : contextQuery)),
  }
  vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn(() => projectRef) } as never)
})

function asMember() {
  projectGet.mockResolvedValue({ exists: true })
  memberGet.mockResolvedValue({ exists: true })
}

describe('buildProjectContext', () => {
  it('returns Active entries with their ids and attribution, oldest first', async () => {
    asMember()
    // Firestore hands back newest first.
    contextGet.mockResolvedValue(
      snapshot(entry('newer', { role: 'UX', sourceChatId: 's2' }), entry('older'))
    )

    const result = await buildProjectContext('p1', 'u1')

    expect(memberDocIds).toEqual(['u1'])
    expect(result.map((e) => e.id)).toEqual(['older', 'newer'])
    expect(result[1]).toEqual({
      id: 'newer',
      content: 'content newer',
      type: 'note',
      contributedBy: 'u1',
      role: 'UX',
      sourceChatId: 's2',
      status: 'Active',
    })
  })

  it('treats entries saved before status existed as Active, with an empty source chat', async () => {
    asMember()
    contextGet.mockResolvedValue(
      snapshot(entry('legacy', { status: undefined, sourceChatId: undefined }))
    )

    const [only] = await buildProjectContext('p1', 'u1')

    expect(only).toMatchObject({ id: 'legacy', status: 'Active', sourceChatId: '' })
  })

  it('skips Outdated entries', async () => {
    asMember()
    contextGet.mockResolvedValue(snapshot(entry('new'), entry('old', { status: 'Outdated' })))
    const result = await buildProjectContext('p1', 'u1')
    expect(result.map((e) => e.id)).toEqual(['new'])
  })

  it('reads newest-first and keeps only the newest MAX_CONTEXT_ENTRIES, so the prompt cannot grow without bound', async () => {
    asMember()
    const total = MAX_CONTEXT_ENTRIES + 25
    contextGet.mockResolvedValue(
      snapshot(...Array.from({ length: total }, (_, i) => entry(`e${total - i}`)))
    )

    const result = await buildProjectContext('p1', 'u1')

    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc')
    expect(limit).toHaveBeenCalledWith(MAX_CONTEXT_ENTRIES * 2)
    expect(result).toHaveLength(MAX_CONTEXT_ENTRIES)
    expect(result.at(-1)?.id).toBe(`e${total}`) // the newest survives
    expect(result.some((e) => e.id === 'e1')).toBe(false) // the oldest is dropped
  })

  it('does not let Outdated entries crowd Active ones out of the cap', async () => {
    asMember()
    contextGet.mockResolvedValue(
      snapshot(
        ...Array.from({ length: 30 }, (_, i) => entry(`gone${i}`, { status: 'Outdated' })),
        entry('kept')
      )
    )
    const result = await buildProjectContext('p1', 'u1')
    expect(result.map((e) => e.id)).toEqual(['kept'])
  })

  it('returns an empty list for a project with no context yet', async () => {
    asMember()
    contextGet.mockResolvedValue(snapshot())
    await expect(buildProjectContext('p1', 'u1')).resolves.toEqual([])
  })

  it('rejects a non-member with 404 without reading context', async () => {
    projectGet.mockResolvedValue({ exists: true })
    memberGet.mockResolvedValue({ exists: false })
    await expect(buildProjectContext('p1', 'stranger')).rejects.toMatchObject({ status: 404 })
    expect(contextGet).not.toHaveBeenCalled()
  })

  it('rejects a missing project with 404', async () => {
    projectGet.mockResolvedValue({ exists: false })
    await expect(buildProjectContext('nope', 'u1')).rejects.toMatchObject({ status: 404 })
  })
})
