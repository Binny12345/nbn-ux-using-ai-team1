import { describe, it, expect, vi, beforeEach } from 'vitest'
import OpenAI from 'openai'
import {
  generateReply,
  generateDocument,
  extractEntries,
  MODELS,
  EXTRACTION_MODELS,
} from '../../../src/lib/ai'
import type { ProjectBriefing, ContextEntry } from '../../../src/lib/contextTypes'

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

const reply = (content: string | null) => ({ choices: [{ message: { content } }] })
const apiError = (status?: number) => new OpenAI.APIError(status, undefined, undefined, undefined)

const emptyBriefing: ProjectBriefing = {
  projectName: 'Test Project',
  projectDescription: '',
  status: 'active',
  members: [],
  currentUser: { uid: 'u1', role: 'BA' },
  context: [],
  artifacts: [],
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
})

describe('generateDocument', () => {
  const entry: ContextEntry = {
    id: 'c1',
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

describe('extractEntries', () => {
  const existing = (id: string, content: string): ContextEntry => ({
    id,
    content,
    type: 'decision',
    contributedBy: 'u1',
    role: 'BA',
    sourceChatId: 's1',
    status: 'Active',
  })
  const answer = (items: unknown) => reply(JSON.stringify(items))

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    create.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('returns the entries the model found', async () => {
    create.mockResolvedValueOnce(answer([{ content: 'Use CSV', type: 'decision' }]))
    await expect(extractEntries('use csv', 'ok')).resolves.toEqual({
      entries: [{ content: 'Use CSV', type: 'decision' }],
      failed: false,
    })
  })

  it('only uses extraction-capable models, never the dead or empty-answering ones', async () => {
    create.mockRejectedValue(apiError(429))
    await extractEntries('x', 'y')
    expect(create.mock.calls.map((c) => c[0].model)).toEqual([...EXTRACTION_MODELS])
    expect(EXTRACTION_MODELS).not.toContain('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free')
    expect(EXTRACTION_MODELS.some((m) => m.startsWith('qwen/'))).toBe(false)
  })

  it('treats an empty list as success: nothing worth saving is not a failure, and no other model is asked', async () => {
    create.mockResolvedValueOnce(reply('[]'))
    await expect(extractEntries('what is SDLC?', 'a lifecycle')).resolves.toEqual({
      entries: [],
      failed: false,
    })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('reports failure, instead of silently returning nothing, when every model errors', async () => {
    create.mockRejectedValue(apiError(429))
    await expect(extractEntries('x', 'y')).resolves.toEqual({ entries: [], failed: true })
  })

  it('moves to the next model when the answer is not valid JSON, instead of giving up', async () => {
    create
      .mockResolvedValueOnce(reply("Sorry, I can't help with that."))
      .mockResolvedValueOnce(answer([{ content: 'Deadline is 30 Oct', type: 'requirement' }]))

    const result = await extractEntries('deadline is 30 Oct', 'noted')

    expect(result).toEqual({
      entries: [{ content: 'Deadline is 30 Oct', type: 'requirement' }],
      failed: false,
    })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('reports failure when every model returns unusable output', async () => {
    create.mockResolvedValue(reply('not json at all'))
    await expect(extractEntries('x', 'y')).resolves.toEqual({ entries: [], failed: true })
    expect(create).toHaveBeenCalledTimes(EXTRACTION_MODELS.length)
  })

  it('unwraps a code fence and finds a JSON array inside surrounding prose', async () => {
    create.mockResolvedValueOnce(reply('```json\n[{"content":"Use CSV","type":"decision"}]\n```'))
    const fenced = await extractEntries('a', 'b')
    expect(fenced.entries).toEqual([{ content: 'Use CSV', type: 'decision' }])

    create.mockResolvedValueOnce(
      reply('Here is the memory: [{"content":"Use CSV","type":"decision"}] Hope that helps!')
    )
    const prose = await extractEntries('a', 'b')
    expect(prose.entries).toEqual([{ content: 'Use CSV', type: 'decision' }])
  })

  it('sanitises entries: unknown types become note, blank or malformed items are dropped, long text is cut', async () => {
    create.mockResolvedValueOnce(
      answer([
        { content: 'Odd type', type: 'banana' },
        { content: '   ', type: 'note' },
        { type: 'note' },
        'a string',
        null,
        { content: 'x'.repeat(500), type: 'note' },
      ])
    )

    const { entries } = await extractEntries('a', 'b')

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ content: 'Odd type', type: 'note' })
    expect(entries[1]?.content).toHaveLength(300)
  })

  it('keeps at most 5 entries from one exchange', async () => {
    const facts = [
      'Priya owns the API work',
      'Launch is planned for November',
      'Reports export as CSV only',
      'Passwords need twelve characters',
      'Staging runs on Vercel',
      'Support hours are weekdays nine to five',
      'The brand colour is deep teal',
    ]
    create.mockResolvedValueOnce(answer(facts.map((content) => ({ content, type: 'note' }))))
    const { entries } = await extractEntries('a', 'b')
    expect(entries.map((e) => e.content)).toEqual(facts.slice(0, 5))
  })

  it('shows the model the existing memory by id, and the exchange', async () => {
    create.mockResolvedValueOnce(reply('[]'))

    await extractEntries('the user said this', 'the assistant said that', [
      existing('abc123', 'Login uses email and password'),
    ])

    const messages = create.mock.calls[0]?.[0].messages
    expect(messages[0].content).toContain('ONLY')
    expect(messages[1].content).toContain('[abc123] (decision) Login uses email and password')
    expect(messages[1].content).toContain('User: the user said this')
    expect(messages[1].content).toContain('Assistant: the assistant said that')
  })

  it('says so when there is no memory yet', async () => {
    create.mockResolvedValueOnce(reply('[]'))
    await extractEntries('a', 'b', [])
    expect(create.mock.calls[0]?.[0].messages[1].content).toContain('(none yet)')
  })

  describe('replacing existing entries', () => {
    const memory = [existing('old1', 'Login uses email and password only, no social login')]

    it('keeps "replaces" when it names an entry the model was shown', async () => {
      create.mockResolvedValueOnce(
        answer([
          {
            content: 'Google sign-in is now in scope for the MVP',
            type: 'decision',
            replaces: 'old1',
          },
        ])
      )
      const { entries } = await extractEntries('add google', 'ok', memory)
      expect(entries).toEqual([
        {
          content: 'Google sign-in is now in scope for the MVP',
          type: 'decision',
          replaces: 'old1',
        },
      ])
    })

    it('drops an invented id so a hallucination can never outdate a real entry', async () => {
      create.mockResolvedValueOnce(
        answer([
          { content: 'Google sign-in is now in scope', type: 'decision', replaces: 'made-up-id' },
        ])
      )
      const { entries } = await extractEntries('add google', 'ok', memory)
      expect(entries).toEqual([{ content: 'Google sign-in is now in scope', type: 'decision' }])
    })
  })

  describe('duplicates', () => {
    const memory = [
      existing('d1', 'The deadline is 30 October'),
      existing('d2', 'Priya owns the API work'),
    ]

    it('drops an entry identical to existing memory, ignoring case and punctuation', async () => {
      create.mockResolvedValueOnce(
        answer([{ content: 'the deadline is 30 October!!', type: 'note' }])
      )
      expect((await extractEntries('a', 'b', memory)).entries).toEqual([])
    })

    it('drops a near-duplicate of existing memory', async () => {
      create.mockResolvedValueOnce(
        answer([{ content: 'Priya owns the API work now', type: 'note' }])
      )
      expect((await extractEntries('a', 'b', memory)).entries).toEqual([])
    })

    it('drops repeats within the same answer', async () => {
      create.mockResolvedValueOnce(
        answer([
          { content: 'Reports export as CSV only', type: 'decision' },
          { content: 'Reports export as CSV only.', type: 'requirement' },
        ])
      )
      expect((await extractEntries('a', 'b')).entries).toHaveLength(1)
    })

    it('keeps an entry that changes a value (it is an update, not a repeat)', async () => {
      create.mockResolvedValueOnce(
        answer([{ content: 'The deadline is 31 October', type: 'requirement', replaces: 'd1' }])
      )
      const { entries } = await extractEntries('move deadline', 'ok', memory)
      expect(entries).toEqual([
        { content: 'The deadline is 31 October', type: 'requirement', replaces: 'd1' },
      ])
    })

    it('drops a "replacement" that says exactly what the entry already says', async () => {
      create.mockResolvedValueOnce(
        answer([{ content: 'The deadline is 30 October', type: 'requirement', replaces: 'd1' }])
      )
      expect((await extractEntries('a', 'b', memory)).entries).toEqual([])
    })
  })
})
