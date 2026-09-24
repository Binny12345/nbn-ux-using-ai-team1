import { adminDb } from './firebase'
import { HttpError } from './errors'
import { FieldValue } from 'firebase-admin/firestore'
import type { ContextStatus } from './contextTypes'

/**
 * The write-back half of the context-sync feature.
 *
 * Takes the durable entries returned by extractEntries() and persists each as
 * its own document under projects/{projectId}/context, stamped server-side with
 * attribution the client cannot forge (contributedBy, role, sourceChatId).
 *
 * One doc per entry (append-only): nothing is merged or overwritten, so every
 * entry keeps a single author and its own status. New entries are always
 * written 'Active' — matching the capitalisation buildProjectContext filters on.
 *
 * Role is resolved from the project's `members` array, the same membership
 * source buildProjectContext uses, so a non-member cannot write.
 */

// A durable entry as returned by extractEntries() — content + a type string.
export interface ExtractedEntry {
  content: string
  type: string
}

// A project member as stored on the project document's `members` array.
interface ProjectMember {
  uid: string
  role: string
}

// New entries are written Active. Must match ContextStatus casing exactly,
// or the reader (which skips status !== 'Active') filters them out on read.
const NEW_ENTRY_STATUS: ContextStatus = 'Active'

/**
 * Persist extracted entries as attributed context documents.
 *
 * @param projectId  the project the entries belong to
 * @param uid        the authenticated caller (attribution: who contributed)
 * @param sessionId  the chat session the entries came from (attribution: where)
 * @param entries    the durable entries from extractEntries()
 * @returns          the number of entries written
 */
export async function persistContext(
  projectId: string,
  uid: string,
  sessionId: string,
  entries: ExtractedEntry[]
): Promise<number> {
  // Nothing durable in this exchange — a no-op, not an error.
  if (entries.length === 0) return 0

  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectSnap = await projectRef.get()
  if (!projectSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }

  // Resolve the caller's role from members — same source the reader uses.
  // Treat a non-member as not-found (don't leak project existence).
  const members = (projectSnap.get('members') as ProjectMember[] | undefined) ?? []
  const member = members.find((m) => m.uid === uid)
  if (!member) {
    throw HttpError.notFound('Project', projectId)
  }
  const role = member.role

  // One document per entry, committed atomically.
  const contextRef = projectRef.collection('context')
  const batch = adminDb.batch()

  for (const entry of entries) {
    const docRef = contextRef.doc()
    batch.set(docRef, {
      content: entry.content,
      type: entry.type,
      contributedBy: uid, // who — from the verified session, never the client body
      role, // the contributor's project role at write time
      sourceChatId: sessionId, // where — which chat session produced it
      status: NEW_ENTRY_STATUS, // 'Active'
      createdAt: FieldValue.serverTimestamp(),
    })
  }

  await batch.commit()
  return entries.length
}