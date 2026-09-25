import 'server-only'
import { adminDb } from '@/lib/firebase/admin'
import type { ContextEntry } from '../types'

const MAX_ENTRIES = 50

// Caller must already have verified the user is a member of the project.
export async function getProjectContext(projectId: string): Promise<ContextEntry[]> {
  const snap = await adminDb
    .collection('projects')
    .doc(projectId)
    .collection('context')
    .orderBy('createdAt', 'desc')
    .limit(MAX_ENTRIES)
    .get()

  const active = snap.docs.filter((d) => {
    const status = d.get('status') as string | undefined
    return !status || status === 'Active'
  })

  const uids = [...new Set(active.map((d) => d.get('contributedBy') as string))]
  const names = new Map<string, string | null>()
  if (uids.length > 0) {
    const userSnaps = await adminDb.getAll(
      ...uids.map((uid) => adminDb.collection('users').doc(uid))
    )
    for (const u of userSnaps) {
      names.set(u.id, (u.get('displayName') as string | null | undefined) ?? null)
    }
  }

  return active.reverse().map((d) => ({
    id: d.id,
    content: d.get('content') as string,
    type: (d.get('type') as string | undefined) ?? 'note',
    role: (d.get('role') as string | undefined) ?? '',
    contributorName: names.get(d.get('contributedBy') as string) ?? null,
  }))
}
