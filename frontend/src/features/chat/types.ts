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

// As returned by GET /api/projects/:id/artifacts.
export interface Artifact {
  id: string
  fileName: string
  contentType: string
  size: number
  uploadedBy: string
  uploadedByName?: string | null
  role: string
  source?: 'upload' | 'ai'
}

export interface ProjectSummary {
  id: string
  name: string
  description: string
  updatedAt: Date | null
}

export interface UserProfile {
  name: string
  role: string
  email?: string | null
}
