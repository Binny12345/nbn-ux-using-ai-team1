import { redirect } from 'next/navigation'
import { requireAuth } from '@/actions/auth.actions'
import { getUserRoleForProject } from '@/features/projects/lib/roles'
import { adminDb } from '@/lib/firebase/admin'
import { ChatSessionUI } from '@/features/chat/components/ChatSessionUI'
import { getProjectContext } from '@/features/chat/lib/context'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const session = await requireAuth()
  const role = await getUserRoleForProject(projectId, session.uid)

  if (!role) {
    redirect('/projects')
  }

  const projectDoc = await adminDb.collection('projects').doc(projectId).get()
  const projectData = projectDoc.data()

  const userDoc = await adminDb.collection('users').doc(session.uid).get()
  const displayName = (userDoc.data()?.displayName as string | undefined) ?? session.email ?? 'You'

  const contextEntries = await getProjectContext(projectId)

  return (
    <ChatSessionUI
      project={{
        id: projectId,
        name: projectData?.name ?? 'Untitled project',
        updatedAt: projectData?.updatedAt?.toDate?.() ?? null,
      }}
      currentUser={{ name: displayName, role: role! }}
      contextEntries={contextEntries}
      artifacts={[]} // wire up once artifacts subcollection is read
    />
  )
}