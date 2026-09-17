import { adminDb } from '@/lib/firebase/admin'

export async function getUserRoleForProject(
  projectId: string,
  uid: string
): Promise<string | null> {
  const memberDoc = await adminDb
    .collection('project')
    .doc(projectId)
    .collection('members')
    .doc(uid)
    .get()

  if (!memberDoc.exists) return null

  return memberDoc.data()?.role ?? null
}