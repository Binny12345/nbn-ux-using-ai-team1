export interface ChatMessage {
  id: string
  sender: 'user' | 'ai'
  content: string
  timestamp: Date
  failed?: boolean
  // Shown under the message, e.g. when this exchange could not be saved to the shared context.
  notice?: string
}

export interface ContextEntry {
  id: string
  content: string
  type: string
  role: string
  contributorName: string | null
  contributedBy: string
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
  uid: string
  name: string
  role: string
  email?: string | null
}
