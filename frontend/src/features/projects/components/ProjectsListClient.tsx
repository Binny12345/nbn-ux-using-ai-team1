'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, ChevronDown, LogOut, Trash2, LogOut as LeaveIcon, Users, Calendar } from 'lucide-react'
import { createProject } from '../actions/createProject.actions'
import { archiveProject } from '../actions/archiveProject.actions'
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

export function ProjectsListClient({ projects, currentUser }: ProjectsListClientProps) {
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
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (addOpen) setTimeout(() => addInputRef.current?.focus(), 50)
  }, [addOpen])

  const sorted = [...projects].sort((a, b) => {
    if (sortKey === 'az') return a.name.localeCompare(b.name)
    if (sortKey === 'za') return b.name.localeCompare(a.name)
    return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
  })

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
    <div className="flex h-screen flex-col overflow-hidden bg-marketing-bg">
      <header className="flex h-[58px] shrink-0 items-center border-b-[1.5px] border-marketing-border bg-marketing-card px-6">
        <div className="mr-auto flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-marketing-primary to-marketing-primary-dark text-xs font-bold text-white">
            AI
          </div>
          <span className="text-sm font-semibold text-marketing-fg">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Multi-user AI'}
          </span>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          className="mr-3 flex items-center gap-2 rounded-xl bg-marketing-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,108,255,0.28)] transition-colors hover:bg-marketing-primary-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border-[1.5px] border-marketing-border px-3 py-2 transition-colors ${
              dropdownOpen ? 'bg-marketing-bg' : 'hover:bg-marketing-bg'
            }`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marketing-primary text-xs font-bold text-white">
              {initials(currentUser.name)}
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-semibold text-marketing-fg">{currentUser.name}</span>
              {currentUser.email && <span className="text-xs text-marketing-muted-light">{currentUser.email}</span>}
            </div>
            <ChevronDown className={`h-3 w-3 text-marketing-muted-light transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border-[1.5px] border-marketing-border bg-marketing-card shadow-[0_8px_24px_rgba(26,108,255,0.12)]">
              <div className="border-b border-marketing-border px-4 py-3">
                <div className="text-sm font-semibold text-marketing-fg">{currentUser.name}</div>
                {currentUser.email && <div className="mt-0.5 text-xs text-marketing-muted-light">{currentUser.email}</div>}
              </div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-marketing-error transition-colors hover:bg-marketing-danger-bg"
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
              <h1 className="text-xl font-bold text-marketing-fg">My Projects</h1>
              <p className="mt-1 text-sm text-marketing-muted-light">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg p-1">
              {(['recent', 'az', 'za'] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    sortKey === key
                      ? 'border-[#d6e6ff] bg-marketing-card text-marketing-primary shadow-[0_1px_4px_rgba(26,108,255,0.12)]'
                      : 'border-transparent text-marketing-muted-light'
                  }`}
                >
                  {key === 'recent' ? 'Recent' : key === 'az' ? 'A–Z' : 'Z–A'}
                </button>
              ))}
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-marketing-border-hover bg-marketing-card py-20 text-center">
              <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-marketing-field-bg">
                <Plus className="h-[22px] w-[22px] text-marketing-primary" />
              </div>
              <p className="text-sm font-semibold text-marketing-fg">No projects yet</p>
              <p className="mb-5 mt-1 text-xs text-marketing-muted-light">Create your first project to get started</p>
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-marketing-primary px-5 py-2.5 text-sm font-semibold text-white"
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
                  className="flex flex-col rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card transition-all hover:border-marketing-border-hover hover:shadow-[0_8px_28px_rgba(26,108,255,0.13)]"
                >
                  <Link href={`/projects/${project.id}`} className="flex-1 p-5">
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
                            : 'bg-[#f4f6fb] text-marketing-muted'
                        }`}
                      >
                        {project.role === 'PM' ? 'Project Manager' : project.role}
                      </span>
                    </div>
                    <h3 className="mb-1.5 text-sm font-bold leading-snug text-marketing-fg">{project.name}</h3>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-marketing-muted-light">
                        <Users className="h-3 w-3" />
                        {project.memberCount} member{project.memberCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-marketing-muted-light">
                        <Calendar className="h-3 w-3" />
                        {formatEdited(project.updatedAt)}
                      </span>
                    </div>
                  </Link>

                  <div className="mx-5 h-[1.5px] bg-marketing-border" />

                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-xs font-medium text-marketing-muted-light">Click card to open →</span>
                    {project.role === 'PM' ? (
                      <button
                        onClick={() => setDeleteTarget(project)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-marketing-warning transition-colors hover:bg-marketing-warning-bg"
                      >
                        <Trash2 className="h-[13px] w-[13px]" />
                        Archive
                      </button>
                    ) : (
                      <button
                        onClick={() => setLeaveTarget(project)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-marketing-muted-light transition-colors hover:bg-marketing-field-bg hover:text-marketing-muted"
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
            <div className="flex w-[400px] max-w-[90vw] flex-col gap-5 rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card px-7 py-6 shadow-[0_20px_60px_rgba(26,108,255,0.18)]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-marketing-warning-bg">
                  <Trash2 className="h-[22px] w-[22px] text-marketing-warning" />
                </div>
                <h2 className="text-base font-bold text-marketing-fg">Archive project?</h2>
              </div>
              <p className="text-sm leading-relaxed text-marketing-muted">
                <span className="font-semibold text-marketing-fg">{deleteTarget.name}</span> will be archived and
                removed from your project list. Members will keep access to view its history, but no new activity
                can be added.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg py-2.5 text-sm font-semibold text-marketing-muted transition-colors hover:bg-marketing-border"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  className="flex-1 rounded-xl bg-marketing-warning py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b84e07]"
                >
                  Archive Project
                </button>
              </div>
            </div>
          )}

          {leaveTarget && (
            <div className="flex w-[400px] max-w-[90vw] flex-col gap-5 rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card px-7 py-6 shadow-[0_20px_60px_rgba(26,108,255,0.18)]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-marketing-warning-bg">
                  <LeaveIcon className="h-[22px] w-[22px] text-marketing-warning" />
                </div>
                <h2 className="text-base font-bold text-marketing-fg">Leave project?</h2>
              </div>
              <p className="text-sm leading-relaxed text-marketing-muted">
                You will lose access to <span className="font-semibold text-marketing-fg">{leaveTarget.name}</span>. The
                project manager will need to re-invite you to regain access.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setLeaveTarget(null)}
                  className="flex-1 rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg py-2.5 text-sm font-semibold text-marketing-muted transition-colors hover:bg-marketing-border"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeave}
                  className="flex-1 rounded-xl bg-marketing-warning py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b84e07]"
                >
                  Leave Project
                </button>
              </div>
            </div>
          )}

          {addOpen && (
            <div
              className="flex w-[420px] max-w-[90vw] flex-col gap-5 rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card px-7 py-6 shadow-[0_20px_60px_rgba(26,108,255,0.18)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-marketing-field-bg">
                  <Plus className="h-[22px] w-[22px] text-marketing-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-marketing-fg">New Project</h2>
                  <p className="mt-0.5 text-xs text-marketing-muted-light">Please select a name</p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-marketing-muted">
                  PROJECT NAME
                </label>
                <input
                  ref={addInputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="w-full rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg px-4 py-3 text-sm text-marketing-fg outline-none transition-all focus:border-marketing-primary focus:bg-marketing-card focus:shadow-[0_0_0_3px_rgba(26,108,255,0.1)]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-marketing-muted">
                  DESCRIPTION
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="What's this project about? The AI uses this to understand context."
                  className="w-full resize-none rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg px-4 py-3 text-sm text-marketing-fg outline-none transition-all placeholder:text-marketing-muted-light focus:border-marketing-primary focus:bg-marketing-card focus:shadow-[0_0_0_3px_rgba(26,108,255,0.1)]"
                />
                <p className="mt-2 flex items-center gap-1.5 text-xs text-marketing-muted-light">
                  You will be assigned as{' '}
                  <span className="font-semibold text-marketing-primary">Project Manager</span> for this project.
                </p>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setAddOpen(false)
                    setNewTitle('')
                  }}
                  className="flex-1 rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg py-2.5 text-sm font-semibold text-marketing-muted transition-colors hover:bg-marketing-border"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || creating}
                  className="flex-1 rounded-xl bg-marketing-primary py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,108,255,0.28)] transition-all hover:bg-marketing-primary-hover disabled:cursor-default disabled:bg-marketing-border-hover disabled:shadow-none"
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