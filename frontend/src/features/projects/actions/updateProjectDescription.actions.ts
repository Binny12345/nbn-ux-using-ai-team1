'use server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'
import { z } from 'zod'

const schema = z.object({
  projectId: z.string(),
  description: z.string().max(2000),
})

export async function updateProjectDescription(input: z.infer<typeof schema>) {
  const session = await requireAuth()
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { projectId, description } = parsed.data
  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectDoc = await projectRef.get()

  if (!projectDoc.exists) return { success: false, error: 'Project not found' }
  if (projectDoc.data()?.createdBy !== session.uid) {
    return { success: false, error: 'Only the project manager can edit the description' }
  }
  if (projectDoc.data()?.status === 'archived') {
  return { success: false, error: 'This project is archived' }
  }

  await projectRef.update({ description })

  return { success: true }
}