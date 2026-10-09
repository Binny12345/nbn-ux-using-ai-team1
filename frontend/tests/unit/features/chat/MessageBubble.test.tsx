import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '@/features/chat/components/MessageBubble'
import type { ChatMessage } from '@/features/chat/types'

const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  sender: 'ai',
  content: 'Understood.',
  timestamp: new Date('2026-10-09T05:00:00Z'),
  ...over,
})

describe('MessageBubble', () => {
  it('shows the message text', () => {
    render(<MessageBubble message={message()} currentUserName="Pat Manager" />)
    expect(screen.getByText('Understood.')).toBeInTheDocument()
  })

  it('shows a notice under the message when there is one', () => {
    render(
      <MessageBubble
        message={message({ notice: "Couldn't save this exchange to the shared context." })}
        currentUserName="Pat Manager"
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save this exchange")
  })

  it('shows no notice by default', () => {
    render(<MessageBubble message={message()} currentUserName="Pat Manager" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
