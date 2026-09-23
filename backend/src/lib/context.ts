import { adminDb } from './firebase'
import { HttpError } from './errors'
import type { ContextEntry } from './contextTypes'

// One stored contribution as held in Firestore (a project's context sections).
interface StoredSection {
  content: string
  type?: string
  contributedBy: string
  role: string
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
    const sections = (doc.get('sections') as StoredSection[] | undefined) ?? []
    for (const s of sections) {
      entries.push({
        content: s.content,
        type: s.type ?? 'note',
        contributedBy: s.contributedBy,
        role: s.role,
      })
    }
  })

  return entries
}