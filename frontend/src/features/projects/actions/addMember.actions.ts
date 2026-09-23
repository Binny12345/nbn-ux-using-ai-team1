'use server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'

const addMemberSchema = z.object({
  projectId: z.string(),
  email: z.string().email(),
  role: z.enum(['BA', 'UX', 'PM', 'Dev']),
})

export async function addMember(input: z.infer<typeof addMemberSchema>) {
  const session = await requireAuth()
  const parsed = addMemberSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { projectId, email, role } = parsed.data

  const projectRef = adminDb.collection('projects').doc(projectId)
  const projectDoc = await projectRef.get()

  if (!projectDoc.exists) return { success: false, error: 'Project not found' }
  if (projectDoc.data()?.createdBy !== session.uid) {
    return { success: false, error: 'Only the project manager can add members' }
  }

  // Look up the user by email — confirms they actually exist before adding them
  const userQuery = await adminDb.collection('users').where('email', '==', email).limit(1).get()

  if (userQuery.empty) {
    return { success: false, error: 'No user found with that email' }
  }

  const matchedDoc = userQuery.docs[0]
  
  if (!matchedDoc) {
    return { success: false, error: 'No user found with that email' }
  }
  const memberUid = matchedDoc.id

  // Prevent duplicate invites
  const existingMemberIds = projectDoc.data()?.memberIds ?? []
  if (existingMemberIds.includes(memberUid)) {
    return { success: false, error: 'This user is already a member of this project' }
  }

  await projectRef.update({ memberIds: FieldValue.arrayUnion(memberUid) })
  await projectRef.collection('members').doc(memberUid).set({
    role,
    joinedAt: FieldValue.serverTimestamp(),
  })

  return { success: true }
}