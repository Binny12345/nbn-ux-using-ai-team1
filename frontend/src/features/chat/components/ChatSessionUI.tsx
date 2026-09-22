'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatTopBar } from './ChatTopBar'
import { ContextBanner } from './ContextBanner'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ArtifactsPanel } from './ArtifactsPanel'
import { InviteModal } from './InviteModal'
import type { ChatMessage, Artifact, ProjectSummary, UserProfile } from '../types'

interface ChatSessionUIProps {
  project: ProjectSummary
  currentUser: UserProfile
  contextSummary: string | null
  artifacts: Artifact[]
}

export function ChatSessionUI({ project, currentUser, contextSummary, artifacts }: ChatSessionUIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showArtifacts, setShowArtifacts] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = (content: string) => {
    // TODO: replace with real call to John's AI endpoint once ready.
    // Should POST to something like /api/projects/{projectId}/chat,
    // which handles context injection + AI call + buffer append server-side.
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sender: 'user', content, timestamp: new Date() },
    ])
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
        <ContextBanner contextSummary={contextSummary} />
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      <ChatInput onSend={handleSend} />

      {showArtifacts && <ArtifactsPanel artifacts={artifacts} onClose={() => setShowArtifacts(false)} />}
      {showInvite && <InviteModal projectId={project.id} onClose={() => setShowInvite(false)} />}
    </div>
  )
}