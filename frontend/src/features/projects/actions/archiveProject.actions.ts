// frontend/src/features/projects/actions/archiveProject.actions.ts

'use server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'

export async function archiveProject(projectId: string) {
  const session = await requireAuth()

  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectDoc = await projectRef.get()

  if (!projectDoc.exists) return { success: false, error: 'Project not found' }
  if (projectDoc.data()?.createdBy !== session.uid) {
    return { success: false, error: 'Only the project manager can archive this project' }
  }

  await projectRef.update({ status: 'archived' })

  return { success: true }
}