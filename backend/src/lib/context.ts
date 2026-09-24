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


// A project member, as stored on the project document.
interface ProjectMember {
  uid: string
  role: string
}

export async function buildProjectContext(projectId: string, uid: string): Promise<ContextEntry[]> {
  const projectSnap = await adminDb.collection('projects').doc(projectId).get()
  if (!projectSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }

  const members = (projectSnap.get('members') as ProjectMember[] | undefined) ?? []
  if (!members.some((m) => m.uid === uid)) {
    throw HttpError.notFound('Project', projectId)
  }

  const contextSnap = await adminDb
    .collection('projects')
    .doc(projectId)
    .collection('context')
    .get()

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