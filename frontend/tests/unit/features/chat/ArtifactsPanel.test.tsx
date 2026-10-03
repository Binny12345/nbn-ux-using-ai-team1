import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ArtifactsPanel reads the API base URL at import time.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test'
})

vi.mock('@/lib/firebase/client', () => ({
  getClientAuth: () => ({
    authStateReady: async () => undefined,
    currentUser: { getIdToken: async () => 'id-token' },
  }),
}))

import { ArtifactsPanel } from '@/features/chat/components/ArtifactsPanel'

const fetchMock = vi.fn()

function listOf(...artifacts: object[]) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ artifacts }) })
}

const base = { contentType: 'text/markdown', size: 2048 }

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('ArtifactsPanel', () => {
  it('marks AI-generated files with an AI badge and shows the contributor name and role', async () => {
    listOf({
      ...base,
      id: 'a1',
      fileName: 'login-page_(2).md',
      uploadedBy: 'u1',
      uploadedByName: 'Alice',
      role: 'BA',
      source: 'ai',
    })

    render(<ArtifactsPanel projectId="p1" onClose={() => undefined} />)

    expect(await screen.findByText('login-page_(2).md')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText(/Alice \(BA\)/)).toBeInTheDocument()
  })

  it('does not mark uploaded files, including older ones with no source', async () => {
    listOf(
      {
        ...base,
        id: 'a1',
        fileName: 'notes.txt',
        uploadedBy: 'u1',
        uploadedByName: 'Bob',
        role: 'UX',
        source: 'upload',
      },
      {
        ...base,
        id: 'a2',
        fileName: 'old.docx',
        uploadedBy: 'u2',
        uploadedByName: 'Cy',
        role: 'Dev',
      }
    )

    render(<ArtifactsPanel projectId="p1" onClose={() => undefined} />)

    expect(await screen.findByText('notes.txt')).toBeInTheDocument()
    expect(screen.getByText('old.docx')).toBeInTheDocument()
    expect(screen.queryByText('AI')).not.toBeInTheDocument()
  })

  it('falls back to "Teammate" when the contributor has no display name', async () => {
    listOf({
      ...base,
      id: 'a1',
      fileName: 'x.md',
      uploadedBy: 'u1',
      uploadedByName: null,
      role: 'PM',
      source: 'ai',
    })

    render(<ArtifactsPanel projectId="p1" onClose={() => undefined} />)

    expect(await screen.findByText(/Teammate \(PM\)/)).toBeInTheDocument()
  })

  it('requests the list for the project with the bearer token', async () => {
    listOf()

    render(<ArtifactsPanel projectId="p1" onClose={() => undefined} />)

    expect(await screen.findByText(/No artifacts yet/)).toBeInTheDocument()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.test/api/projects/p1/artifacts')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer id-token' },
    })
  })

  it('reports the file count to the parent', async () => {
    listOf(
      { ...base, id: 'a1', fileName: 'a.md', uploadedBy: 'u1', role: 'BA', source: 'ai' },
      { ...base, id: 'a2', fileName: 'b.md', uploadedBy: 'u1', role: 'BA', source: 'ai' }
    )
    const onArtifactsChange = vi.fn()

    render(
      <ArtifactsPanel
        projectId="p1"
        onClose={() => undefined}
        onArtifactsChange={onArtifactsChange}
      />
    )

    await screen.findByText('a.md')
    expect(onArtifactsChange).toHaveBeenLastCalledWith(2)
  })
})
