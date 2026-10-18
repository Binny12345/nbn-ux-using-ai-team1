import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

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
  return render(
    <FilesSidebar open projectId="p1" currentUserId="me" onClose={() => undefined} {...props} />
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

// jsdom reports 'visible'. Tests that need another state override it on the document itself,
// and this puts the original behaviour back so one test can't leak into the next.
function setTabVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'visibilityState')
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

  it('loads the list with the bearer token even while closed, so the files are ready when it opens', async () => {
    listOf({ ...base, id: 'a1', fileName: 'a.md', uploadedBy: 'u1', role: 'BA', source: 'ai' })

    renderSidebar({ open: false })

    expect(await screen.findByText('a.md')).toBeInTheDocument()
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

    rerender(
      <FilesSidebar
        open
        projectId="p1"
        currentUserId="me"
        onClose={() => undefined}
        refreshKey={0}
      />
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    rerender(
      <FilesSidebar
        open
        projectId="p1"
        currentUserId="me"
        onClose={() => undefined}
        refreshKey={1}
      />
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  })

  it('shows the error when the list fails to load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
    renderSidebar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load (502)')
  })

  describe('notifying about teammates’ new files', () => {
    const file = (id: string, uploadedBy: string, fileName = `${id}.md`) => ({
      ...base,
      id,
      fileName,
      uploadedBy,
      role: 'BA',
    })

    it('does not notify for the files already there on first load', async () => {
      listOf(file('a1', 'teammate'))
      const onNewArtifacts = vi.fn()

      renderSidebar({ onNewArtifacts })

      expect(await screen.findByText('a1.md')).toBeInTheDocument()
      expect(onNewArtifacts).not.toHaveBeenCalled()
    })

    it('notifies with the files a teammate added since the last load', async () => {
      listOf(file('a1', 'teammate'))
      const onNewArtifacts = vi.fn()
      const { rerender } = renderSidebar({ onNewArtifacts, refreshKey: 0 })
      await screen.findByText('a1.md')

      listOf(file('a1', 'teammate'), file('a2', 'teammate'))
      rerender(
        <FilesSidebar
          open
          projectId="p1"
          currentUserId="me"
          onClose={() => undefined}
          onNewArtifacts={onNewArtifacts}
          refreshKey={1}
        />
      )

      await waitFor(() => expect(onNewArtifacts).toHaveBeenCalledTimes(1))
      expect(onNewArtifacts.mock.calls[0]?.[0].map((a: { id: string }) => a.id)).toEqual(['a2'])
    })

    it('never notifies about your own uploads, and tells you about each file only once', async () => {
      listOf(file('a1', 'teammate'))
      const onNewArtifacts = vi.fn()
      const { rerender } = renderSidebar({ onNewArtifacts, refreshKey: 0 })
      await screen.findByText('a1.md')

      listOf(file('a1', 'teammate'), file('mine', 'me'), file('a3', 'teammate'))
      const withKey = (refreshKey: number) => (
        <FilesSidebar
          open
          projectId="p1"
          currentUserId="me"
          onClose={() => undefined}
          onNewArtifacts={onNewArtifacts}
          refreshKey={refreshKey}
        />
      )
      rerender(withKey(1))
      await waitFor(() => expect(onNewArtifacts).toHaveBeenCalledTimes(1))
      expect(onNewArtifacts.mock.calls[0]?.[0].map((a: { id: string }) => a.id)).toEqual(['a3'])

      rerender(withKey(2)) // same list again: nothing new
      await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3))
      expect(onNewArtifacts).toHaveBeenCalledTimes(1)
    })

    it('polls in the background so teammates’ uploads arrive without opening the panel', async () => {
      listOf(file('a1', 'teammate'))
      const onNewArtifacts = vi.fn()
      // Only the interval is faked, so Testing Library's own waiting keeps working.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      renderSidebar({ open: false, onNewArtifacts })
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

      listOf(file('a1', 'teammate'), file('a2', 'teammate'))
      vi.advanceTimersByTime(15_000)

      await waitFor(() => expect(onNewArtifacts).toHaveBeenCalledTimes(1))
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not poll while the browser tab is hidden', async () => {
      listOf(file('a1', 'teammate'))
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      setTabVisibility('hidden')
      renderSidebar({ open: false })
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

      vi.advanceTimersByTime(45_000)

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('keeps a failed background poll quiet instead of showing an error banner', async () => {
      listOf(file('a1', 'teammate'))
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      renderSidebar({ open: false })
      await screen.findByText('a1.md')

      fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) })
      // A failed poll changes nothing in the DOM, so flush the pending promises explicitly.
      await act(async () => {
        vi.advanceTimersByTime(15_000)
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
