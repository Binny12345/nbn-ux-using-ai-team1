'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChatTopBar } from './ChatTopBar'
import { ContextBanner } from './ContextBanner'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ArtifactsPanel } from './ArtifactsPanel'
import { InviteModal } from './InviteModal'
import { useChat } from '../hooks/useChat'
import type { Artifact, ContextEntry, ProjectSummary, UserProfile } from '../types'

interface ChatSessionUIProps {
  project: ProjectSummary
  currentUser: UserProfile
  contextEntries: ContextEntry[]
  artifacts: Artifact[]
}

export function ChatSessionUI({ project, currentUser, contextEntries, artifacts }: ChatSessionUIProps) {
  const router = useRouter()
  const { messages, isSending, error, send } = useChat(project.id)
  const [showArtifacts, setShowArtifacts] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isSending])

  const handleSend = async (content: string) => {
    const result = await send(content)
    // New shared context was saved — re-run the server component so the banner shows it.
    if (result && result.entriesWritten > 0) router.refresh()
  }

  return (
    <div className="relative flex h-screen flex-col bg-zinc-950">
      <ChatTopBar
        project={project}
        currentUser={currentUser}
        fileCount={artifacts.length}
        isPM={currentUser.role === 'PM'}
        onOpenArtifacts={() => setShowArtifacts(true)}
        onOpenInvite={() => setShowInvite(true)}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <ContextBanner entries={contextEntries} />
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 text-sm text-zinc-500">
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>

      <ChatInput onSend={(content) => void handleSend(content)} disabled={isSending} />

      {showArtifacts && <ArtifactsPanel artifacts={artifacts} onClose={() => setShowArtifacts(false)} />}
      {showInvite && <InviteModal projectId={project.id} onClose={() => setShowInvite(false)} />}
    </div>
  )
}
