import { getClientAuth } from '@/lib/firebase/client'

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '')
const API_BASE = rawApiUrl && !/^https?:\/\//i.test(rawApiUrl) ? `https://${rawApiUrl}` : rawApiUrl

// Saves highlighted text from an AI reply as a shared-context note.
export async function addContextEntry(
  projectId: string,
  sessionId: string,
  content: string
): Promise<void> {
  if (!API_BASE) throw new Error('Chat server is not configured (NEXT_PUBLIC_API_URL).')

  const auth = getClientAuth()
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('You are signed out. Please sign in again.')
  const token = await user.getIdToken()

  const res = await fetch(`${API_BASE}/api/chat/context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, sessionId, content }),
  })
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new Error(problem?.detail ?? `Request failed (${res.status})`)
  }
}