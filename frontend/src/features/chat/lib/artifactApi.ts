import { getClientAuth } from '@/lib/firebase/client'
import type { Artifact } from '../types'

// Same normalisation as hooks/useChat.ts and FilesSidebar.tsx.
const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '')
const API_BASE = rawApiUrl && !/^https?:\/\//i.test(rawApiUrl) ? `https://${rawApiUrl}` : rawApiUrl

// Files bigger than this are download-only: rendering a huge document would freeze the tab.
export const MAX_PREVIEW_BYTES = 1024 * 1024

export type PreviewKind = 'markdown' | 'text'

// Which files can be shown in the preview, and how. null = download only.
export function previewKind(file: Pick<Artifact, 'fileName' | 'contentType'>): PreviewKind | null {
  const name = file.fileName.toLowerCase()
  if (/\.(md|markdown)$/.test(name) || file.contentType === 'text/markdown') return 'markdown'
  if (/\.(txt|csv)$/.test(name) || file.contentType === 'text/plain' || file.contentType === 'text/csv') {
    return 'text'
  }
  return null
}

async function getToken(): Promise<string> {
  const auth = getClientAuth()
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

// The download route is member-gated and streams the file, so it needs the auth header.
export async function fetchArtifactBlob(projectId: string, artifactId: string): Promise<Blob> {
  const token = await getToken()
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/artifacts/${artifactId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Could not load the file (${res.status})`)
  return res.blob()
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}