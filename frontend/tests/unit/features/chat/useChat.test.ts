import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// useChat reads the API base URL at import time.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test'
})

vi.mock('@/lib/firebase/client', () => ({
  getClientAuth: () => ({
    authStateReady: async () => undefined,
    currentUser: { getIdToken: async () => 'id-token' },
  }),
}))

import { useChat } from '@/features/chat/hooks/useChat'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

// First fetch call as [url, parsed JSON body, headers].
function firstCall() {
  const call = fetchMock.mock.calls[0] as [
    string,
    { body: string; headers: Record<string, string> },
  ]
  return { url: call[0], body: JSON.parse(call[1].body), headers: call[1].headers }
}

async function sendMessage(text: string) {
  const { result } = renderHook(() => useChat('p1'))
  let returned: Awaited<ReturnType<typeof result.current.send>> = null
  await act(async () => {
    returned = await result.current.send(text)
  })
  return { result, returned }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('useChat', () => {
  it('sends a normal message to the chat endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'hi there', entriesWritten: 1 }))

    const { result, returned } = await sendMessage('what did we decide?')

    const { url, body, headers } = firstCall()
    expect(url).toBe('https://api.test/api/chat')
    expect(body).toMatchObject({ projectId: 'p1', message: 'what did we decide?' })
    expect(headers.Authorization).toBe('Bearer id-token')
    expect(returned).toEqual({ reply: 'hi there', entriesWritten: 1 })
    expect(result.current.messages.map((m) => m.content)).toEqual([
      'what did we decide?',
      'hi there',
    ])
  })

  it('routes "/generate <prompt>" to the generate endpoint with the command stripped', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'a1', fileName: 'login-page.md' }, 201))

    const { result, returned } = await sendMessage('/generate  login page requirements ')

    const { url, body } = firstCall()
    expect(url).toBe('https://api.test/api/projects/p1/artifacts/generate')
    expect(body).toEqual({ prompt: 'login page requirements' })
    expect(returned).toEqual({
      reply: 'Created "login-page.md". Open Files to view or download it.',
      entriesWritten: 0,
      artifactCreated: true,
    })
    expect(result.current.messages.map((m) => m.sender)).toEqual(['user', 'ai'])
    expect(result.current.messages[1]?.content).toContain('login-page.md')
  })

  it('matches the command case-insensitively and keeps multi-line prompts', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'a1', fileName: 'x.md' }, 201))

    await sendMessage('/GENERATE a test plan\nwith two parts')

    expect(firstCall().body).toEqual({ prompt: 'a test plan\nwith two parts' })
  })

  it('shows usage and sends nothing for a bare "/generate"', async () => {
    const { result, returned } = await sendMessage('/generate')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(returned).toBeNull()
    expect(result.current.error).toContain('Usage: /generate')
    expect(result.current.messages).toEqual([])
  })

  it('treats "/generated ..." as an ordinary chat message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ reply: 'ok', entriesWritten: 0 }))

    await sendMessage('/generated files are great')

    expect(firstCall().url).toBe('https://api.test/api/chat')
  })

  it('surfaces the backend error and marks the message not sent when generation fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'The AI service failed to respond' }, 502))

    const { result, returned } = await sendMessage('/generate something')

    expect(returned).toBeNull()
    expect(result.current.error).toBe('The AI service failed to respond')
    expect(result.current.messages[0]?.failed).toBe(true)
    expect(result.current.isSending).toBe(false)
    expect(result.current.isGenerating).toBe(false)
  })
})
