import type { ArtifactRef, ChatMessage } from '../types'

const MAX_SAVED_MESSAGES = 50

const keyFor = (projectId: string, uid: string) => `nbn-chat:${uid}:${projectId}`

interface StoredMessage {
  id: string
  sender: 'user' | 'ai'
  content: string
  timestamp: string
  artifact?: ArtifactRef
}

// Raw string (or null). A string is a stable snapshot for useSyncExternalStore.
export function readStoredHistory(projectId: string, uid: string): string | null {
  try {
    return window.localStorage.getItem(keyFor(projectId, uid))
  } catch {
    return null // storage blocked (private mode etc.)
  }
}

export function parseHistory(raw: string | null): ChatMessage[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    const messages: ChatMessage[] = []
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const m = item as Partial<StoredMessage>
      if (
        typeof m.id !== 'string' ||
        typeof m.content !== 'string' ||
        typeof m.timestamp !== 'string' ||
        (m.sender !== 'user' && m.sender !== 'ai')
      ) {
        continue
      }
      const timestamp = new Date(m.timestamp)
      if (Number.isNaN(timestamp.getTime())) continue
      messages.push({
        id: m.id,
        sender: m.sender,
        content: m.content,
        timestamp,
        ...(m.artifact ? { artifact: m.artifact } : {}),
      })
    }
    return messages
  } catch {
    return []
  }
}

export function writeHistory(projectId: string, uid: string, messages: ChatMessage[]): void {
  try {
    const stored: StoredMessage[] = messages
      .filter((m) => !m.failed)
      .slice(-MAX_SAVED_MESSAGES)
      .map((m) => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        ...(m.artifact ? { artifact: m.artifact } : {}),
      }))
    window.localStorage.setItem(keyFor(projectId, uid), JSON.stringify(stored))
  } catch {
    // storage full or blocked: history just won't be saved
  }
}

export function clearHistory(projectId: string, uid: string): void {
  try {
    window.localStorage.removeItem(keyFor(projectId, uid))
  } catch {
    // nothing to clear
  }
}