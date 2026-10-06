import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional().default(''),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
// What the form fields hold before the schema fills in defaults (description is optional here).
export type CreateProjectFormValues = z.input<typeof createProjectSchema>