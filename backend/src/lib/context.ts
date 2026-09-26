import { adminDb } from './firebase'
import { HttpError } from './errors'
import type { ContextEntry, ContextStatus } from './contextTypes'

// One context document as stored under projects/{id}/context/{entryId}. */
interface StoredEntry {
  content: string
  type: string
  contributedBy: string
  role: string
  sourceChatId?: string
  status?: ContextStatus
}

export async function buildProjectContext(projectId: string, uid: string): Promise<ContextEntry[]> {
  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectSnap = await projectRef.get()
  if (!projectSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }

  // Membership + role live in the members subcollection, not a field on the
  // project doc — same source the frontend's getUserRoleForProject() reads.
  const memberSnap = await projectRef.collection('members').doc(uid).get()
  if (!memberSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }

  const contextSnap = await projectRef.collection('context').get()

  const entries: ContextEntry[] = []
  contextSnap.forEach((doc) => {
    const d = doc.data() as StoredEntry
    // Skip superseded entries — only Active context is used.
    if (d.status && d.status !== 'Active') return
    entries.push({
      content: d.content,
      type: d.type,
      contributedBy: d.contributedBy,
      role: d.role,
      sourceChatId: d.sourceChatId ?? '',
      status: 'Active',
    })
  })

  return entries
}

export async function getUserRoleForProject(projectId: string, uid: string): Promise<string | null> {
  const memberSnap = await adminDb
    .collection('projects')
    .doc(projectId)
    .collection('members')
    .doc(uid)
    .get()

  if (!memberSnap.exists) return null

  return (memberSnap.data()?.role as string | undefined) ?? null
}