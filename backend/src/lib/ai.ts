import OpenAI from 'openai'
import { HttpError } from './errors'
import type { ContextEntry } from './contextTypes'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw HttpError.internal('OPENROUTER_API_KEY is not set')
  }
  client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
  return client
}

// Model id in OpenRouter form. Verify at https://openrouter.ai/models.
const MODEL = 'qwen/qwen3.8-27b:free'
const MAX_TOKENS = 1024

// Render context entries into an attributed system prompt (FR-6).
function formatContext(context: ContextEntry[]): string {
  if (context.length === 0) return ''
  return context
    .map((e) => `${e.role} (${e.contributedBy}) — ${e.type}:\n${e.content}`)
    .join('\n\n')
}

export async function generateReply(context: ContextEntry[], message: string): Promise<string> {
  const systemPrompt = formatContext(context)
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (systemPrompt.length > 0) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: message })

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages,
    })
    return completion.choices[0]?.message?.content ?? ''
  } catch (err) {
    if (err instanceof HttpError) throw err
    console.error('generateReply: OpenRouter call failed:', err)
    throw new HttpError(502, 'Bad Gateway', 'The AI service failed to respond')
  }
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
    const completion = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `User: ${userMessage}\n\nAssistant: ${assistantReply}` },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '[]'
    const parsed = JSON.parse(raw) as Array<{ content: string; type: string }>
    if (!Array.isArray(parsed)) return []
    // Keep only well-formed entries.
    return parsed.filter((e) => e && typeof e.content === 'string' && typeof e.type === 'string')
  } catch (err) {
    if (err instanceof HttpError) throw err
    // If the model returns non-JSON or the call fails, save nothing rather than
    // corrupting context — the write side is best-effort.
    console.error('extractEntries: OpenRouter call or parse failed:', err)
    return []
  }
}
