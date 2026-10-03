'use client'

import { X, Info } from 'lucide-react'

interface FileToastProps {
  visible: boolean
  uploaderName: string
  fileName: string
  onDismiss: () => void
}

export function FileToast({ visible, uploaderName, fileName, onDismiss }: FileToastProps) {
  return (
    <div
      className={`fixed bottom-7 right-7 z-[100] transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[120%] opacity-0'
      }`}
    >
      <div className="flex min-w-[280px] max-w-[340px] items-start gap-3 rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card px-4 py-3.5 shadow-[0_8px_32px_rgba(26,108,255,0.14),0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marketing-field-bg">
          <Info className="h-[15px] w-[15px] text-marketing-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-marketing-fg">New file shared</p>
          <p className="mt-0.5 text-xs leading-relaxed text-marketing-muted">
            {uploaderName} uploaded <span className="font-semibold text-marketing-primary">{fileName}</span> to the
            project.
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-marketing-muted-light transition-colors hover:bg-marketing-bg hover:text-marketing-primary"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}