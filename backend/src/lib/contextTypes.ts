export interface ContextEntry {
  // The durable text of this contribution.
  content: string
  // What kind of entry this is (e.g. 'decision', 'requirement', 'note').
  type: string
  // Firebase uid of the user whose session produced it (attribution, FR-6).
  contributedBy: string
  // That user's project role at the time (e.g. 'BA', 'UX').
  role: string
}