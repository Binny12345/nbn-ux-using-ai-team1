import OpenAI from 'openai'
import { HttpError } from './errors'
import type { ProjectBriefing, ContextEntry } from './contextTypes'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw HttpError.internal('OPENROUTER_API_KEY is not set')
  }
  // maxRetries 0: a failed model falls straight through to the next one in MODELS.
  client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1', maxRetries: 0 })
  return client
}

// Tried in order. Free OpenRouter models are frequently rate-limited (429) or
// withdrawn (404), so a failure moves on to the next entry. Verify ids at
// https://openrouter.ai/models.
export const MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3.8-27b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
]
// Never add 'openrouter/free' here: it routes to a random free model, including
// content-safety classifiers ("User Safety: safe") and code/finance-tuned ones.
const MAX_TOKENS = 1024
const REQUEST_TIMEOUT_MS = 15_000
// Vercel functions are capped at 60s and one chat turn makes two calls (reply + extraction).
const REPLY_BUDGET_MS = 35_000
const EXTRACT_BUDGET_MS = 20_000
// Documents are far longer than chat replies. The /generate route also needs a few
// seconds for the blob upload and Firestore write, so stay well under the 60s cap.
const DOCUMENT_MAX_TOKENS = 2048
const DOCUMENT_REQUEST_TIMEOUT_MS = 25_000
const DOCUMENT_BUDGET_MS = 50_000

interface CompleteOptions {
  maxTokens?: number
  requestTimeoutMs?: number
}

function shouldFallBack(err: unknown): boolean {
  if (!(err instanceof OpenAI.APIError)) return false
  const status = err.status
  return status === undefined || status === 404 || status === 408 || status === 429 || status >= 500
}

function formatContext(context: ContextEntry[]): string {
  if (context.length === 0) return ''
  return context
    .map((e) => `${e.role} (${e.contributedBy}) — ${e.type}:\n${e.content}`)
    .join('\n\n')
}

async function complete(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  budgetMs: number,
  { maxTokens = MAX_TOKENS, requestTimeoutMs = REQUEST_TIMEOUT_MS }: CompleteOptions = {}
): Promise<string> {
  const start = Date.now()
  let lastErr: unknown = null

  for (const model of MODELS) {
    const remaining = budgetMs - (Date.now() - start)
    if (remaining <= 0) break
    try {
      const completion = await getClient().chat.completions.create(
        { model, max_tokens: maxTokens, messages },
        { timeout: Math.min(requestTimeoutMs, remaining) }
      )
      // OpenRouter can answer 200 with an error body and no `choices` when the upstream fails mid-request.
      const content = completion.choices?.[0]?.message?.content ?? ''
      if (content.trim().length > 0) return content
      // Reasoning models can spend the whole token budget thinking and return nothing.
      console.warn(`OpenRouter model ${model} returned empty content; trying next`)
      lastErr = null
    } catch (err) {
      if (err instanceof HttpError) throw err
      if (!shouldFallBack(err)) throw err
      lastErr = err
      const status = err instanceof OpenAI.APIError ? err.status : undefined
      console.warn(`OpenRouter model ${model} failed (${status ?? 'network/timeout'}); trying next`)
    }
  }

  if (lastErr) throw lastErr
  return ''
}

// Render the full project briefing into a system prompt: who the AI is
// talking to, who else is on the project, what the project is, and the
// shared context contributed so far — all known before the user says anything.
function formatBriefing(briefing: ProjectBriefing, fileContents: { fileName: string; content: string }[] = []): string {
  const memberList = briefing.members
    .map((m) => {
      const name = m.displayName ?? 'Unnamed user'
      const you =
        m.uid === briefing.currentUser.uid ? ' — this is who you are currently talking to' : ''
      return `- ${name} (${m.role})${you}`
    })
    .join('\n')

  const contextText =
    briefing.context.length > 0
      ? briefing.context
          .map((e) => `${e.role} (${e.contributedBy}) — ${e.type}:\n${e.content}`)
          .join('\n\n')
      : 'No shared context has been contributed yet.'

  const artifactList =
    briefing.artifacts.length > 0
      ? briefing.artifacts
          .map((a) => `- ${a.fileName} (${a.contentType}, ${a.source === 'ai' ? 'AI-generated' : 'uploaded'})`)
          .join('\n')
      : 'No files have been added to this project yet.'

  const fileContentText =
    fileContents.length > 0
      ? fileContents
          .map((f) => `--- ${f.fileName} ---\n${f.content}`)
          .join('\n\n')
      : ''

  return [
    `You are an AI assistant embedded in a shared collaboration workspace for the project "${briefing.projectName}".`,
    briefing.projectDescription ? `Project description: ${briefing.projectDescription}` : '',
    "Your job is to help this project's team members work with and build on the shared context below — answering questions, drafting, summarizing, and coordinating. You are a tool augmenting their work, not a team member with your own identity, opinions, or name.",
    `Project members:\n${memberList}`,
    `You are currently talking to: ${briefing.currentUser.role} (uid ${briefing.currentUser.uid}). If they ask who they are, answer directly using this information, do not say it is unknown.`,
    `Files in this project:\n${artifactList}\nYou know these files exist, but you can only see the content of a markdown file when the user references it with /file(filename) in their message. If they ask about a file's content without using that syntax, tell them to reference it that way, e.g. /file(${briefing.artifacts[0]?.fileName ?? 'example.md'}).`,
    fileContentText ? `Content of the file(s) referenced in this message:\n\n${fileContentText}` : '',
    `Shared context contributed so far, attributed by role and user id. Do not assume one person's self-described facts (like a name) apply to anyone else, including the current speaker, unless the context entry is explicitly credited to them:\n\n${contextText}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function generateReply(
  briefing: ProjectBriefing,
  message: string,
  fileContents: { fileName: string; content: string }[] = []
): Promise<string> {
  const systemPrompt = formatBriefing(briefing, fileContents)
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ]

    return await complete(messages, REPLY_BUDGET_MS)
  } catch (err) {
    if (err instanceof HttpError) throw err
    console.error('generateReply: OpenRouter call failed:', err)
    throw new HttpError(502, 'Bad Gateway', 'The AI service failed to respond')
  }
}

// Models sometimes wrap a whole document in a ```markdown fence despite being told not to.
// Only strips when the fence encloses the entire text, so fenced code inside is untouched.
function stripDocumentFence(raw: string): string {
  const text = raw.trim()
  const match = /^```[a-z]*[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(text)
  return match?.[1] !== undefined ? match[1].trim() : text
}

const DOCUMENT_SYSTEM_PROMPT =
  'You write standalone project documents in Markdown for a shared team workspace. ' +
  'Reply with ONLY the document itself: no preamble, no closing remarks, and do not wrap ' +
  'it in a code fence. Start with a single "# Title" heading, then use clear sections. ' +
  'Use the project context below where it is relevant, and do not invent facts it contradicts.'

// Generates a new Markdown document from the project context and a free-text prompt.
// Separate from generateReply: that one sends the context with no instructions and
// caps output at chat-reply length.
export async function generateDocument(context: ContextEntry[], prompt: string): Promise<string> {
  const contextText = formatContext(context)
  const system =
    contextText.length > 0
      ? `${DOCUMENT_SYSTEM_PROMPT}\n\nProject context:\n${contextText}`
      : DOCUMENT_SYSTEM_PROMPT

  try {
    const raw = await complete(
      [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      DOCUMENT_BUDGET_MS,
      { maxTokens: DOCUMENT_MAX_TOKENS, requestTimeoutMs: DOCUMENT_REQUEST_TIMEOUT_MS }
    )
    const markdown = stripDocumentFence(raw)
    if (markdown.length === 0) {
      throw new HttpError(502, 'Bad Gateway', 'The AI service returned an empty document')
    }
    return markdown
  } catch (err) {
    if (err instanceof HttpError) throw err
    console.error('generateDocument: OpenRouter call failed:', err)
    throw new HttpError(502, 'Bad Gateway', 'The AI service failed to respond')
  }
}

// Models often wrap JSON in a ```json fence despite being told not to.
function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
}

export async function extractEntries(
  userMessage: string,
  assistantReply: string
): Promise<Array<{ content: string; type: string }>> {
  const system =
    'You extract durable, reusable facts from a conversation exchange. ' +
    'Return ONLY a JSON array of objects with "content" and "type" fields, ' +
    'where type is one of: decision, requirement, note. ' +
    'Capture only things worth remembering across sessions; return [] if nothing is durable.'

  try {
    const raw = await complete(
      [
        { role: 'system', content: system },
        { role: 'user', content: `User: ${userMessage}\n\nAssistant: ${assistantReply}` },
      ],
      EXTRACT_BUDGET_MS
    )

    const parsed = JSON.parse(stripCodeFence(raw || '[]')) as Array<{
      content: string
      type: string
    }>
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e) => e && typeof e.content === 'string' && typeof e.type === 'string')
  } catch (err) {
    if (err instanceof HttpError) throw err
    console.error('extractEntries: OpenRouter call or parse failed:', err)
    return []
  }
}