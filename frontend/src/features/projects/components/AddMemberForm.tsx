'use client'

import { useState } from 'react'
import { addMember } from '../actions/addMember.actions'
import { toast } from 'sonner'

const ROLES = ['BA', 'UX', 'PM', 'Dev'] as const

export function AddMemberForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<typeof ROLES[number]>('BA')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    const result = await addMember({ projectId, email, role })
    setLoading(false)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to add member')
      return
    }
    toast.success('Member added')
    setEmail('')
  }

  return (
    <div className="mt-6 flex flex-col gap-2 border-t pt-4">
      <p className="text-sm font-medium">Add member</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="member@example.com"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button onClick={handleSubmit} disabled={loading} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
        {loading ? 'Adding…' : 'Add member'}
      </button>
    </div>
  )
}