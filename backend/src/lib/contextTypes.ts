import type { ArtifactBrief } from './artifacts'

export type ContextStatus = 'Active' | 'Outdated'

export interface ContextEntry {
  // Firestore document id — lets the extractor say which existing entry a new one replaces.
  id: string
  // The durable text of this contribution.
  content: string
  // What kind of entry this is (e.g. 'decision', 'requirement', 'note').
  type: string
  // Firebase uid of the user whose session produced it (attribution, FR-6).
  contributedBy: string
  // That user's project role at the time (e.g. 'BA', 'UX').
  role: string
  // Id of the chat the entry was extracted from — traceability to its source.
  sourceChatId: string
  // 'Active' or 'Outdated'. Only 'Active' entries are used as context.
  status: ContextStatus
}

export type ExtractedEntryType = 'decision' | 'requirement' | 'note'

// A durable fact pulled out of a chat exchange, ready to be saved as a context document.
export interface ExtractedEntry {
  content: string
  type: ExtractedEntryType
  // Id of an existing Active entry this one replaces (that entry becomes Outdated).
  replaces?: string
}

// `failed` means extraction could not run (every model failed, or the output was unusable),
// as opposed to the exchange simply containing nothing worth saving (entries empty, failed false).
export interface ExtractionResult {
  entries: ExtractedEntry[]
  failed: boolean
}

export interface ProjectMemberBrief {
  uid: string
  role: string
  displayName: string | null
}

export interface ProjectBriefing {
  projectName: string
  projectDescription: string
  status: string
  members: ProjectMemberBrief[]
  currentUser: { uid: string; role: string }
  context: ContextEntry[]
  artifacts: ArtifactBrief[]
}
