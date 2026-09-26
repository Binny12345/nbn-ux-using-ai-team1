import { adminDb } from './firebase'
import { HttpError } from './errors'
import type { ContextEntry, ContextStatus, ProjectBriefing } from './contextTypes'

// One context document as stored under projects/{id}/context/{entryId}.
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

// Full picture handed to the AI before a user says anything: who they are,
// who else is on the project, what the project is, and the shared context
// contributed so far. Replaces buildProjectContext for the chat endpoint;
// buildProjectContext/getUserRoleForProject stay for any other callers.
export async function buildProjectBriefing(projectId: string, uid: string): Promise<ProjectBriefing> {
  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectSnap = await projectRef.get()
  if (!projectSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }

  const memberSnap = await projectRef.collection('members').doc(uid).get()
  if (!memberSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }
  const currentRole = (memberSnap.data()?.role as string | undefined) ?? 'Unknown'

  // Full member list, so the AI knows who else is on the project.
  const allMembersSnap = await projectRef.collection('members').get()
  const members = await Promise.all(
    allMembersSnap.docs.map(async (doc) => {
      const role = (doc.data()?.role as string | undefined) ?? 'Unknown'
      // Best-effort name lookup — falls back to null if no users doc exists.
      const userSnap = await adminDb.collection('users').doc(doc.id).get()
      const displayName = userSnap.exists
        ? ((userSnap.data()?.displayName as string | undefined) ?? null)
        : null
      return { uid: doc.id, role, displayName }
    })
  )

  const contextSnap = await projectRef.collection('context').get()
  const context: ContextEntry[] = []
  contextSnap.forEach((doc) => {
    const d = doc.data() as StoredEntry
    if (d.status && d.status !== 'Active') return
    context.push({
      content: d.content,
      type: d.type,
      contributedBy: d.contributedBy,
      role: d.role,
      sourceChatId: d.sourceChatId ?? '',
      status: 'Active',
    })
  })

  return {
    projectName: (projectSnap.data()?.name as string | undefined) ?? 'Untitled project',
    projectDescription: (projectSnap.data()?.description as string | undefined) ?? '',
    members,
    currentUser: { uid, role: currentRole },
    context,
  }
}