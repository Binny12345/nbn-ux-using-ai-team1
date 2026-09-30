'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu as MenuIcon, ListFilter, UserPlus, ChevronDown, LogOut, Pencil } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { ProjectSummary, UserProfile } from '../types'

interface ChatTopBarProps {
  project: ProjectSummary
  currentUser: UserProfile
  fileCount: number
  isPM: boolean
  onOpenFiles: () => void
  onOpenInvite: () => void
  onEditDescription: () => void
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function ChatTopBar({ project, currentUser, fileCount, isPM, onOpenFiles, onOpenInvite, onEditDescription }: ChatTopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { signOut } = useAuth()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/signin')
    router.refresh()
  }

  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b-[1.5px] border-marketing-border bg-marketing-card px-4">
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-marketing-primary transition-colors hover:bg-marketing-bg"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M9.5 3L5 7.5l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Menu
        </Link>

        <div className="h-[22px] w-px bg-marketing-border" />

        <div className="relative">
          <button
            onClick={onOpenFiles}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-marketing-muted transition-colors hover:bg-marketing-bg hover:text-marketing-primary"
          >
            <ListFilter className="h-4 w-4" />
            Files
          </button>
          {fileCount > 0 && (
            <span className="pointer-events-none absolute -right-1 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-marketing-error px-1 text-[10px] font-bold leading-none text-white shadow-[0_1px_4px_rgba(224,59,59,0.4)]">
              {fileCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-tight text-marketing-fg">{project.name}</span>
          {isPM && (
            <button
              onClick={onEditDescription}
              aria-label="Edit project description"
              className="rounded p-0.5 text-marketing-muted-light transition-colors hover:bg-marketing-bg hover:text-marketing-primary"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        <span className="text-xs leading-tight text-marketing-muted-light">
          {project.updatedAt
            ? `Last edited ${project.updatedAt.toLocaleDateString('en-AU')} at ${project.updatedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
            : 'No edits yet'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="group relative">
          <button
            onClick={onOpenInvite}
            disabled={!isPM}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isPM
                ? 'text-marketing-primary hover:bg-marketing-bg'
                : 'cursor-not-allowed bg-marketing-field-bg text-marketing-muted-light'
            }`}
          >
            <UserPlus className="h-[15px] w-[15px]" />
            Invite
          </button>
          {!isPM && (
            <div className="pointer-events-none absolute right-0 top-full z-[60] mt-1.5 whitespace-nowrap rounded-lg bg-[#1a2b4a] px-3 py-2 text-xs text-white opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-opacity duration-150 group-hover:opacity-100">
              Only the PM can invite new members
              <div className="absolute -top-[5px] right-[18px] h-2.5 w-2.5 rotate-45 rounded-sm bg-[#1a2b4a]" />
            </div>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border-[1.5px] border-marketing-border px-3 py-2 transition-colors ${
              dropdownOpen ? 'bg-marketing-bg' : 'hover:bg-marketing-bg'
            }`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marketing-primary text-xs font-bold text-white">
              {initials(currentUser.name)}
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-semibold text-marketing-fg">{currentUser.name}</span>
              <span className="text-xs text-marketing-muted-light">
                {currentUser.role} · {project.name}
              </span>
            </div>
            <ChevronDown className={`h-3 w-3 text-marketing-muted-light transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border-[1.5px] border-marketing-border bg-marketing-card shadow-[0_8px_24px_rgba(26,108,255,0.12)]">
              <div className="border-b border-marketing-border px-4 py-3">
                <div className="text-sm font-semibold text-marketing-fg">{currentUser.name}</div>
                {currentUser.email && (
                  <div className="mt-0.5 text-xs text-marketing-muted-light">{currentUser.email}</div>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded-full bg-marketing-field-bg px-2 py-0.5 text-xs font-medium text-marketing-primary">
                    {currentUser.role}
                  </span>
                  <span className="text-xs text-marketing-muted-light">{project.name}</span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-marketing-error transition-colors hover:bg-marketing-danger-bg"
              >
                <LogOut className="h-[15px] w-[15px]" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}