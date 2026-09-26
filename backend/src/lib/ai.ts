import OpenAI from 'openai'
import { HttpError } from './errors'
import type { ProjectBriefing } from './contextTypes'

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
  'openrouter/free',
]
const MAX_TOKENS = 1024
const REQUEST_TIMEOUT_MS = 15_000
// Vercel functions are capped at 60s and one chat turn makes two calls (reply + extraction).
const REPLY_BUDGET_MS = 35_000
const EXTRACT_BUDGET_MS = 20_000

function shouldFallBack(err: unknown): boolean {
  if (!(err instanceof OpenAI.APIError)) return false
  const status = err.status
  return status === undefined || status === 404 || status === 408 || status === 429 || status >= 500
}

async function complete(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  budgetMs: number
): Promise<string> {
  const start = Date.now()
  let lastErr: unknown = null

  for (const model of MODELS) {
    const remaining = budgetMs - (Date.now() - start)
    if (remaining <= 0) break
    try {
      const completion = await getClient().chat.completions.create(
        { model, max_tokens: MAX_TOKENS, messages },
        { timeout: Math.min(REQUEST_TIMEOUT_MS, remaining) }
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
function formatBriefing(briefing: ProjectBriefing): string {
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

  return [
    `You are an AI assistant embedded in a shared collaboration workspace for the project "${briefing.projectName}".`,
    briefing.projectDescription ? `Project description: ${briefing.projectDescription}` : '',
    "Your job is to help this project's team members work with and build on the shared context below — answering questions, drafting, summarizing, and coordinating. You are a tool augmenting their work, not a team member with your own identity, opinions, or name.",
    `Project members:\n${memberList}`,
    `You are currently talking to: ${briefing.currentUser.role} (uid ${briefing.currentUser.uid}). If they ask who they are, answer directly using this information, do not say it is unknown.`,
    `Shared context contributed so far, attributed by role and user id. Do not assume one person's self-described facts (like a name) apply to anyone else, including the current speaker, unless the context entry is explicitly credited to them:\n\n${contextText}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function generateReply(briefing: ProjectBriefing, message: string): Promise<string> {
  const systemPrompt = formatBriefing(briefing)
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