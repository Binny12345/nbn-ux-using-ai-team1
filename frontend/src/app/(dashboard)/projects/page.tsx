import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'
import Link from 'next/link'

export default async function ProjectsPage() {
  const session = await requireAuth()

  const snapshot = await adminDb
    .collection('projects')
    .where('memberIds', 'array-contains', session.uid)
    .get()

  const projects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your projects</h1>
        <Link href="/projects/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          + New project
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {projects.map((project: any) => (
          <li key={project.id}>
            <Link href={`/projects/${project.id}`} className="block rounded-md border border-zinc-200 p-4 hover:bg-zinc-50">
              {project.name}
            </Link>
          </li>
        ))}
      </ul>
      {projects.length === 0 && <p className="text-sm text-zinc-500">No projects yet.</p>}
    </div>
  )
}