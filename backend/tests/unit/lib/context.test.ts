import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminDb } from '../../../src/lib/firebase'
import { buildProjectContext } from '../../../src/lib/context'

const projectGet = vi.fn()
const memberGet = vi.fn()
const contextGet = vi.fn()
const memberDocIds: string[] = []

function docs(...items: object[]) {
  return {
    forEach: (cb: (d: { data: () => object }) => void) =>
      items.forEach((i) => cb({ data: () => i })),
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
  const contextRef = { get: contextGet }
  const projectRef = {
    get: projectGet,
    collection: vi.fn((name: string) => (name === 'members' ? membersRef : contextRef)),
  }
  vi.mocked(adminDb.collection).mockReturnValue({ doc: vi.fn(() => projectRef) } as never)
})

describe('buildProjectContext', () => {
  it('returns the project’s Active entries with attribution', async () => {
    projectGet.mockResolvedValue({ exists: true })
    memberGet.mockResolvedValue({ exists: true })
    contextGet.mockResolvedValue(
      docs(
        {
          content: 'Use CSV',
          type: 'decision',
          contributedBy: 'u1',
          role: 'BA',
          sourceChatId: 's1',
          status: 'Active',
        },
        { content: 'Legacy entry', type: 'note', contributedBy: 'u2', role: 'UX' }
      )
    )

    const result = await buildProjectContext('p1', 'u1')

    expect(memberDocIds).toEqual(['u1'])
    expect(result).toEqual([
      {
        content: 'Use CSV',
        type: 'decision',
        contributedBy: 'u1',
        role: 'BA',
        sourceChatId: 's1',
        status: 'Active',
      },
      {
        content: 'Legacy entry',
        type: 'note',
        contributedBy: 'u2',
        role: 'UX',
        sourceChatId: '',
        status: 'Active',
      },
    ])
  })

  it('skips Outdated entries', async () => {
    projectGet.mockResolvedValue({ exists: true })
    memberGet.mockResolvedValue({ exists: true })
    contextGet.mockResolvedValue(
      docs(
        { content: 'old', type: 'note', contributedBy: 'u1', role: 'BA', status: 'Outdated' },
        { content: 'new', type: 'note', contributedBy: 'u1', role: 'BA', status: 'Active' }
      )
    )
    const result = await buildProjectContext('p1', 'u1')
    expect(result.map((e) => e.content)).toEqual(['new'])
  })

  it('returns an empty list for a project with no context yet', async () => {
    projectGet.mockResolvedValue({ exists: true })
    memberGet.mockResolvedValue({ exists: true })
    contextGet.mockResolvedValue(docs())
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
