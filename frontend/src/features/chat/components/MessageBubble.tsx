'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, FileText, Upload } from 'lucide-react'
import { MarkdownContent } from './MarkdownContent'
import type { ArtifactRef, ChatMessage } from '../types'

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export function MessageBubble({
  message,
  currentUserName,
  onViewFile,
  onUploadToContext,
}: {
  message: ChatMessage
  currentUserName: string
  onViewFile?: (file: ArtifactRef) => void
  // Saves highlighted text from an AI reply to the shared context. Rejects on failure.
  onUploadToContext?: (text: string) => Promise<void>
}) {
  const isUser = message.sender === 'user'
  const artifact = message.artifact
  const canUpload = !isUser && !!onUploadToContext

  const bodyRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')

  // True when the current text selection sits entirely inside this message's text.
  function selectionInsideBody() {
    const selection = window.getSelection()
    const body = bodyRef.current
    if (!selection || !body || selection.toString().trim() === '') return null
    if (!body.contains(selection.anchorNode) || !body.contains(selection.focusNode)) return null
    return selection.toString().trim()
  }

  function captureSelection() {
    if (!canUpload) return
    const text = selectionInsideBody()
    if (!text) return
    setSelected(text)
    setUploadState('idle')
  }

  // Hide the button once the selection is cleared or moves to another message.
  useEffect(() => {
    if (!canUpload) return
    const clearIfGone = () => {
      const selection = window.getSelection()
      const body = bodyRef.current
      const inside =
        !!selection &&
        !!body &&
        selection.toString().trim() !== '' &&
        body.contains(selection.anchorNode) &&
        body.contains(selection.focusNode)
      if (!inside) {
        setSelected(null)
        setUploadState('idle')
      }
    }
    document.addEventListener('selectionchange', clearIfGone)
    return () => document.removeEventListener('selectionchange', clearIfGone)
  }, [canUpload])

  async function upload() {
    if (!selected || !onUploadToContext) return
    if (uploadState === 'uploading' || uploadState === 'done') return
    setUploadState('uploading')
    try {
      await onUploadToContext(selected)
      setUploadState('done')
    } catch {
      setUploadState('error')
    }
  }

  const uploadLabel =
    uploadState === 'uploading'
      ? 'Adding…'
      : uploadState === 'done'
        ? 'Added to context'
        : uploadState === 'error'
          ? "Couldn't add. Try again"
          : 'Upload to context'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? 'bg-marketing-field-bg text-marketing-primary'
            : 'from-marketing-primary to-marketing-primary-dark bg-gradient-to-br text-white shadow-[0_2px_8px_rgba(26,108,255,0.3)]'
        }`}
      >
        {isUser ? initials(currentUserName) : 'AI'}
      </div>
      <div
        className={`flex max-w-[75%] min-w-0 flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`max-w-full rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-marketing-primary rounded-br-[4px] text-white'
              : 'border-marketing-border bg-marketing-card text-marketing-fg rounded-bl-[4px] border-[1.5px] shadow-[0_1px_6px_rgba(26,108,255,0.06)]'
          }`}
        >
          {isUser ? (
            // User text stays plain: someone typing * or # shouldn't get surprise formatting.
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div
              ref={bodyRef}
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
              className="cursor-text selection:bg-yellow-200 selection:text-inherit"
            >
              <MarkdownContent content={message.content} />
            </div>
          )}
          {artifact && onViewFile && (
            <button
              type="button"
              onClick={() => onViewFile(artifact)}
              className="border-marketing-border-hover bg-marketing-bg text-marketing-primary hover:border-marketing-primary mt-3 flex items-center gap-1.5 rounded-lg border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              View document
            </button>
          )}
        </div>
        {canUpload && selected && (
          <button
            type="button"
            // Keeps the yellow text selection alive while the button is clicked.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void upload()}
            disabled={uploadState === 'uploading' || uploadState === 'done'}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              uploadState === 'done'
                ? 'bg-[#e9f8f0] text-[#24865b]'
                : uploadState === 'error'
                  ? 'bg-marketing-danger-bg text-marketing-error'
                  : 'bg-marketing-field-bg text-marketing-primary hover:bg-marketing-border'
            }`}
          >
            {uploadState === 'done' ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploadLabel}
          </button>
        )}
        {message.notice && (
          <span role="status" className="text-marketing-warning text-xs">
            {message.notice}
          </span>
        )}
        <span className="text-marketing-muted-light text-xs">
          {message.timestamp.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}