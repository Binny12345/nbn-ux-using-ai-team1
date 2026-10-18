'use client'

import { useEffect } from 'react'
import { Info, X } from 'lucide-react'

export interface FeedToastData {
  id: number
  title: string
  message: string
}

interface FeedToastProps {
  toast: FeedToastData | null
  onDismiss: () => void
  onClick?: () => void
}

const AUTO_DISMISS_MS = 6000

export function FeedToast({ toast, onDismiss, onClick }: FeedToastProps) {
  // Restarts the timer whenever a new toast replaces the current one.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className="fixed right-7 bottom-7 z-[100]" role="status" aria-live="polite">
      <div className="border-marketing-border bg-marketing-card flex max-w-[340px] min-w-[280px] items-start gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 shadow-[0_8px_32px_rgba(26,108,255,0.14),0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="bg-marketing-field-bg mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <Info className="text-marketing-primary h-[15px] w-[15px]" />
        </div>
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-marketing-fg text-sm font-semibold">{toast.title}</p>
          <p className="text-marketing-muted mt-0.5 text-xs leading-relaxed">{toast.message}</p>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-marketing-muted-light hover:bg-marketing-bg hover:text-marketing-primary -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}