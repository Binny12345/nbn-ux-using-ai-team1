'use server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'

const addMemberSchema = z.object({
  projectId: z.string(),
  memberUid: z.string(),
  role: z.enum(['BA', 'UX', 'PM', 'Dev']),
})

export async function addMember(input: z.infer<typeof addMemberSchema>) {
  const session = await requireAuth()
  const parsed = addMemberSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  const { projectId, memberUid, role } = parsed.data
  const projectRef = adminDb.collection('project').doc(projectId)
  const projectDoc = await projectRef.get()

  if (!projectDoc.exists) return { success: false, error: 'Project not found' }
  if (projectDoc.data()?.createdBy !== session.uid) {
    return { success: false, error: 'Only the project creator can add members' }
  }

  await projectRef.update({ memberIds: FieldValue.arrayUnion(memberUid) })
  await projectRef.collection('members').doc(memberUid).set({
    role,
    joinedAt: FieldValue.serverTimestamp(),
  })

  return { success: true }
}