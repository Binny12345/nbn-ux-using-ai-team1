'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus,
  ChevronDown,
  LogOut,
  Trash2,
  LogOut as LeaveIcon,
  Users,
  Calendar,
  ArchiveRestore,
} from 'lucide-react'
import { createProject } from '../actions/createProject.actions'
import { archiveProject } from '../actions/archiveProject.actions'
import { unarchiveProject } from '../actions/unarchiveProject.actions'
import { leaveProject } from '../actions/leaveProject.actions'
import { useAuth } from '@/hooks/useAuth'

type SortKey = 'recent' | 'az' | 'za'

interface ProjectListItem {
  id: string
  name: string
  role: string
  memberCount: number
  updatedAt: Date | null
  createdBy: string
}

interface ProjectsListClientProps {
  projects: ProjectListItem[]
  archivedProjects: ProjectListItem[]
  currentUser: { name: string; email: string | null }
}

function initials(name: string) {
  const words = name.trim().split(/\s+/)
  const first = words[0]
  const second = words[1]

  if (first && second) {
    return (first.charAt(0) + second.charAt(0)).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function colorFor(id: string) {
  const colors = ['#1a6cff', '#6c3fff', '#0099aa', '#d4600a', '#1a9e5c', '#b0006e']
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]
}

function formatEdited(date: Date | null) {
  if (!date) return 'No edits yet'
  return (
    date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }) +
    ' at ' +
    date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  )
}

function ProjectCardSummary({ project }: { project: ProjectListItem }) {
  return (
    <>
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ background: colorFor(project.id) }}
        >
          {initials(project.name)}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            project.role === 'PM'
              ? 'bg-marketing-field-bg text-marketing-primary'
              : 'text-marketing-muted bg-[#f4f6fb]'
          }`}
        >
          {project.role === 'PM' ? 'Project Manager' : project.role}
        </span>
      </div>
      <h3 className="text-marketing-fg mb-1.5 text-sm leading-snug font-bold">{project.name}</h3>
      <div className="flex items-center gap-3">
        <span className="text-marketing-muted-light flex items-center gap-1 text-xs">
          <Users className="h-3 w-3" />
          {project.memberCount} member{project.memberCount !== 1 ? 's' : ''}
        </span>
        <span className="text-marketing-muted-light flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {formatEdited(project.updatedAt)}
        </span>
      </div>
    </>
  )
}

export function ProjectsListClient({
  projects,
  archivedProjects,
  currentUser,
}: ProjectsListClientProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<ProjectListItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (addOpen) setTimeout(() => addInputRef.current?.focus(), 50)
  }, [addOpen])

  const sortProjects = (list: ProjectListItem[]) =>
    [...list].sort((a, b) => {
      if (sortKey === 'az') return a.name.localeCompare(b.name)
      if (sortKey === 'za') return b.name.localeCompare(a.name)
      return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
    })
  const sorted = sortProjects(projects)
  const sortedArchived = sortProjects(archivedProjects)

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/signin')
    router.refresh()
  }

  const handleCreate = async () => {
    const name = newTitle.trim()
    if (!name) return
    setCreating(true)
    const result = await createProject({ name, description: newDescription.trim() })
    setCreating(false)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to create project')
      return
    }
    toast.success('Project created')
    setAddOpen(false)
    setNewTitle('')
    setNewDescription('')
    router.push(`/projects/${result.projectId}`)
  }

  const handleArchive = async () => {
    if (!deleteTarget) return
    const result = await archiveProject(deleteTarget.id)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to archive project')
      setDeleteTarget(null)
      return
    }
    toast.success('Project archived')
    setDeleteTarget(null)
    router.refresh()
  }

  const handleUnarchive = async (project: ProjectListItem) => {
    setUnarchivingId(project.id)
    const result = await unarchiveProject(project.id)
    setUnarchivingId(null)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to unarchive project')
      return
    }
    toast.success('Project unarchived')
    router.refresh()
  }

  const handleLeave = async () => {
    if (!leaveTarget) return
    const result = await leaveProject(leaveTarget.id)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to leave project')
      setLeaveTarget(null)
      return
    }
    toast.success('Left project')
    setLeaveTarget(null)
    router.refresh()
  }

  const modalOpen = !!deleteTarget || !!leaveTarget || addOpen

  return (
    <div className="bg-marketing-bg flex h-screen flex-col overflow-hidden">
      <header className="border-marketing-border bg-marketing-card flex h-[58px] shrink-0 items-center border-b-[1.5px] px-6">
        <div className="mr-auto flex items-center gap-2">
          <div className="from-marketing-primary to-marketing-primary-dark flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white">
            AI
          </div>
          <span className="text-marketing-fg text-sm font-semibold">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Multi-user AI'}
          </span>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          className="bg-marketing-primary hover:bg-marketing-primary-hover mr-3 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,108,255,0.28)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={`border-marketing-border flex items-center gap-2 rounded-lg border-[1.5px] px-3 py-2 transition-colors ${
              dropdownOpen ? 'bg-marketing-bg' : 'hover:bg-marketing-bg'
            }`}
          >
            <div className="bg-marketing-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
              {initials(currentUser.name)}
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-marketing-fg text-xs font-semibold">{currentUser.name}</span>
              {currentUser.email && (
                <span className="text-marketing-muted-light text-xs">{currentUser.email}</span>
              )}
            </div>
            <ChevronDown
              className={`text-marketing-muted-light h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="border-marketing-border bg-marketing-card absolute top-full right-0 z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border-[1.5px] shadow-[0_8px_24px_rgba(26,108,255,0.12)]">
              <div className="border-marketing-border border-b px-4 py-3">
                <div className="text-marketing-fg text-sm font-semibold">{currentUser.name}</div>
                {currentUser.email && (
                  <div className="text-marketing-muted-light mt-0.5 text-xs">
                    {currentUser.email}
                  </div>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="text-marketing-error hover:bg-marketing-danger-bg flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors"
              >
                <LogOut className="h-[15px] w-[15px]" />
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <h1 className="text-marketing-fg text-xl font-bold">My Projects</h1>
              <p className="text-marketing-muted-light mt-1 text-sm">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="border-marketing-border bg-marketing-field-bg flex items-center gap-1 rounded-xl border-[1.5px] p-1">
              {(['recent', 'az', 'za'] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    sortKey === key
                      ? 'bg-marketing-card text-marketing-primary border-[#d6e6ff] shadow-[0_1px_4px_rgba(26,108,255,0.12)]'
                      : 'text-marketing-muted-light border-transparent'
                  }`}
                >
                  {key === 'recent' ? 'Recent' : key === 'az' ? 'A–Z' : 'Z–A'}
                </button>
              ))}
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="border-marketing-border-hover bg-marketing-card flex flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed py-20 text-center">
              <div className="bg-marketing-field-bg mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full">
                <Plus className="text-marketing-primary h-[22px] w-[22px]" />
              </div>
              <p className="text-marketing-fg text-sm font-semibold">No projects yet</p>
              <p className="text-marketing-muted-light mt-1 mb-5 text-xs">
                Create your first project to get started
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="bg-marketing-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="h-[13px] w-[13px]" />
                New Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
              {sorted.map((project) => (
                <div
                  key={project.id}
                  className="border-marketing-border bg-marketing-card hover:border-marketing-border-hover flex flex-col rounded-2xl border-[1.5px] transition-all hover:shadow-[0_8px_28px_rgba(26,108,255,0.13)]"
                >
                  <Link href={`/projects/${project.id}`} className="flex-1 p-5">
                    <ProjectCardSummary project={project} />
                  </Link>

                  <div className="bg-marketing-border mx-5 h-[1.5px]" />

                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-marketing-muted-light text-xs font-medium">
                      Click card to open →
                    </span>
                    {project.role === 'PM' ? (
                      <button
                        onClick={() => setDeleteTarget(project)}
                        className="text-marketing-warning hover:bg-marketing-warning-bg flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="h-[13px] w-[13px]" />
                        Archive
                      </button>
                    ) : (
                      <button
                        onClick={() => setLeaveTarget(project)}
                        className="text-marketing-muted-light hover:bg-marketing-field-bg hover:text-marketing-muted flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      >
                        <LeaveIcon className="h-[13px] w-[13px]" />
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {archivedProjects.length > 0 && (
            <section className="mt-12" aria-labelledby="archived-projects-heading">
              <div className="mb-5">
                <h2 id="archived-projects-heading" className="text-marketing-fg text-xl font-bold">
                  Archived Projects
                </h2>
                <p className="text-marketing-muted-light mt-1 text-sm">
                  {archivedProjects.length} project{archivedProjects.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                {sortedArchived.map((project) => (
                  <div
                    key={project.id}
                    className="border-marketing-border bg-marketing-card flex flex-col rounded-2xl border-[1.5px]"
                  >
                    {/* Archived projects can't be opened; the only action is Unarchive. */}
                    <div className="flex-1 p-5 opacity-60">
                      <ProjectCardSummary project={project} />
                    </div>

                    <div className="bg-marketing-border mx-5 h-[1.5px]" />

                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-marketing-muted-light text-xs font-medium">
                        {project.role === 'PM'
                          ? 'Archived'
                          : 'Archived · only the PM can restore it'}
                      </span>
                      {project.role === 'PM' && (
                        <button
                          onClick={() => void handleUnarchive(project)}
                          disabled={unarchivingId === project.id}
                          className="text-marketing-primary hover:bg-marketing-field-bg flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
                        >
                          <ArchiveRestore className="h-[13px] w-[13px]" />
                          {unarchivingId === project.id ? 'Unarchiving…' : 'Unarchive'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,28,63,0.38)] backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteTarget(null)
              setLeaveTarget(null)
              setAddOpen(false)
              setNewTitle('')
            }
          }}
        >
          {deleteTarget && (
            <div className="border-marketing-border bg-marketing-card flex w-[400px] max-w-[90vw] flex-col gap-5 rounded-2xl border-[1.5px] px-7 py-6 shadow-[0_20px_60px_rgba(26,108,255,0.18)]">
              <div className="flex items-center gap-4">
                <div className="bg-marketing-warning-bg flex h-12 w-12 items-center justify-center rounded-full">
                  <Trash2 className="text-marketing-warning h-[22px] w-[22px]" />
                </div>
                <h2 className="text-marketing-fg text-base font-bold">Archive project?</h2>
              </div>
              <p className="text-marketing-muted text-sm leading-relaxed">
                <span className="text-marketing-fg font-semibold">{deleteTarget.name}</span> will be
                archived and removed from your project list. Members will keep access to view its
                history, but no new activity can be added.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="border-marketing-border bg-marketing-field-bg text-marketing-muted hover:bg-marketing-border flex-1 rounded-xl border-[1.5px] py-2.5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  className="bg-marketing-warning flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b84e07]"
                >
                  Archive Project
                </button>
              </div>
            </div>
          )}

          {leaveTarget && (
            <div className="border-marketing-border bg-marketing-card flex w-[400px] max-w-[90vw] flex-col gap-5 rounded-2xl border-[1.5px] px-7 py-6 shadow-[0_20px_60px_rgba(26,108,255,0.18)]">
              <div className="flex items-center gap-4">
                <div className="bg-marketing-warning-bg flex h-12 w-12 items-center justify-center rounded-full">
                  <LeaveIcon className="text-marketing-warning h-[22px] w-[22px]" />
                </div>
                <h2 className="text-marketing-fg text-base font-bold">Leave project?</h2>
              </div>
              <p className="text-marketing-muted text-sm leading-relaxed">
                You will lose access to{' '}
                <span className="text-marketing-fg font-semibold">{leaveTarget.name}</span>. The
                project manager will need to re-invite you to regain access.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setLeaveTarget(null)}
                  className="border-marketing-border bg-marketing-field-bg text-marketing-muted hover:bg-marketing-border flex-1 rounded-xl border-[1.5px] py-2.5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeave}
                  className="bg-marketing-warning flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b84e07]"
                >
                  Leave Project
                </button>
              </div>
            </div>
          )}

          {addOpen && (
            <div
              className="border-marketing-border bg-marketing-card flex w-[420px] max-w-[90vw] flex-col gap-5 rounded-2xl border-[1.5px] px-7 py-6 shadow-[0_20px_60px_rgba(26,108,255,0.18)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="bg-marketing-field-bg flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                  <Plus className="text-marketing-primary h-[22px] w-[22px]" />
                </div>
                <div>
                  <h2 className="text-marketing-fg text-base font-bold">New Project</h2>
                  <p className="text-marketing-muted-light mt-0.5 text-xs">Please select a name</p>
                </div>
              </div>

              <div>
                <label className="text-marketing-muted mb-1.5 block text-xs font-semibold tracking-wide">
                  PROJECT NAME
                </label>
                <input
                  ref={addInputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="border-marketing-border bg-marketing-field-bg text-marketing-fg focus:border-marketing-primary focus:bg-marketing-card w-full rounded-xl border-[1.5px] px-4 py-3 text-sm transition-all outline-none focus:shadow-[0_0_0_3px_rgba(26,108,255,0.1)]"
                />
              </div>

              <div>
                <label className="text-marketing-muted mb-1.5 block text-xs font-semibold tracking-wide">
                  DESCRIPTION
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="What's this project about? The AI uses this to understand context."
                  className="border-marketing-border bg-marketing-field-bg text-marketing-fg placeholder:text-marketing-muted-light focus:border-marketing-primary focus:bg-marketing-card w-full resize-none rounded-xl border-[1.5px] px-4 py-3 text-sm transition-all outline-none focus:shadow-[0_0_0_3px_rgba(26,108,255,0.1)]"
                />
                <p className="text-marketing-muted-light mt-2 flex items-center gap-1.5 text-xs">
                  You will be assigned as{' '}
                  <span className="text-marketing-primary font-semibold">Project Manager</span> for
                  this project.
                </p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setAddOpen(false)
                    setNewTitle('')
                  }}
                  className="border-marketing-border bg-marketing-field-bg text-marketing-muted hover:bg-marketing-border flex-1 rounded-xl border-[1.5px] py-2.5 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || creating}
                  className="bg-marketing-primary hover:bg-marketing-primary-hover disabled:bg-marketing-border-hover flex-1 rounded-xl py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,108,255,0.28)] transition-all disabled:cursor-default disabled:shadow-none"
                >
                  {creating ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
