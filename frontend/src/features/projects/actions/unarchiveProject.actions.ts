'use server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'

export async function unarchiveProject(projectId: string) {
  const session = await requireAuth()

  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectDoc = await projectRef.get()

  if (!projectDoc.exists) return { success: false, error: 'Project not found' }
  if (projectDoc.data()?.createdBy !== session.uid) {
    return { success: false, error: 'Only the project manager can unarchive this project' }
  }
  if (projectDoc.data()?.status !== 'archived') {
    return { success: false, error: 'This project is not archived' }
  }

  await projectRef.update({ status: 'active' })

  return { success: true }
}
