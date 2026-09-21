'use client'

import Link from 'next/link'
import { Menu, Folder, UserPlus } from 'lucide-react'
import type { ProjectSummary, UserProfile } from '../types'

interface ChatTopBarProps {
  project: ProjectSummary
  currentUser: UserProfile
  onOpenArtifacts: () => void
  onOpenInvite: () => void
}

export function ChatTopBar({ project, currentUser, onOpenArtifacts, onOpenInvite }: ChatTopBarProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <Link
          href="/projects"
          aria-label="Back to projects"
          className="rounded-md p-2 hover:bg-zinc-100"
        >
          <Menu className="h-5 w-5" />
        </Link>
        <button
          onClick={onOpenArtifacts}
          aria-label="View files"
          className="rounded-md p-2 hover:bg-zinc-100"
        >
          <Folder className="h-5 w-5" />
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold">{project.name}</p>
        <p className="text-xs text-zinc-500">
          {project.updatedAt
            ? `Last edited ${project.updatedAt.toLocaleDateString()} ${project.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'No edits yet'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenInvite}
          aria-label="Invite members"
          className="rounded-md p-2 hover:bg-zinc-100"
        >
          <UserPlus className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-xs font-medium leading-none">{currentUser.name}</p>
            <p className="text-[11px] text-zinc-500 leading-none mt-0.5">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </div>
  )
}