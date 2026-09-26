import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.hoisted(() => vi.fn())

vi.mock('openai', () => {
  class APIError extends Error {
    status: number | undefined
    constructor(status?: number) {
      super(`status ${status}`)
      this.status = status
    }
  }
  class OpenAI {
    static APIError = APIError
    chat = { completions: { create } }
  }
  return { default: OpenAI }
})

import OpenAI from 'openai'
import { generateReply, extractEntries, MODELS } from '../../../src/lib/ai'
import type { ProjectBriefing } from '../../../src/lib/contextTypes'

const reply = (content: string | null) => ({ choices: [{ message: { content } }] })
const apiError = (status?: number) => new OpenAI.APIError(status, undefined, undefined, undefined)

const emptyBriefing: ProjectBriefing = {
  projectName: 'Test Project',
  projectDescription: '',
  members: [],
  currentUser: { uid: 'u1', role: 'BA' },
  context: [],
}

describe('ai model fallback', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    create.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('moves to the next model when one is rate limited', async () => {
    create.mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce(reply('hello'))
    await expect(generateReply(emptyBriefing, 'hi')).resolves.toBe('hello')
    expect(create.mock.calls.map((c) => c[0].model)).toEqual([MODELS[0], MODELS[1]])
  })

  it('moves to the next model when one returns empty content', async () => {
    create.mockResolvedValueOnce(reply('')).mockResolvedValueOnce(reply('hello'))
    await expect(generateReply(emptyBriefing, 'hi')).resolves.toBe('hello')
  })

  it('moves to the next model when a 200 response has no choices', async () => {
    create
      .mockResolvedValueOnce({ error: { message: 'upstream failed' } })
      .mockResolvedValueOnce(reply('hello'))
    await expect(generateReply(emptyBriefing, 'hi')).resolves.toBe('hello')
  })

  it('does not fall back on a non-retryable error such as a bad key', async () => {
    create.mockRejectedValue(apiError(401))
    await expect(generateReply(emptyBriefing, 'hi')).rejects.toMatchObject({ status: 502 })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('throws 502 once every model has failed', async () => {
    create.mockRejectedValue(apiError(429))
    await expect(generateReply(emptyBriefing, 'hi')).rejects.toMatchObject({ status: 502 })
    expect(create).toHaveBeenCalledTimes(MODELS.length)
  })

  it('parses extraction output wrapped in a code fence', async () => {
    create.mockResolvedValueOnce(reply('```json\n[{"content":"Use CSV","type":"decision"}]\n```'))
    await expect(extractEntries('u', 'a')).resolves.toEqual([
      { content: 'Use CSV', type: 'decision' },
    ])
  })

  it('returns no entries when extraction fails on every model', async () => {
    create.mockRejectedValue(apiError(429))
    await expect(extractEntries('u', 'a')).resolves.toEqual([])
  })
})