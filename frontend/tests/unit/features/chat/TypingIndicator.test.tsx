import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TypingIndicator } from '@/features/chat/components/TypingIndicator'

describe('TypingIndicator', () => {
  it('announces that the AI is responding to screen readers', () => {
    render(<TypingIndicator />)
    expect(screen.getByRole('status')).toHaveTextContent('AI is responding')
  })

  it('renders three animated dots', () => {
    const { container } = render(<TypingIndicator />)
    expect(container.querySelectorAll('.typing-dot')).toHaveLength(3)
  })

  it('shows the label for long-running work', () => {
    render(<TypingIndicator label="Generating document…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Generating document…')
  })

})