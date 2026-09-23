export interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  content: string
  timestamp: Date
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