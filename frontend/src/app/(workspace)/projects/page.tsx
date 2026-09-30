import { requireAuth } from '@/actions/auth.actions'
import { adminDb } from '@/lib/firebase/admin'
import { ProjectsListClient } from '@/features/projects/components/ProjectsListClient'

export default async function ProjectsPage() {
  const session = await requireAuth()

  const snapshot = await adminDb
    .collection('projects')
    .where('memberIds', 'array-contains', session.uid)
    .get()

  const activeDocs = snapshot.docs.filter((doc) => doc.data().status !== 'archived')

  const projects = await Promise.all(
    activeDocs.map(async (doc) => {
      const data = doc.data()
      const membersSnap = await doc.ref.collection('members').get()
      const myMembership = membersSnap.docs.find((m) => m.id === session.uid)

      return {
        id: doc.id,
        name: (data.name as string) ?? 'Untitled project',
        role: (myMembership?.data()?.role as string) ?? 'Unknown',
        memberCount: membersSnap.size,
        updatedAt: data.updatedAt?.toDate?.() ?? null,
        createdBy: data.createdBy as string,
      }
    })
  )

  const userDoc = await adminDb.collection('users').doc(session.uid).get()
  const displayName = (userDoc.data()?.displayName as string | undefined) ?? session.email ?? 'You'

  return <ProjectsListClient projects={projects} currentUser={{ name: displayName, email: session.email ?? null }} />
}