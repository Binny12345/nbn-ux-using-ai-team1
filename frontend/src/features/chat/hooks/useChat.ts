'use client'

import { useCallback, useState } from 'react'
import { getClientAuth } from '@/lib/firebase/client'
import type { ChatMessage } from '../types'

// Base URL of the separately deployed Express backend. A value without a scheme would be
// treated by the browser as a path relative to the current page, so default it to https.
const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '')
const API_BASE = rawApiUrl && !/^https?:\/\//i.test(rawApiUrl) ? `https://${rawApiUrl}` : rawApiUrl

interface ChatResponse {
  reply: string
  entriesWritten: number
  // true when /generate stored a new file
  artifactCreated?: boolean
  // true when the exchange could not be saved to the shared context (the reply is still valid)
  contextSaveFailed?: boolean
}

export const CONTEXT_SAVE_FAILED_NOTICE =
  "Couldn't save this exchange to the shared context. Say it again in a moment if teammates need it."

interface ProblemDetails {
  detail?: string
}

// "/generate <prompt>" creates a Markdown file instead of sending a normal chat message.
// The word boundary keeps "/generated ..." and "/generate-x" as ordinary messages.
const GENERATE_COMMAND = /^\/generate(?:\s+([\s\S]*))?$/i
const GENERATE_USAGE =
  'Usage: /generate <what you want written>, e.g. /generate login page requirements'

export function useChat(projectId: string) {
  // One id per mount; the backend stores it as sourceChatId on extracted context.
  const [sessionId] = useState(() => crypto.randomUUID())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (content: string): Promise<ChatResponse | null> => {
      const text = content.trim()
      if (!text || isSending) return null

      const command = GENERATE_COMMAND.exec(text)
      const generatePrompt = command ? (command[1] ?? '').trim() : null
      if (command && !generatePrompt) {
        setError(GENERATE_USAGE)
        return null
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'user',
        content: text,
        timestamp: new Date(),
      }
      setError(null)
      setIsSending(true)
      setIsGenerating(generatePrompt !== null)
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
          res = await fetch(
            generatePrompt !== null
              ? `${API_BASE}/api/projects/${projectId}/artifacts/generate`
              : `${API_BASE}/api/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
              body: JSON.stringify(
                generatePrompt !== null
                  ? { prompt: generatePrompt }
                  : { projectId, sessionId, message: text }
              ),
            }
          )
        } catch {
          throw new Error('Could not reach the chat server. Check your connection and try again.')
        }

        if (!res.ok) {
          const problem = (await res.json().catch(() => null)) as ProblemDetails | null
          throw new Error(problem?.detail ?? `Request failed (${res.status})`)
        }

        let data: ChatResponse
        if (generatePrompt !== null) {
          const artifact = (await res.json()) as { fileName: string }
          data = {
            reply: `Created "${artifact.fileName}". Open Files to view or download it.`,
            entriesWritten: 0,
            artifactCreated: true,
          }
        } else {
          data = (await res.json()) as ChatResponse
        }
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: 'ai',
            content: data.reply,
            timestamp: new Date(),
            ...(data.contextSaveFailed ? { notice: CONTEXT_SAVE_FAILED_NOTICE } : {}),
          },
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
        setIsGenerating(false)
      }
    },
    [projectId, sessionId, isSending]
  )

  return { messages, isSending, isGenerating, error, send }
}
