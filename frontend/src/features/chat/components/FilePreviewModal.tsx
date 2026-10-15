'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { MarkdownContent } from './MarkdownContent'
import { MAX_PREVIEW_BYTES, fetchArtifactBlob, previewKind, saveBlob } from '../lib/artifactApi'
import type { ArtifactRef } from '../types'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error'; message: string }

interface FilePreviewModalProps {
  projectId: string
  file: ArtifactRef
  onClose: () => void
}

// Render with key={file.id} so each file starts from a fresh loading state.
export function FilePreviewModal({ projectId, file, onClose }: FilePreviewModalProps) {
  const kind = previewKind(file)
  const tooLarge = file.size > MAX_PREVIEW_BYTES
  const canPreview = kind !== null && !tooLarge
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!canPreview) return
    let cancelled = false
    fetchArtifactBlob(projectId, file.id)
      .then((blob) => blob.text())
      .then((text) => {
        if (!cancelled) setState({ status: 'ready', text })
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load the file',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [canPreview, projectId, file.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleDownload() {
    setDownloadError(null)
    try {
      saveBlob(await fetchArtifactBlob(projectId, file.id), file.fileName)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${file.fileName}`}
        className="border-marketing-border bg-marketing-card flex max-h-[85vh] w-[760px] max-w-full flex-col overflow-hidden rounded-2xl border-[1.5px] shadow-[0_20px_60px_rgba(26,108,255,0.18)]"
      >
        <div className="border-marketing-border flex items-center gap-3 border-b-[1.5px] px-5 py-3.5">
          <span className="text-marketing-fg min-w-0 flex-1 truncate text-sm font-semibold">
            {file.fileName}
          </span>
          <button
            type="button"
            onClick={() => void handleDownload()}
            className="text-marketing-primary hover:bg-marketing-bg flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="text-marketing-muted-light hover:bg-marketing-bg hover:text-marketing-primary flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {downloadError && (
          <p role="alert" className="text-marketing-error px-5 pt-3 text-xs">
            {downloadError}
          </p>
        )}

        <div className="text-marketing-fg min-h-[120px] flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed">
          {!canPreview ? (
            <p className="text-marketing-muted-light">
              {tooLarge
                ? 'This file is too large to preview. Download it to open it.'
                : 'Preview is not available for this file type. Download it to open it.'}
            </p>
          ) : state.status === 'loading' ? (
            <p className="text-marketing-muted-light">Loading…</p>
          ) : state.status === 'error' ? (
            <p role="alert" className="text-marketing-error">
              {state.message}
            </p>
          ) : kind === 'markdown' ? (
            <MarkdownContent content={state.text} />
          ) : (
            <pre className="font-mono text-xs break-words whitespace-pre-wrap">{state.text}</pre>
          )}
        </div>
      </div>
    </div>
  )
}