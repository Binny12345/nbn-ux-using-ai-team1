'use client'

import { useCallback, useState } from 'react'
import { getClientAuth } from '@/lib/firebase/client'
import type { ChatMessage } from '../types'

// Base URL of the separately deployed Express backend — no trailing slash.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface ChatResponse {
  reply: string
  entriesWritten: number
}

interface ProblemDetails {
  detail?: string
}

export function useChat(projectId: string) {
  // One id per mount; the backend stores it as sourceChatId on extracted context.
  const [sessionId] = useState(() => crypto.randomUUID())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (content: string): Promise<ChatResponse | null> => {
      const text = content.trim()
      if (!text || isSending) return null

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'user',
        content: text,
        timestamp: new Date(),
      }
      setError(null)
      setIsSending(true)
      setMessages((prev) => [...prev, userMessage])

      try {
        if (!API_BASE) throw new Error('Chat server is not configured (NEXT_PUBLIC_API_URL).')

        const auth = getClientAuth()
        await auth.authStateReady()
        const user = auth.currentUser
        if (!user) throw new Error('You are signed out. Please sign in again.')
        const idToken = await user.getIdToken()

        let res: Response
        try {
          res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ projectId, sessionId, message: text }),
          })
        } catch {
          throw new Error('Could not reach the chat server. Check your connection and try again.')
        }

        if (!res.ok) {
          const problem = (await res.json().catch(() => null)) as ProblemDetails | null
          throw new Error(problem?.detail ?? `Request failed (${res.status})`)
        }

        const data = (await res.json()) as ChatResponse
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), sender: 'ai', content: data.reply, timestamp: new Date() },
        ])
        return data
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setMessages((prev) =>
          prev.map((m) => (m.id === userMessage.id ? { ...m, failed: true } : m))
        )
        return null
      } finally {
        setIsSending(false)
      }
    },
    [projectId, sessionId, isSending]
  )

  return { messages, isSending, error, send }
}
