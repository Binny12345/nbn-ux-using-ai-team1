'use client'

import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ListFilter, UserPlus, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { ProjectSummary, UserProfile } from '../types'

interface ChatTopBarProps {
  project: ProjectSummary
  currentUser: UserProfile
  unreadCount: number
  isPM: boolean
  onOpenFiles: () => void
  onOpenInvite: () => void
  onEditDescription: () => void
}

const noopSubscribe = () => () => {}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function ChatTopBar({
  project,
  currentUser,
  unreadCount,
  isPM,
  onOpenFiles,
  onOpenInvite,
  onEditDescription,
}: ChatTopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { signOut } = useAuth()
  // false during SSR and hydration, true afterwards: the browser's timezone differs from
  // the server's, so a locale-formatted time must only render client-side.
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )

  let lastEdited = 'No edits yet'
  if (project.updatedAt) {
    lastEdited = isClient
      ? `Last edited ${project.updatedAt.toLocaleDateString('en-AU')} at ${project.updatedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
      : '\u00A0'
  }

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
    <header className="border-marketing-border bg-marketing-card flex h-[58px] shrink-0 items-center gap-3 border-b-[1.5px] px-4">
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/projects"
          className="text-marketing-primary hover:bg-marketing-bg flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M9.5 3L5 7.5l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Menu
        </Link>

        <div className="bg-marketing-border h-[22px] w-px" />

        <div className="relative">
          <button
            onClick={onOpenFiles}
            aria-label={unreadCount > 0 ? `Files (${unreadCount} new)` : 'Files'}
            className="text-marketing-muted hover:bg-marketing-bg hover:text-marketing-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <ListFilter className="h-4 w-4" />
            Files
          </button>
          {unreadCount > 0 && (
            <span className="bg-marketing-error pointer-events-none absolute top-0.5 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold text-white shadow-[0_1px_4px_rgba(224,59,59,0.4)]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <span className="text-marketing-fg truncate text-sm leading-tight font-semibold">
          {project.name}
        </span>
        <span className="text-marketing-muted-light text-xs leading-tight">{lastEdited}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isPM && (
          <button
            onClick={onEditDescription}
            className="text-marketing-primary hover:bg-marketing-bg rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors"
          >
            Edit Description
          </button>
        )}

        <div className="group relative">
          <button
            onClick={onOpenInvite}
            disabled={!isPM}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isPM
                ? 'text-marketing-primary hover:bg-marketing-bg'
                : 'bg-marketing-field-bg text-marketing-muted-light cursor-not-allowed'
            }`}
          >
            <UserPlus className="h-[15px] w-[15px]" />
            Invite
          </button>
          {!isPM && (
            <div className="pointer-events-none absolute top-full right-0 z-[60] mt-1.5 rounded-lg bg-[#1a2b4a] px-3 py-2 text-xs whitespace-nowrap text-white opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-opacity duration-150 group-hover:opacity-100">
              Only the PM can invite new members
              <div className="absolute -top-[5px] right-[18px] h-2.5 w-2.5 rotate-45 rounded-sm bg-[#1a2b4a]" />
            </div>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={`border-marketing-border flex items-center gap-2 rounded-lg border-[1.5px] px-3 py-2 transition-colors ${
              dropdownOpen ? 'bg-marketing-bg' : 'hover:bg-marketing-bg'
            }`}
          >
            <div className="bg-marketing-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
              {initials(currentUser.name)}
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-marketing-fg text-xs font-semibold">{currentUser.name}</span>
              <span className="text-marketing-muted-light text-xs">
                {currentUser.role} · {project.name}
              </span>
            </div>
            <ChevronDown
              className={`text-marketing-muted-light h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="border-marketing-border bg-marketing-card absolute top-full right-0 z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border-[1.5px] shadow-[0_8px_24px_rgba(26,108,255,0.12)]">
              <div className="border-marketing-border border-b px-4 py-3">
                <div className="text-marketing-fg text-sm font-semibold">{currentUser.name}</div>
                {currentUser.email && (
                  <div className="text-marketing-muted-light mt-0.5 text-xs">
                    {currentUser.email}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="bg-marketing-field-bg text-marketing-primary rounded-full px-2 py-0.5 text-xs font-medium">
                    {currentUser.role}
                  </span>
                  <span className="text-marketing-muted-light text-xs">{project.name}</span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-marketing-error hover:bg-marketing-danger-bg flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors"
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
