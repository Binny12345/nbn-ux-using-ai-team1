import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearHistory,
  parseHistory,
  readStoredHistory,
  writeHistory,
} from '@/features/chat/lib/chatHistory'
import { roleLabel } from '@/features/chat/lib/roleLabels'
import type { ChatMessage } from '@/features/chat/types'

const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  sender: 'user',
  content: 'hello',
  timestamp: new Date('2026-08-27T03:45:00Z'),
  ...over,
})

beforeEach(() => window.localStorage.clear())

describe('chatHistory', () => {
  it('round-trips messages, restoring timestamps as Dates', () => {
    writeHistory('p1', 'u1', [msg(), msg({ id: 'm2', sender: 'ai', content: 'hi' })])
    const restored = parseHistory(readStoredHistory('p1', 'u1'))
    expect(restored).toHaveLength(2)
    expect(restored[0]!.timestamp).toBeInstanceOf(Date)
    expect(restored[1]!.sender).toBe('ai')
  })

  it('does not save failed messages', () => {
    writeHistory('p1', 'u1', [msg({ failed: true }), msg({ id: 'm2' })])
    expect(parseHistory(readStoredHistory('p1', 'u1'))).toHaveLength(1)
  })

  it('keeps users and projects separate, and can be cleared', () => {
    writeHistory('p1', 'u1', [msg()])
    expect(parseHistory(readStoredHistory('p1', 'u2'))).toEqual([])
    clearHistory('p1', 'u1')
    expect(readStoredHistory('p1', 'u1')).toBeNull()
  })

  it('ignores corrupt data', () => {
    expect(parseHistory('not json')).toEqual([])
    expect(parseHistory('[{"id":1}]')).toEqual([])
  })
})

describe('roleLabel', () => {
  it('expands known roles and passes others through', () => {
    expect(roleLabel('BA')).toBe('Business Analyst')
    expect(roleLabel('pm')).toBe('Project Manager')
    expect(roleLabel('Business Analyst')).toBe('Business Analyst')
  })
})