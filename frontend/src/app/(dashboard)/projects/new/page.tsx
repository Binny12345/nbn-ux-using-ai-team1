import { CreateProjectForm } from '@/features/projects/components/CreateProjectForm'

export const metadata = { title: 'New project' }

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-lg py-8">
      <h1 className="mb-6 text-2xl font-bold">Create a new project</h1>
      <CreateProjectForm />
    </div>
  )
}