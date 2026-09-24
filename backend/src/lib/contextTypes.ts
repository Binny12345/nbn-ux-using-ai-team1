export type ContextStatus = 'Active' | 'Outdated'
 
export interface ContextEntry {
  // The durable text of this contribution.
  content: string
  // What kind of entry this is (e.g. 'decision', 'requirement', 'note').
  type: string
  // Firebase uid of the user whose session produced it (attribution, FR-6).
  contributedBy: string
  // That user's project role at the time (e.g. 'BA', 'UX'). */
  role: string
  // Id of the chat the entry was extracted from — traceability to its source.
  sourceChatId: string
  // 'Active' or 'Outdated'. Only 'Active' entries are used as context.
  status: ContextStatus
}
