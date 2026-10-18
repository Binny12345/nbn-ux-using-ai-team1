'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChatTopBar } from './ChatTopBar'
import { ContextBanner } from './ContextBanner'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { FilesSidebar } from './FilesSidebar'
import { InviteModal } from './InviteModal'
import { EditDescriptionModal } from './EditDescriptionModal'
import { FeedToast, type FeedToastData } from './FeedToast'
import { useChat } from '../hooks/useChat'
import type { Artifact, ContextEntry, ProjectSummary, UserProfile } from '../types'

// How often the page re-reads the server component so teammates' new context shows up.
const CONTEXT_POLL_MS = 15_000

interface ChatSessionUIProps {
  project: ProjectSummary
  currentUser: UserProfile
  contextEntries: ContextEntry[]
}

export function ChatSessionUI({ project, currentUser, contextEntries }: ChatSessionUIProps) {
  const router = useRouter()
  const { messages, isSending, isGenerating, error, send } = useChat(project.id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Files teammates added since the sidebar was last opened (drives the red badge).
  const [unreadCount, setUnreadCount] = useState(0)
  // Bumped when /generate creates a file, so the sidebar reloads.
  const [filesRefreshKey, setFilesRefreshKey] = useState(0)
  const [showInvite, setShowInvite] = useState(false)
  const [showEditDescription, setShowEditDescription] = useState(false)
  const [toast, setToast] = useState<FeedToastData | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sidebarOpenRef = useRef(false)
  // null until the first render, which only seeds it (no notifications for existing entries).
  const seenContextIds = useRef<Set<string> | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen
  }, [sidebarOpen])

  const showToast = useCallback((title: string, message: string) => {
    setToast({ id: Date.now(), title, message })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  const openFiles = useCallback(() => {
    setSidebarOpen(true)
    setUnreadCount(0)
  }, [])

  // ── New files from teammates (reported by FilesSidebar's poll) ─────────────
  const handleNewArtifacts = useCallback(
    (added: Artifact[]) => {
      if (!sidebarOpenRef.current) setUnreadCount((c) => c + added.length)

      if (added.length === 1) {
        const file = added[0]!
        const who = file.uploadedByName ?? 'A teammate'
        const role = file.role ? ` (${file.role})` : ''
        const verb = file.source === 'ai' ? 'generated' : 'uploaded'
        showToast('New file shared', `${who}${role} ${verb} ${file.fileName} in the project.`)
      } else {
        showToast('New files shared', `${added.length} new files were added to the project.`)
      }
    },
    [showToast]
  )

  // ── New contributions from teammates ───────────────────────────────────────
  // Re-render the server component on an interval so new context entries arrive...
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = setInterval(poll, CONTEXT_POLL_MS)
    return () => clearInterval(timer)
  }, [router])

  // ...and toast when entries appear that someone else contributed.
  useEffect(() => {
    if (seenContextIds.current === null) {
      seenContextIds.current = new Set(contextEntries.map((e) => e.id))
      return
    }
    const seen = seenContextIds.current
    const added = contextEntries.filter((e) => !seen.has(e.id))
    for (const entry of added) seen.add(entry.id)

    const fromTeammates = added.filter((e) => e.contributedBy !== currentUser.uid)
    if (fromTeammates.length === 0) return

    if (fromTeammates.length === 1) {
      const entry = fromTeammates[0]!
      const who = entry.contributorName ?? 'A teammate'
      const role = entry.role ? ` (${entry.role})` : ''
      showToast('New contribution', `${who}${role} added a ${entry.type} to the project context.`)
    } else {
      showToast(
        'New contributions',
        `${fromTeammates.length} new entries were added to the project context.`
      )
    }
  }, [contextEntries, currentUser.uid, showToast])

  const handleSend = async (content: string) => {
    const result = await send(content)
    // New shared context was saved — re-run the server component so the banner shows it.
    if (result && result.entriesWritten > 0) router.refresh()
    if (result?.artifactCreated) setFilesRefreshKey((k) => k + 1)
  }

  return (
    <div className="bg-marketing-bg relative flex h-screen flex-col overflow-hidden">
      <ChatTopBar
        project={project}
        currentUser={currentUser}
        unreadCount={unreadCount}
        isPM={currentUser.role === 'PM'}
        onOpenFiles={openFiles}
        onOpenInvite={() => setShowInvite(true)}
        onEditDescription={() => setShowEditDescription(true)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
            <ContextBanner entries={contextEntries} />

            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                currentUserName={currentUser.name}
              />
            ))}

            {isSending && (
              <div className="flex gap-3">
                <div className="from-marketing-primary to-marketing-primary-dark flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white">
                  AI
                </div>
                <div className="border-marketing-border bg-marketing-card text-marketing-muted-light rounded-2xl rounded-bl-[4px] border-[1.5px] px-4 py-3 text-sm">
                  {isGenerating ? 'Generating document…' : 'Thinking…'}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-marketing-error text-sm">
                {error}
              </p>
            )}
          </div>
        </div>

        <ChatInput onSend={(content) => void handleSend(content)} disabled={isSending} />
      </div>

      <FilesSidebar
        open={sidebarOpen}
        projectId={project.id}
        currentUserId={currentUser.uid}
        refreshKey={filesRefreshKey}
        onClose={() => setSidebarOpen(false)}
        onNewArtifacts={handleNewArtifacts}
      />
      <FeedToast
        toast={toast}
        onDismiss={dismissToast}
        onClick={() => {
          dismissToast()
          openFiles()
        }}
      />
      {showInvite && <InviteModal projectId={project.id} onClose={() => setShowInvite(false)} />}
      {showEditDescription && (
        <EditDescriptionModal
          projectId={project.id}
          currentDescription={project.description}
          onClose={() => setShowEditDescription(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  )
}