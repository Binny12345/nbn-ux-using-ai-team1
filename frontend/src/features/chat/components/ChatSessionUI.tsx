'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChatTopBar } from './ChatTopBar'
import { ContextBanner } from './ContextBanner'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { FilesSidebar } from './FilesSidebar'
import { InviteModal } from './InviteModal'
import { EditDescriptionModal } from './EditDescriptionModal'
import { useChat } from '../hooks/useChat'
import type { ContextEntry, ProjectSummary, UserProfile } from '../types'

interface ChatSessionUIProps {
  project: ProjectSummary
  currentUser: UserProfile
  contextEntries: ContextEntry[]
}

export function ChatSessionUI({ project, currentUser, contextEntries }: ChatSessionUIProps) {
  const router = useRouter()
  const { messages, isSending, isGenerating, error, send } = useChat(project.id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fileCount, setFileCount] = useState(0)
  // Bumped when /generate creates a file, so the sidebar reloads and the badge updates.
  const [filesRefreshKey, setFilesRefreshKey] = useState(0)
  const [showInvite, setShowInvite] = useState(false)
  const [showEditDescription, setShowEditDescription] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

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
        fileCount={fileCount}
        isPM={currentUser.role === 'PM'}
        onOpenFiles={() => setSidebarOpen(true)}
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
        refreshKey={filesRefreshKey}
        onClose={() => setSidebarOpen(false)}
        onArtifactsChange={setFileCount}
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
