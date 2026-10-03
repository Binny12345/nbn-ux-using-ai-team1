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
import { generateReply, generateDocument, extractEntries, MODELS } from '../../../src/lib/ai';
import type { ProjectBriefing } from '../../../src/lib/contextTypes'
import type { ContextEntry } from '../../../src/lib/contextTypes'

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

describe('generateDocument', () => {
  const entry: ContextEntry = {
    content: 'Login is email/password only',
    type: 'decision',
    contributedBy: 'u1',
    role: 'BA',
    sourceChatId: 's1',
    status: 'Active',
  }

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    create.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('sends document instructions, the project context and the prompt, with a larger token limit', async () => {
    create.mockResolvedValueOnce(reply('# Doc\n\nbody'))

    await generateDocument([entry], 'write the login requirements')

    const request = create.mock.calls[0]?.[0]
    expect(request.max_tokens).toBeGreaterThan(1024)
    expect(request.messages[0].role).toBe('system')
    expect(request.messages[0].content).toContain('Markdown')
    expect(request.messages[0].content).toContain('Login is email/password only')
    expect(request.messages[1]).toEqual({
      role: 'user',
      content: 'write the login requirements',
    })
  })

  it('works with no project context yet', async () => {
    create.mockResolvedValueOnce(reply('# Doc'))
    await expect(generateDocument([], 'anything')).resolves.toBe('# Doc')
    expect(create.mock.calls[0]?.[0].messages[0].content).not.toContain('Project context:')
  })

  it('unwraps a document the model wrapped in a code fence, leaving inner fences alone', async () => {
    const inner = '# Doc\n\n```js\nconst a = 1\n```\n\nend'
    create.mockResolvedValueOnce(reply('```markdown\n' + inner + '\n```'))
    await expect(generateDocument([], 'x')).resolves.toBe(inner)
  })

  it('does not strip fences from a document that merely contains a code block', async () => {
    const doc = '# Doc\n\n```js\nconst a = 1\n```'
    create.mockResolvedValueOnce(reply(doc))
    await expect(generateDocument([], 'x')).resolves.toBe(doc)
  })

  it('falls back to the next model on a rate limit', async () => {
    create.mockRejectedValueOnce(apiError(429)).mockResolvedValueOnce(reply('# Doc'))
    await expect(generateDocument([], 'x')).resolves.toBe('# Doc')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('throws 502 once every model has failed', async () => {
    create.mockRejectedValue(apiError(429))
    await expect(generateDocument([], 'x')).rejects.toMatchObject({ status: 502 })
  })

  it('throws 502 when every model returns an empty document', async () => {
    create.mockResolvedValue(reply('   '))
    await expect(generateDocument([], 'x')).rejects.toMatchObject({ status: 502 })
  })
})
