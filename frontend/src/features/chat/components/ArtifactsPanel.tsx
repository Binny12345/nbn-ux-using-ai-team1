'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getClientAuth } from '@/lib/firebase/client'

// Base URL of the separately deployed Express backend. A value without a scheme would be
// treated by the browser as a path relative to the current page, so default it to https.
// Matches the normalisation in hooks/useChat.ts.
const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '')
const API_BASE = rawApiUrl && !/^https?:\/\//i.test(rawApiUrl) ? `https://${rawApiUrl}` : rawApiUrl

interface Artifact {
  id: string
  fileName: string
  contentType: string
  size: number
  uploadedBy: string
  uploadedByName?: string | null
  role: string
  source?: 'upload' | 'ai'
}

// Get a fresh Firebase ID token for the Authorization header.
async function getToken(): Promise<string> {
  const auth = getClientAuth()
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

interface ArtifactsPanelProps {
  projectId: string
  onClose: () => void
  // Lets the parent keep a file-count badge in sync without re-fetching itself.
  onArtifactsChange?: (count: number) => void
}

export function ArtifactsPanel({ projectId, onClose, onArtifactsChange }: ArtifactsPanelProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const base = `${API_BASE}/api/projects/${projectId}/artifacts`

  useEffect(() => {
    onArtifactsChange?.(artifacts.length)
  }, [artifacts, onArtifactsChange])

  // ── Load the list ──────────────────────────────────────────────
  const loadArtifacts = useCallback(async () => {
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(base, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const data = await res.json()
      setArtifacts(data.artifacts ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts')
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    // Fetch-once-on-mount: the usual pattern for loading the list is a direct
    // call, same as useFirestore.ts's exhaustive-deps exception elsewhere.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadArtifacts()
  }, [loadArtifacts])

  // ── Upload ─────────────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const token = await getToken()
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(base, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }, // do NOT set Content-Type; the browser sets the multipart boundary
        body: form,
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail?.detail ?? `Upload failed (${res.status})`)
      }
      await loadArtifacts() // refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = '' // allow re-uploading the same file
    }
  }

  // ── Download ───────────────────────────────────────────────────
  // The download route is auth-gated and streams the file, so a plain <a href>
  // won't work (no token). Fetch with the token, then save the blob response.
  async function handleDownload(artifact: Artifact) {
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${base}/${artifact.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = artifact.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  // ── Delete ─────────────────────────────────────────────────────
  async function handleDelete(artifact: Artifact) {
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${base}/${artifact.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      setArtifacts((prev) => prev.filter((a) => a.id !== artifact.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="absolute inset-0 z-10 flex bg-black/20" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-80 flex-col gap-4 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Files</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="cursor-pointer rounded-md bg-black px-4 py-2 text-center text-sm font-medium text-white dark:bg-white dark:text-black">
          {uploading ? 'Uploading…' : 'Upload file'}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : artifacts.length === 0 ? (
            <p className="text-sm text-zinc-500">No artifacts yet. Upload one to get started.</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {artifacts.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{a.fileName}</span>
                      {a.source === 'ai' && (
                        <span
                          title="Generated by AI from a prompt"
                          className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
                        >
                          AI
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {formatSize(a.size)} · {a.uploadedByName ?? 'Teammate'}
                      {a.role ? ` (${a.role})` : ''}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => void handleDownload(a)}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => void handleDelete(a)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
