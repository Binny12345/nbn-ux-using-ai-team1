'use client'

import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { addMember } from '@/features/projects/actions/addMember.actions'

const ROLES = ['BA', 'UX', 'PM', 'Dev'] as const

interface InviteModalProps {
  projectId: string
  onClose: () => void
}

export function InviteModal({ projectId, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof ROLES)[number]>('BA')
  const [inviting, setInviting] = useState(false)

  const handleInvite = async () => {
    if (!email.trim()) return
    setInviting(true)
    const result = await addMember({ projectId, email: email.trim(), role })
    setInviting(false)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to add member')
      return
    }
    toast.success('Member added')
    setEmail('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,28,63,0.38)] backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex w-[420px] max-w-[90vw] flex-col gap-5 rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card px-7 py-6 shadow-[0_20px_60px_rgba(26,108,255,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-marketing-field-bg">
            <UserPlus className="h-[22px] w-[22px] text-marketing-primary" />
          </div>
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-marketing-fg">Invite member</h2>
              <p className="mt-0.5 text-xs text-marketing-muted-light">Add someone to this project</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1 text-marketing-muted-light transition-colors hover:bg-marketing-bg hover:text-marketing-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold tracking-wide text-marketing-muted">
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            placeholder="member@example.com"
            className="w-full rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg px-4 py-3 text-sm text-marketing-fg outline-none transition-all placeholder:text-marketing-muted-light focus:border-marketing-primary focus:bg-marketing-card focus:shadow-[0_0_0_3px_rgba(26,108,255,0.1)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold tracking-wide text-marketing-muted">
            ROLE
          </label>
          <div className="flex items-center gap-1 rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg p-1">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                  role === r
                    ? 'border-[#d6e6ff] bg-marketing-card text-marketing-primary shadow-[0_1px_4px_rgba(26,108,255,0.12)]'
                    : 'border-transparent text-marketing-muted-light'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg py-2.5 text-sm font-semibold text-marketing-muted transition-colors hover:bg-marketing-border"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={!email.trim() || inviting}
            className="flex-1 rounded-xl bg-marketing-primary py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,108,255,0.28)] transition-all hover:bg-marketing-primary-hover disabled:cursor-default disabled:bg-marketing-border-hover disabled:shadow-none"
          >
            {inviting ? 'Inviting…' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}