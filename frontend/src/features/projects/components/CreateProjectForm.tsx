'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createProjectSchema, type CreateProjectInput } from '../validations'
import { createProject } from '../actions/createProject.actions'

export function CreateProjectForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
  })

  const onSubmit = async (data: CreateProjectInput) => {
    const result = await createProject(data)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to create project')
      return
    }
    toast.success('Project created')
    router.push(`/projects/${result.projectId}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">Project name</label>
        <input
          id="name"
          {...register('name')}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <textarea
          id="description"
          {...register('description')}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Creating…' : 'Create project'}
      </button>
    </form>
  )
}