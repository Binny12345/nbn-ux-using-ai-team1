export interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  content: string
  timestamp: Date
  failed?: boolean
}

export interface ContextEntry {
  id: string
  content: string
  type: string
  role: string
  contributorName: string | null
}

export interface Artifact {
  id: string
  title: string
  type: string
  filePath: string
  createdAt: Date
}

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: Date | null
}

export interface UserProfile {
  name: string
  role: string
}
