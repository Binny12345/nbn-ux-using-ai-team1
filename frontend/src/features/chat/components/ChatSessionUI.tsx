'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useRouter } from 'next/navigation'
import { ChatTopBar } from './ChatTopBar'
import { ContextBanner } from './ContextBanner'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { FilesSidebar } from './FilesSidebar'
import { InviteModal } from './InviteModal'
import { EditDescriptionModal } from './EditDescriptionModal'
import { FeedToast, type FeedToastData } from './FeedToast'
import { FilePreviewModal } from './FilePreviewModal'
import { TypingIndicator } from './TypingIndicator'
import { WelcomeBackDialog } from './WelcomeBackDialog'
import { useChat } from '../hooks/useChat'
import { addContextEntry } from '../lib/contextApi'
import { clearHistory, parseHistory, readStoredHistory, writeHistory } from '../lib/chatHistory'
import { roleLabel } from '../lib/roleLabels'
import type {
  Artifact,
  ArtifactRef,
  ContextEntry,
  ProjectSummary,
  UserProfile,
} from '../types'

// How often the page re-reads the server component so teammates' new context shows up.
const CONTEXT_POLL_MS = 15_000

const noopSubscribe = () => () => {}

interface ChatSessionUIProps {
  project: ProjectSummary
  currentUser: UserProfile
  contextEntries: ContextEntry[]
}

export function ChatSessionUI({ project, currentUser, contextEntries }: ChatSessionUIProps) {
  const router = useRouter()
  const { messages, isSending, isGenerating, error, send, sessionId, restore, startNew } =
    useChat(project.id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Files teammates added since the sidebar was last opened (drives the red badge).
  const [unreadCount, setUnreadCount] = useState(0)
  // Bumped when /generate creates a file, so the sidebar reloads.
  const [filesRefreshKey, setFilesRefreshKey] = useState(0)
  const [showInvite, setShowInvite] = useState(false)
  const [showEditDescription, setShowEditDescription] = useState(false)
  const [previewFile, setPreviewFile] = useState<ArtifactRef | null>(null)
  const [toast, setToast] = useState<FeedToastData | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sidebarOpenRef = useRef(false)
  // null until the first render, which only seeds it (no notifications for existing entries).
  const seenContextIds = useRef<Set<string> | null>(null)

  // ── Saved conversation ("Welcome back") ────────────────────────────────────
  // Read from localStorage after hydration (null on the server), so there is no mismatch.
  const storedHistory = useSyncExternalStore(
    noopSubscribe,
    () => readStoredHistory(project.id, currentUser.uid),
    () => null
  )
  const saved = useMemo(() => parseHistory(storedHistory), [storedHistory])
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  // Only before anything has been said in this visit, so it can't pop up mid-chat.
  const showWelcome = !welcomeDismissed && messages.length === 0 && saved.length > 0
  const lastTopic = useMemo(
    () => [...saved].reverse().find((m) => m.sender === 'user')?.content ?? null,
    [saved]
  )

  // Keep the saved copy current. Never runs on an empty chat, so the welcome prompt's
  // saved history can't be overwritten before the user chooses.
  useEffect(() => {
    if (messages.length > 0) writeHistory(project.id, currentUser.uid, messages)
  }, [messages, project.id, currentUser.uid])

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
        const role = file.role ? ` (${roleLabel(file.role)})` : ''
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
      const role = entry.role ? ` (${roleLabel(entry.role)})` : ''
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

  // Highlighted text from an AI reply -> shared context.
  const handleUploadToContext = useCallback(
    async (text: string) => {
      await addContextEntry(project.id, sessionId, text)
      router.refresh()
    },
    [project.id, sessionId, router]
  )

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
                onViewFile={setPreviewFile}
                onUploadToContext={handleUploadToContext}
              />
            ))}

            {isSending && (
              <TypingIndicator label={isGenerating ? 'Generating document…' : undefined} />
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
        onPreview={setPreviewFile}
      />
      <FeedToast
        toast={toast}
        onDismiss={dismissToast}
        onClick={() => {
          dismissToast()
          openFiles()
        }}
      />
      {previewFile && (
        <FilePreviewModal
          key={previewFile.id}
          projectId={project.id}
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
      {showInvite && <InviteModal projectId={project.id} onClose={() => setShowInvite(false)} />}
      {showEditDescription && (
        <EditDescriptionModal
          projectId={project.id}
          currentDescription={project.description}
          onClose={() => setShowEditDescription(false)}
          onSaved={() => router.refresh()}
        />
      )}
      {showWelcome && (
        <WelcomeBackDialog
          userName={currentUser.name}
          projectName={project.name}
          lastActivity={saved[saved.length - 1]!.timestamp}
          lastTopic={lastTopic}
          onContinue={() => {
            restore(saved)
            setWelcomeDismissed(true)
          }}
          onStartNew={() => {
            clearHistory(project.id, currentUser.uid)
            startNew()
            setWelcomeDismissed(true)
          }}
        />
      )}
    </div>
  )
}