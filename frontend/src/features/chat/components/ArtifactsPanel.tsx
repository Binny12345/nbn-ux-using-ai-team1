'use client'

import { X, FileText, Download } from 'lucide-react'
import type { Artifact } from '../types'

interface ArtifactsPanelProps {
  artifacts: Artifact[]
  onClose: () => void
}

export function ArtifactsPanel({ artifacts, onClose }: ArtifactsPanelProps) {
  return (
    <div className="absolute inset-0 z-10 flex bg-black/20" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-80 flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <p className="text-sm font-semibold">Files</p>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {artifacts.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No files generated yet.</p>
          )}
          {artifacts.map((artifact) => (
            <a
            
              key={artifact.id}
              href={artifact.filePath}
              download
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-zinc-50"
            >
              <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
              <div className="flex-1 truncate">
                <p className="truncate font-medium">{artifact.title}</p>
                <p className="text-xs text-zinc-500">{artifact.type}</p>
              </div>
              <Download className="h-4 w-4 shrink-0 text-zinc-400" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}