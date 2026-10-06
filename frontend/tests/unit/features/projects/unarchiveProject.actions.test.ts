import { describe, it, expect, vi, beforeEach } from 'vitest'

const { projectGet, projectUpdate, requireAuth } = vi.hoisted(() => ({
  projectGet: vi.fn(),
  projectUpdate: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('@/actions/auth.actions', () => ({ requireAuth }))
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: projectGet, update: projectUpdate }) }),
  },
}))

import { unarchiveProject } from '@/features/projects/actions/unarchiveProject.actions'

function projectDoc(data: object | null) {
  return { exists: data !== null, data: () => data ?? undefined }
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockResolvedValue({ uid: 'pm1' })
  projectUpdate.mockResolvedValue(undefined)
})

describe('unarchiveProject', () => {
  it('sets status back to active, and only changes status, when the creator unarchives', async () => {
    projectGet.mockResolvedValue(projectDoc({ createdBy: 'pm1', status: 'archived' }))

    await expect(unarchiveProject('p1')).resolves.toEqual({ success: true })

    expect(projectUpdate).toHaveBeenCalledTimes(1)
    expect(projectUpdate).toHaveBeenCalledWith({ status: 'active' })
  })

  it('refuses anyone who is not the project manager', async () => {
    requireAuth.mockResolvedValue({ uid: 'someone-else' })
    projectGet.mockResolvedValue(projectDoc({ createdBy: 'pm1', status: 'archived' }))

    const result = await unarchiveProject('p1')

    expect(result).toEqual({
      success: false,
      error: 'Only the project manager can unarchive this project',
    })
    expect(projectUpdate).not.toHaveBeenCalled()
  })

  it('reports a missing project', async () => {
    projectGet.mockResolvedValue(projectDoc(null))

    await expect(unarchiveProject('nope')).resolves.toEqual({
      success: false,
      error: 'Project not found',
    })
    expect(projectUpdate).not.toHaveBeenCalled()
  })

  it('does nothing to a project that is not archived', async () => {
    projectGet.mockResolvedValue(projectDoc({ createdBy: 'pm1', status: 'active' }))

    await expect(unarchiveProject('p1')).resolves.toEqual({
      success: false,
      error: 'This project is not archived',
    })
    expect(projectUpdate).not.toHaveBeenCalled()
  })
})
