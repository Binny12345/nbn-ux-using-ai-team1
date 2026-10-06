import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { refresh, unarchiveProject, toastSuccess, toastError } = vi.hoisted(() => ({
  refresh: vi.fn(),
  unarchiveProject: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ signOut: vi.fn() }) }))
vi.mock('@/features/projects/actions/unarchiveProject.actions', () => ({ unarchiveProject }))
vi.mock('@/features/projects/actions/archiveProject.actions', () => ({ archiveProject: vi.fn() }))
vi.mock('@/features/projects/actions/leaveProject.actions', () => ({ leaveProject: vi.fn() }))
vi.mock('@/features/projects/actions/createProject.actions', () => ({ createProject: vi.fn() }))

import { ProjectsListClient } from '@/features/projects/components/ProjectsListClient'

type Item = React.ComponentProps<typeof ProjectsListClient>['projects'][number]

function project(id: string, name: string, role = 'PM', updatedAt: Date | null = null): Item {
  return { id, name, role, memberCount: 3, updatedAt, createdBy: 'pm1' }
}

function renderList(projects: Item[], archivedProjects: Item[]) {
  return render(
    <ProjectsListClient
      projects={projects}
      archivedProjects={archivedProjects}
      currentUser={{ name: 'Pat Manager', email: 'pat@example.com' }}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  unarchiveProject.mockResolvedValue({ success: true })
})

describe('ProjectsListClient — archived projects', () => {
  it('hides the archived section when there are no archived projects', () => {
    renderList([project('a1', 'Active One')], [])

    expect(screen.queryByText('Archived Projects')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unarchive/i })).not.toBeInTheDocument()
  })

  it('shows archived projects in their own section with a count, apart from My Projects', () => {
    renderList([project('a1', 'Active One')], [project('x1', 'Old One'), project('x2', 'Old Two')])

    const section = screen.getByRole('region', { name: 'Archived Projects' })
    expect(within(section).getByText('2 projects')).toBeInTheDocument()
    expect(within(section).getByText('Old One')).toBeInTheDocument()
    expect(within(section).getByText('Old Two')).toBeInTheDocument()
    expect(within(section).queryByText('Active One')).not.toBeInTheDocument()
  })

  it('cannot open an archived project, while active projects still open', () => {
    renderList([project('a1', 'Active One')], [project('x1', 'Old One')])

    expect(screen.getByRole('link', { name: /Active One/ })).toHaveAttribute('href', '/projects/a1')
    expect(screen.queryByRole('link', { name: /Old One/ })).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/projects/x1"]')).toBeNull()
  })

  it('offers Unarchive to the project manager only', () => {
    renderList([], [project('x1', 'Mine', 'PM'), project('x2', "Someone Else's", 'BA')])

    expect(screen.getAllByRole('button', { name: /unarchive/i })).toHaveLength(1)
    expect(screen.getByText(/only the PM can restore it/)).toBeInTheDocument()
  })

  it('unarchives the project, then confirms and refreshes the list', async () => {
    renderList([], [project('x1', 'Old One')])

    await userEvent.click(screen.getByRole('button', { name: /unarchive/i }))

    expect(unarchiveProject).toHaveBeenCalledWith('x1')
    expect(toastSuccess).toHaveBeenCalledWith('Project unarchived')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows the error and does not refresh when unarchiving fails', async () => {
    unarchiveProject.mockResolvedValue({
      success: false,
      error: 'Only the project manager can unarchive this project',
    })
    renderList([], [project('x1', 'Old One')])

    await userEvent.click(screen.getByRole('button', { name: /unarchive/i }))

    expect(toastError).toHaveBeenCalledWith('Only the project manager can unarchive this project')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('applies the sort buttons to the archived list too', async () => {
    renderList([], [project('x1', 'Bravo'), project('x2', 'Alpha'), project('x3', 'Charlie')])
    const names = () =>
      within(screen.getByRole('region', { name: 'Archived Projects' }))
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent)

    await userEvent.click(screen.getByRole('button', { name: 'A–Z' }))
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie'])

    await userEvent.click(screen.getByRole('button', { name: 'Z–A' }))
    expect(names()).toEqual(['Charlie', 'Bravo', 'Alpha'])
  })
})
