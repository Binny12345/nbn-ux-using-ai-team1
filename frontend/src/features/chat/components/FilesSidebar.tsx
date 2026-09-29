'use client'

import { X, FileText, Upload } from 'lucide-react'
import type { Artifact } from '../types'

interface FilesSidebarProps {
  open: boolean
  artifacts: Artifact[]
  onClose: () => void
}

export function FilesSidebar({ open, artifacts, onClose }: FilesSidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/[0.18]"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-full w-[300px] flex-col border-r-[1.5px] border-marketing-border bg-marketing-card transition-transform duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
          open ? 'translate-x-0 shadow-[4px_0_32px_rgba(26,108,255,0.1)]' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b-[1.5px] border-marketing-border px-5 py-4">
          <span className="text-sm font-semibold tracking-[0.06em] text-marketing-primary">
            PROJECT FILES
          </span>
          <button
            onClick={onClose}
            aria-label="Close files panel"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-marketing-muted-light transition-colors hover:bg-marketing-bg hover:text-marketing-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {artifacts.length === 0 && (
            <p className="px-5 py-4 text-sm text-marketing-muted-light">No files yet.</p>
          )}
          {artifacts.map((file) => (
            <a
              key={file.id}
              href={file.filePath}
              download
              className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-marketing-bg"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-marketing-muted" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-marketing-fg">{file.title}</span>
                <span className="mt-0.5 text-xs text-marketing-muted-light">
                  {file.contributedByName ?? 'Unknown'}
                  {file.contributedByRole ? ` (${file.contributedByRole})` : ''}
                </span>
              </div>
            </a>
          ))}
        </div>

        <div className="shrink-0 border-t-[1.5px] border-marketing-border px-4 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-marketing-border-hover bg-marketing-bg py-2.5 text-sm font-semibold text-marketing-primary transition-colors hover:border-marketing-primary hover:bg-marketing-border"
          >
            <Upload className="h-[15px] w-[15px]" />
            Upload File
          </button>
        </div>
      </aside>
    </>
  )
}