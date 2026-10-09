import { adminDb } from './firebase'
import { HttpError } from './errors'
import type { ContextEntry, ContextStatus, ProjectBriefing } from './contextTypes'
import { listProjectArtifacts } from './artifacts'

// The AI prompt carries at most this many of the newest Active entries, so a long-lived
// project can't grow the prompt (and the response time) without bound.
export const MAX_CONTEXT_ENTRIES = 60

// One context document as stored under projects/{id}/context/{entryId}.
interface StoredEntry {
  content: string
  type: string
  contributedBy: string
  role: string
  sourceChatId?: string
  status?: ContextStatus
}

// Newest Active entries, oldest first. Fetches twice the cap so Outdated entries (which
// are skipped) don't crowd out Active ones.
async function loadActiveContext(
  projectRef: FirebaseFirestore.DocumentReference
): Promise<ContextEntry[]> {
  const snap = await projectRef
    .collection('context')
    .orderBy('createdAt', 'desc')
    .limit(MAX_CONTEXT_ENTRIES * 2)
    .get()

  const entries: ContextEntry[] = []
  for (const doc of snap.docs) {
    const d = doc.data() as StoredEntry
    // Skip superseded entries — only Active context is used.
    if (d.status && d.status !== 'Active') continue
    entries.push({
      id: doc.id,
      content: d.content,
      type: d.type,
      contributedBy: d.contributedBy,
      role: d.role,
      sourceChatId: d.sourceChatId ?? '',
      status: 'Active',
    })
    if (entries.length >= MAX_CONTEXT_ENTRIES) break
  }
  return entries.reverse()
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

  return loadActiveContext(projectRef)
}

export async function getUserRoleForProject(
  projectId: string,
  uid: string
): Promise<string | null> {
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
export async function buildProjectBriefing(
  projectId: string,
  uid: string
): Promise<ProjectBriefing> {
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

  const context = await loadActiveContext(projectRef)

  const artifacts = await listProjectArtifacts(projectId)

  return {
    projectName: (projectSnap.data()?.name as string | undefined) ?? 'Untitled project',
    projectDescription: (projectSnap.data()?.description as string | undefined) ?? '',
    status: (projectSnap.data()?.status as string | undefined) ?? 'active',
    members,
    currentUser: { uid, role: currentRole },
    context,
    artifacts,
  }
}
