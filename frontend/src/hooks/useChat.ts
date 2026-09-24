'use client'

import { useCallback, useRef, useState } from 'react'
import { getClientAuth } from '@/lib/firebase/client'
// ^ Adjust this import to match your actual client-auth export.
//   It must return the Firebase client Auth instance so we can read
//   the current user's ID token. If your project exposes the user via
//   a useAuth() hook instead, see the note at getIdToken() below.

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SendResult {
  reply: string
  entriesWritten: number
}

// Where the backend lives. The chat API is a separate Express service, so this
// is its base URL, set per environment. Must be a public var (baked into the
// client bundle) and must NOT end in a slash.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

/**
 * Drives one project chat session.
 *
 * - Generates a stable sessionId once, when the hook mounts (i.e. when the user
 *   enters this project chat). Every turn sends the same sessionId, which the
 *   backend records as sourceChatId. Leaving the chat unmounts the hook and the
 *   id is gone; re-entering starts a new session.
 * - Sends the Firebase ID token as a Bearer header — the backend authenticates
 *   on Authorization, not the __session cookie used for page auth.
 */
export function useChat(projectId: string) {
  // One session id for the life of this hook instance.
  const sessionIdRef = useRef<string>(crypto.randomUUID())

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (message: string): Promise<SendResult | null> => {
      const trimmed = message.trim()
      if (!trimmed || isSending) return null

      setError(null)
      setIsSending(true)

      // Optimistically show the user's message.
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }])

      try {
        // Get a fresh ID token for the Bearer header.
        const user = getClientAuth().currentUser
        if (!user) throw new Error('Not signed in')
        const idToken = await user.getIdToken()
        // If your project uses a useAuth() hook that already holds the user,
        // you can swap the two lines above for that user's getIdToken().

        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            projectId,
            sessionId: sessionIdRef.current,
            message: trimmed,
          }),
        })

        if (!res.ok) {
          const detail = await res.json().catch(() => ({}))
          throw new Error(detail?.message ?? `Request failed (${res.status})`)
        }

        const data = (await res.json()) as SendResult

        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
        return data
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
        // Roll the optimistic user message back out on failure.
        setMessages((prev) => prev.slice(0, -1))
        return null
      } finally {
        setIsSending(false)
      }
    },
    [projectId, isSending]
  )

  return {
    messages,
    isSending,
    error,
    send,
    sessionId: sessionIdRef.current,
  }
}