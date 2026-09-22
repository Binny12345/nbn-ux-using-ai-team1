// frontend/src/features/chat/components/ChatTopBar.tsx

'use client'

import Link from 'next/link'
import { Menu, Folder, UserPlus } from 'lucide-react'
import type { ProjectSummary, UserProfile } from '../types'

interface ChatTopBarProps {
  project: ProjectSummary
  currentUser: UserProfile
  fileCount: number
  isPM: boolean
  onOpenArtifacts: () => void
  onOpenInvite: () => void
}

export function ChatTopBar({ project, currentUser, fileCount, isPM, onOpenArtifacts, onOpenInvite }: ChatTopBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
      <div className="flex items-center gap-5">
        <Link
          href="/projects"
          aria-label="Back to projects"
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
        >
          <Menu className="h-4 w-4" />
          Menu
        </Link>
        <button
          onClick={onOpenArtifacts}
          aria-label="View files"
          className="relative flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white"
        >
          <Folder className="h-4 w-4" />
          Files
          {fileCount > 0 && (
            <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {fileCount}
            </span>
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-white">{project.name}</p>
        <p className="text-xs text-zinc-500">
          {project.updatedAt
            ? `Last edited ${project.updatedAt.toLocaleDateString()} at ${project.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'No edits yet'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenInvite}
          disabled={!isPM}
          aria-label="Invite members"
          title={!isPM ? 'Only the PM can invite new members' : undefined}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-600"
        >
          <UserPlus className="h-4 w-4" />
          Invite
        </button>
        <div className="flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-1.5">
          <div className="text-right">
            <p className="text-xs font-medium leading-none text-white">{currentUser.name}</p>
            <p className="text-[11px] text-zinc-500 leading-none mt-0.5">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </div>
  )
}