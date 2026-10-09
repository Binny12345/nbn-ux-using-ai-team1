'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, FileText, Upload, Download, Trash2 } from 'lucide-react'
import { getClientAuth } from '@/lib/firebase/client'
import type { Artifact } from '../types'

// Base URL of the separately deployed Express backend. A value without a scheme would be
// treated by the browser as a path relative to the current page, so default it to https.
// Matches the normalisation in hooks/useChat.ts.
const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '')
const API_BASE = rawApiUrl && !/^https?:\/\//i.test(rawApiUrl) ? `https://${rawApiUrl}` : rawApiUrl
const POLL_MS = 15_000

// Get a fresh Firebase ID token for the Authorization header.
async function getToken(): Promise<string> {
  const auth = getClientAuth()
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return user.getIdToken()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FilesSidebarProps {
  open: boolean
  projectId: string
  currentUserId: string
  onClose: () => void
  // Called when teammates add files after the first load (never for your own uploads).
  onNewArtifacts?: (added: Artifact[]) => void
  // Change this to make the sidebar reload (e.g. after /generate creates a file).
  refreshKey?: number
}

export function FilesSidebar({
  open,
  projectId,
  currentUserId,
  onClose,
  onNewArtifacts,
  refreshKey = 0,
}: FilesSidebarProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Ids seen so far. null until the first load, which only seeds it (no notifications).
  const knownIds = useRef<Set<string> | null>(null)
  const onNewRef = useRef(onNewArtifacts)

  const base = `${API_BASE}/api/projects/${projectId}/artifacts`

  useEffect(() => {
    onNewRef.current = onNewArtifacts
  }, [onNewArtifacts])

  // ── Load the list ──────────────────────────────────────────────
  // silent = background poll: don't touch the error banner.
  const loadArtifacts = useCallback(
    async (silent = false) => {
      if (!silent) setError(null)
      try {
        const token = await getToken()
        const res = await fetch(base, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`Failed to load (${res.status})`)
        const data = await res.json()
        const list: Artifact[] = data.artifacts ?? []
        setArtifacts(list)

        // Work out which files are new since the last load.
        const known = knownIds.current
        if (known === null) {
          knownIds.current = new Set(list.map((a) => a.id))
        } else {
          const added = list.filter((a) => !known.has(a.id))
          for (const a of added) known.add(a.id)
          const fromTeammates = added.filter((a) => a.uploadedBy !== currentUserId)
          if (fromTeammates.length > 0) onNewRef.current?.(fromTeammates)
        }
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : 'Failed to load files')
      } finally {
        setLoading(false)
      }
    },
    [base, currentUserId]
  )

  // Loads on page load, each time the sidebar opens, and whenever refreshKey changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadArtifacts()
  }, [loadArtifacts, open, refreshKey])

  // Background poll so teammates' uploads show up without anyone opening the panel.
  // Pauses while the tab is hidden and catches up as soon as it is visible again.
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') void loadArtifacts(true)
    }
    const timer = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', poll)
    }
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
      await loadArtifacts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = '' // allow re-uploading the same file
    }
  }

  // ── Download ───────────────────────────────────────────────────
  // The download route is auth-gated and streams the file, so a plain <a href> won't work
  // (no token). Fetch with the token, then save the blob response.
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

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/[0.18]" onClick={onClose} />}
      <aside
        // Always mounted so the list can load early; inert keeps it out of the tab order while closed.
        inert={!open}
        aria-hidden={!open}
        className={`border-marketing-border bg-marketing-card fixed top-0 left-0 z-30 flex h-full w-[300px] flex-col border-r-[1.5px] transition-transform duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
          open ? 'translate-x-0 shadow-[4px_0_32px_rgba(26,108,255,0.1)]' : '-translate-x-full'
        }`}
      >
        <div className="border-marketing-border flex items-center justify-between border-b-[1.5px] px-5 py-4">
          <span className="text-marketing-primary text-sm font-semibold tracking-[0.06em]">
            PROJECT FILES
          </span>
          <button
            onClick={onClose}
            aria-label="Close files panel"
            className="text-marketing-muted-light hover:bg-marketing-bg hover:text-marketing-primary flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p role="alert" className="text-marketing-error px-5 pt-3 text-xs">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <p className="text-marketing-muted-light px-5 py-4 text-sm">Loading…</p>
          ) : artifacts.length === 0 ? (
            <p className="text-marketing-muted-light px-5 py-4 text-sm">No files yet.</p>
          ) : (
            <ul>
              {artifacts.map((file) => (
                <li
                  key={file.id}
                  className="hover:bg-marketing-bg flex items-start gap-3 px-5 py-3 transition-colors"
                >
                  <FileText className="text-marketing-muted mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="text-marketing-fg truncate text-sm font-medium">
                        {file.fileName}
                      </span>
                      {file.source === 'ai' && (
                        <span
                          title="Generated by AI from a prompt"
                          className="bg-marketing-field-bg text-marketing-primary shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        >
                          AI
                        </span>
                      )}
                    </span>
                    <span className="text-marketing-muted-light mt-0.5 text-xs">
                      {formatSize(file.size)} · {file.uploadedByName ?? 'Teammate'}
                      {file.role ? ` (${file.role})` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={() => void handleDownload(file)}
                      aria-label={`Download ${file.fileName}`}
                      className="text-marketing-muted-light hover:bg-marketing-field-bg hover:text-marketing-primary flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                    >
                      <Download className="h-[15px] w-[15px]" />
                    </button>
                    <button
                      onClick={() => void handleDelete(file)}
                      aria-label={`Delete ${file.fileName}`}
                      className="text-marketing-muted-light hover:bg-marketing-danger-bg hover:text-marketing-error flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                    >
                      <Trash2 className="h-[15px] w-[15px]" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-marketing-border shrink-0 border-t-[1.5px] px-4 py-3">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="border-marketing-border-hover bg-marketing-bg text-marketing-primary hover:border-marketing-primary hover:bg-marketing-border flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            <Upload className="h-[15px] w-[15px]" />
            {uploading ? 'Uploading…' : 'Upload File'}
          </button>
        </div>
      </aside>
    </>
  )
}
