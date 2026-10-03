import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// FilesSidebar reads the API base URL at import time.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test'
})

vi.mock('@/lib/firebase/client', () => ({
  getClientAuth: () => ({
    authStateReady: async () => undefined,
    currentUser: { getIdToken: async () => 'id-token' },
  }),
}))

import { FilesSidebar } from '@/features/chat/components/FilesSidebar'

const fetchMock = vi.fn()

function listOf(...artifacts: object[]) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ artifacts }) })
}

const base = { contentType: 'text/markdown', size: 2048 }

function renderSidebar(props: Partial<React.ComponentProps<typeof FilesSidebar>> = {}) {
  return render(<FilesSidebar open projectId="p1" onClose={() => undefined} {...props} />)
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('FilesSidebar', () => {
  it('marks AI-generated files with an AI tag and shows the contributor name and role', async () => {
    listOf({
      ...base,
      id: 'a1',
      fileName: 'login-page_(2).md',
      uploadedBy: 'u1',
      uploadedByName: 'Alice',
      role: 'BA',
      source: 'ai',
    })

    renderSidebar()

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

    renderSidebar()

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

    renderSidebar()

    expect(await screen.findByText(/Teammate \(PM\)/)).toBeInTheDocument()
  })

  it('shows an empty state when the project has no files', async () => {
    listOf()
    renderSidebar()
    expect(await screen.findByText('No files yet.')).toBeInTheDocument()
  })

  it('loads the list with the bearer token even while closed, so the badge is right on page load', async () => {
    listOf({ ...base, id: 'a1', fileName: 'a.md', uploadedBy: 'u1', role: 'BA', source: 'ai' })
    const onArtifactsChange = vi.fn()

    renderSidebar({ open: false, onArtifactsChange })

    await waitFor(() => expect(onArtifactsChange).toHaveBeenLastCalledWith(1))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.test/api/projects/p1/artifacts')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer id-token' },
    })
  })

  it('keeps the closed sidebar out of the tab order', async () => {
    listOf()
    const { container } = renderSidebar({ open: false })
    await screen.findByText('No files yet.')
    const aside = container.querySelector('aside')
    expect(aside).toHaveAttribute('inert')
    expect(aside).toHaveAttribute('aria-hidden', 'true')
  })

  it('reloads when it is opened and when refreshKey changes', async () => {
    listOf()
    const { rerender } = renderSidebar({ open: false, refreshKey: 0 })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    rerender(<FilesSidebar open projectId="p1" onClose={() => undefined} refreshKey={0} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    rerender(<FilesSidebar open projectId="p1" onClose={() => undefined} refreshKey={1} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  })

  it('shows the error when the list fails to load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
    renderSidebar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load (502)')
  })
})
