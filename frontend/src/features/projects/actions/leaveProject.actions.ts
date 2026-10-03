'use server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'
import { FieldValue } from 'firebase-admin/firestore'

export async function leaveProject(projectId: string) {
  const session = await requireAuth()

  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectDoc = await projectRef.get()

  if (!projectDoc.exists) return { success: false, error: 'Project not found' }
  if (projectDoc.data()?.createdBy === session.uid) {
    return { success: false, error: 'Project managers cannot leave their own project' }
  }

  await projectRef.update({ memberIds: FieldValue.arrayRemove(session.uid) })
  await projectRef.collection('members').doc(session.uid).delete()

  return { success: true }
}