'use server'

import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'
import { createProjectSchema, type CreateProjectInput } from '../validations'
import { FieldValue } from 'firebase-admin/firestore'

export async function createProject(input: CreateProjectInput) {
  const session = await requireAuth()

  const parsed = createProjectSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }

  const { name, description } = parsed.data

  const projectRef = adminDb.collection('projects').doc()

  await projectRef.set({
    name,
    description,
    createdBy: session.uid,
    memberIds: [session.uid],
    status: 'active',
  })

  await projectRef.collection('members').doc(session.uid).set({
    role: 'PM', // creator is always PM, per UX decision
    joinedAt: FieldValue.serverTimestamp(),
  })

  return { success: true, projectId: projectRef.id }
}