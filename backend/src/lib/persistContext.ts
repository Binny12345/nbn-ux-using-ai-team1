import { adminDb, FieldValue } from './firebase'
import { HttpError } from './errors'
import type { ContextStatus, ExtractedEntry } from './contextTypes'

/**
 * The write-back half of the context-sync feature.
 *
 * Takes the durable entries returned by extractEntries() and persists each as
 * its own document under projects/{projectId}/context, stamped server-side with
 * attribution the client cannot forge (contributedBy, role, sourceChatId).
 *
 * One doc per entry: nothing is merged or edited in place, so every entry keeps a
 * single author. When an entry replaces an older one, the older doc is marked
 * 'Outdated' (never deleted) and linked to its successor. New entries are always
 * written 'Active' — matching the capitalisation buildProjectContext filters on.
 *
 * Role is resolved from the project's members subcollection, the same
 * membership source buildProjectContext uses, so a non-member cannot write.
 */

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

  // Resolve the caller's role from the members subcollection — same source
  // buildProjectContext uses. Treat a non-member as not-found (don't leak
  // project existence).
  const memberSnap = await projectRef.collection('members').doc(uid).get()
  if (!memberSnap.exists) {
    throw HttpError.notFound('Project', projectId)
  }
  const role = memberSnap.get('role') as string

  // Entries that replace an existing one: only Active entries of this project can be
  // replaced, each at most once per exchange. (extractEntries already limits ids to ones it was
  // shown; this re-checks against Firestore so a stale or invented id can never touch data.)
  const contextRef = projectRef.collection('context')
  const replaceable = new Map<string, FirebaseFirestore.DocumentReference>()
  for (const id of new Set(entries.map((e) => e.replaces).filter((id): id is string => !!id))) {
    const oldRef = contextRef.doc(id)
    const oldSnap = await oldRef.get()
    const status = oldSnap.get('status') as ContextStatus | undefined
    if (oldSnap.exists && (!status || status === 'Active')) replaceable.set(id, oldRef)
  }

  // One document per entry, committed atomically together with any Outdated marks.
  const batch = adminDb.batch()
  const replaced = new Set<string>()

  for (const entry of entries) {
    const docRef = contextRef.doc()
    const oldRef =
      entry.replaces && !replaced.has(entry.replaces) ? replaceable.get(entry.replaces) : undefined

    batch.set(docRef, {
      content: entry.content,
      type: entry.type,
      contributedBy: uid, // who — from the verified session, never the client body
      role, // the contributor's project role at write time
      sourceChatId: sessionId, // where — which chat session produced it
      status: NEW_ENTRY_STATUS, // 'Active'
      ...(oldRef ? { replaces: oldRef.id } : {}),
      createdAt: FieldValue.serverTimestamp(),
    })

    if (oldRef) {
      replaced.add(oldRef.id)
      batch.update(oldRef, {
        status: 'Outdated' satisfies ContextStatus,
        supersededBy: docRef.id,
        outdatedAt: FieldValue.serverTimestamp(),
      })
    }
  }

  await batch.commit()
  return entries.length
}
