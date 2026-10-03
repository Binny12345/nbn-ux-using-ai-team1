'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { updateProjectDescription } from '@/features/projects/actions/updateProjectDescription.actions'

interface EditDescriptionModalProps {
  projectId: string
  currentDescription: string
  onClose: () => void
  onSaved: () => void
}

export function EditDescriptionModal({ projectId, currentDescription, onClose, onSaved }: EditDescriptionModalProps) {
  const [description, setDescription] = useState(currentDescription)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const result = await updateProjectDescription({ projectId, description: description.trim() })
    setSaving(false)
    if (!result.success) {
      toast.error(result.error ?? 'Failed to update description')
      return
    }
    toast.success('Description updated')
    onSaved()
    onClose()
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/[0.18]" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border-[1.5px] border-marketing-border bg-marketing-card p-5 shadow-[0_20px_60px_rgba(26,108,255,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-marketing-fg">Edit description</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-marketing-muted-light transition-colors hover:bg-marketing-bg hover:text-marketing-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="What's this project about? The AI uses this to understand context."
          className="w-full resize-none rounded-xl border-[1.5px] border-marketing-border bg-marketing-field-bg px-4 py-3 text-sm text-marketing-fg outline-none transition-all placeholder:text-marketing-muted-light focus:border-marketing-primary focus:bg-marketing-card focus:shadow-[0_0_0_3px_rgba(26,108,255,0.1)]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-3 w-full rounded-xl bg-marketing-primary py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,108,255,0.28)] transition-colors hover:bg-marketing-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}