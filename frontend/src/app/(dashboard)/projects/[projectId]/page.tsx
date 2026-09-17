import { redirect } from 'next/navigation'
import { requireAuth } from '@/actions/auth.actions'
import { getUserRoleForProject } from '@/features/projects/lib/roles'
import { adminDb } from '@/lib/firebase/admin'
import { AddMemberForm } from '@/features/projects/components/AddMemberForm'

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

  const projectDoc = await adminDb.collection('project').doc(projectId).get()
  const project = projectDoc.data()

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-bold">{project?.name}</h1>
      <p className="text-sm text-zinc-500">Your role: {role}</p>
      <p className="mt-2 text-sm">{project?.description}</p>

      {role === 'PM' && <AddMemberForm projectId={projectId} />}
    </div>
  )
}