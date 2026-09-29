'use client'

import { useState, useRef } from 'react'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!value.trim()) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  return (
    <div className="shrink-0 bg-marketing-bg px-4 pb-4 pt-3">
      <div
        className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border-[1.5px] bg-marketing-card px-4 py-3 transition-shadow"
        style={{
          borderColor: focused ? 'var(--marketing-primary)' : 'var(--marketing-border)',
          boxShadow: focused
            ? '0 2px 20px rgba(26,108,255,0.16), 0 0 0 2px rgba(26,108,255,0.12)'
            : '0 2px 16px rgba(26,108,255,0.08)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          disabled={disabled}
          placeholder="Ask anything"
          className="max-h-[160px] flex-1 resize-none bg-transparent text-sm leading-normal text-marketing-fg outline-none"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all hover:scale-105 ${
            value.trim() ? 'bg-marketing-primary text-white' : 'cursor-default bg-marketing-border text-marketing-muted-light'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 8L3 3l2.5 5L3 13l10.5-5z" fill="currentColor" />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-marketing-muted-light">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}