'use client'

import { X } from 'lucide-react'
import { AddMemberForm } from '@/features/projects/components/AddMemberForm'

interface InviteModalProps {
  projectId: string
  onClose: () => void
}

export function InviteModal({ projectId, onClose }: InviteModalProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Invite a member</p>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <AddMemberForm projectId={projectId} />
      </div>
    </div>
  )
}