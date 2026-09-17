export type ProjectRole = 'BA' | 'UX' | 'PM' | 'Dev'

export interface Project {
  id: string
  name: string
  createdBy: string
  memberIds: string[]
  description: string
  status: string
}

export interface ProjectMember {
  userId: string
  role: ProjectRole
  joinedAt: Date
}

export interface CreateProjectInput {
  name: string
  description: string
  creatorRole: ProjectRole
}