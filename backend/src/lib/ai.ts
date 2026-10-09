import OpenAI from 'openai'
import { HttpError } from './errors'
import type {
  ProjectBriefing,
  ContextEntry,
  ExtractedEntry,
  ExtractedEntryType,
  ExtractionResult,
} from './contextTypes'

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
// https://openrouter.ai/models, and re-test before adding one: several free models listed
// there are unusable through the API (e.g. inkling returns 403).
const CAPABLE_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'poolside/laguna-s-2.1:free',
  'nvidia/nemotron-3.5-lightning:free',
]
export const MODELS = [
  ...CAPABLE_MODELS,
  'google/gemma-4-31b-it:free',
  // Fast, but answers with an empty list to nearly every extraction, so it is a last resort
  // for chat replies only.
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
]
// Extraction needs a model that follows the "only the user's project facts" instruction.
export const EXTRACTION_MODELS = CAPABLE_MODELS
// Never add 'openrouter/free' here: it routes to a random free model, including
// content-safety classifiers ("User Safety: safe") and code/finance-tuned ones.
const MAX_TOKENS = 1024
const REQUEST_TIMEOUT_MS = 15_000
// Vercel functions are capped at 60s and one chat turn makes two calls (reply + extraction).
const REPLY_BUDGET_MS = 30_000
const EXTRACT_BUDGET_MS = 22_000
// Extraction answers are tiny, so a model that has not replied in 10s is stuck: move on.
const EXTRACT_REQUEST_TIMEOUT_MS = 10_000
// Documents are far longer than chat replies. The /generate route also needs a few
// seconds for the blob upload and Firestore write, so stay well under the 60s cap.
const DOCUMENT_MAX_TOKENS = 2048
const DOCUMENT_REQUEST_TIMEOUT_MS = 25_000
const DOCUMENT_BUDGET_MS = 50_000

interface CompleteOptions {
  maxTokens?: number
  requestTimeoutMs?: number
  // Models to try, in order. Defaults to MODELS.
  models?: readonly string[]
  // Return false to reject an answer (e.g. unparseable) and try the next model instead.
  accept?: (content: string) => boolean
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
  {
    maxTokens = MAX_TOKENS,
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
    models = MODELS,
    accept,
  }: CompleteOptions = {}
): Promise<string> {
  const start = Date.now()
  let lastErr: unknown = null

  for (const model of models) {
    const remaining = budgetMs - (Date.now() - start)
    if (remaining <= 0) break
    try {
      const completion = await getClient().chat.completions.create(
        { model, max_tokens: maxTokens, messages },
        { timeout: Math.min(requestTimeoutMs, remaining) }
      )
      // OpenRouter can answer 200 with an error body and no `choices` when the upstream fails mid-request.
      const content = completion.choices?.[0]?.message?.content ?? ''
      if (content.trim().length === 0) {
        // Reasoning models can spend the whole token budget thinking and return nothing.
        console.warn(`OpenRouter model ${model} returned empty content; trying next`)
      } else if (accept && !accept(content)) {
        console.warn(`OpenRouter model ${model} returned an unusable answer; trying next`)
      } else {
        return content
      }
      lastErr = null
    } catch (err) {
      if (err instanceof HttpError) throw err
      if (!shouldFallBack(err)) throw err
      lastErr = err
      const status = err instanceof OpenAI.APIError ? err.status : undefined
      console.warn(`OpenRouter model ${model} failed (${status ?? 'network/timeout'}); trying next`)
    }
  }

  throw lastErr ?? new Error('No model returned a usable answer')
}

// Render the full project briefing into a system prompt: who the AI is
// talking to, who else is on the project, what the project is, and the
// shared context contributed so far — all known before the user says anything.
function formatBriefing(
  briefing: ProjectBriefing,
  fileContents: { fileName: string; content: string }[] = []
): string {
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
          .map(
            (a) =>
              `- ${a.fileName} (${a.contentType}, ${a.source === 'ai' ? 'AI-generated' : 'uploaded'})`
          )
          .join('\n')
      : 'No files have been added to this project yet.'

  const fileContentText =
    fileContents.length > 0
      ? fileContents.map((f) => `--- ${f.fileName} ---\n${f.content}`).join('\n\n')
      : ''

  return [
    `You are an AI assistant embedded in a shared collaboration workspace for the project "${briefing.projectName}".`,
    briefing.projectDescription ? `Project description: ${briefing.projectDescription}` : '',
    "Your job is to help this project's team members work with and build on the shared context below — answering questions, drafting, summarizing, and coordinating. You are a tool augmenting their work, not a team member with your own identity, opinions, or name.",
    `Project members:\n${memberList}`,
    `You are currently talking to: ${briefing.currentUser.role} (uid ${briefing.currentUser.uid}). If they ask who they are, answer directly using this information, do not say it is unknown.`,
    `Files in this project:\n${artifactList}\nYou know these files exist, but you can only see the content of a markdown file when the user references it with /file(filename) in their message. If they ask about a file's content without using that syntax, tell them to reference it that way, e.g. /file(${briefing.artifacts[0]?.fileName ?? 'example.md'}).`,
    fileContentText
      ? `Content of the file(s) referenced in this message:\n\n${fileContentText}`
      : '',
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

const ENTRY_TYPES: readonly ExtractedEntryType[] = ['decision', 'requirement', 'note']
const MAX_EXTRACTED_ENTRIES = 5
const MAX_ENTRY_CHARS = 300
const MEMORY_PREVIEW_CHARS = 160
// Two entries this similar (shared words / all words) are treated as the same fact.
const NEAR_DUPLICATE_SIMILARITY = 0.8

const EXTRACTION_SYSTEM_PROMPT =
  'You maintain the shared memory of a project team. From the exchange below, record ONLY ' +
  'project-specific facts that the USER stated or confirmed: decisions, requirements, ' +
  'constraints, owners, deadlines and names. The assistant reply is shown only so you can see ' +
  "what the user agreed to. Never record the assistant's own explanations, advice, suggestions " +
  'or general knowledge, and never record answers to questions. If the user only asks a ' +
  'question, requests a summary or a draft, or makes small talk, return []. Skip anything ' +
  'already captured in EXISTING MEMORY. If the user changes or contradicts an item in ' +
  'EXISTING MEMORY, output the new fact with "replaces" set to that item\'s id. Write each ' +
  'entry as one short, self-contained sentence under 200 characters. At most ' +
  `${MAX_EXTRACTED_ENTRIES} entries. Return ONLY a JSON array of objects shaped ` +
  '{"content": string, "type": "decision" | "requirement" | "note", "replaces": string (optional)}. ' +
  'Return [] if nothing qualifies.'

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a: string, b: string): number {
  const wordsA = new Set(a.split(' ').filter((w) => w.length > 1))
  const wordsB = new Set(b.split(' ').filter((w) => w.length > 1))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let shared = 0
  for (const w of wordsA) if (wordsB.has(w)) shared++
  return shared / (wordsA.size + wordsB.size - shared)
}

// Backstop for the prompt's "skip anything already captured": models do not reliably obey it.
function dropDuplicates(entries: ExtractedEntry[], existing: ContextEntry[]): ExtractedEntry[] {
  const known = existing.map((e) => ({ id: e.id, text: normalizeText(e.content) }))
  const seen: string[] = []
  const kept: ExtractedEntry[] = []
  for (const entry of entries) {
    const text = normalizeText(entry.content)
    // An entry that replaces another may resemble it; it is only redundant if identical.
    const repeatsExisting = known.some((k) =>
      k.id === entry.replaces
        ? k.text === text
        : similarity(k.text, text) >= NEAR_DUPLICATE_SIMILARITY
    )
    const repeatsEarlier = seen.some((s) => similarity(s, text) >= NEAR_DUPLICATE_SIMILARITY)
    if (repeatsExisting || repeatsEarlier) continue
    seen.push(text)
    kept.push(entry)
  }
  return kept
}

// Finds the JSON array in a model answer, tolerating prose or fences around it.
function parseJsonArray(raw: string): unknown[] | null {
  const text = stripCodeFence(raw || '[]')
  const candidates = [text, text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const value: unknown = JSON.parse(candidate)
      if (Array.isArray(value)) return value
    } catch {
      // try the next candidate
    }
  }
  return null
}

// null = the answer was not usable (the caller tries the next model); [] = nothing to save.
function parseExtraction(raw: string, existing: ContextEntry[]): ExtractedEntry[] | null {
  const items = parseJsonArray(raw)
  if (items === null) return null

  const existingIds = new Set(existing.map((e) => e.id))
  const entries: ExtractedEntry[] = []
  for (const item of items) {
    if (entries.length >= MAX_EXTRACTED_ENTRIES) break
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const content =
      typeof record.content === 'string' ? record.content.trim().slice(0, MAX_ENTRY_CHARS) : ''
    if (!content) continue
    const type = ENTRY_TYPES.find((t) => t === record.type) ?? 'note'
    // Only ids the model was actually shown can be replaced; anything else is a hallucination.
    const replaces =
      typeof record.replaces === 'string' && existingIds.has(record.replaces)
        ? record.replaces
        : undefined
    entries.push(replaces ? { content, type, replaces } : { content, type })
  }
  return dropDuplicates(entries, existing)
}

// Pulls durable project facts out of one chat exchange. Never throws for model trouble:
// `failed: true` tells the caller the exchange could not be processed, which is different
// from `entries: []` (processed, nothing worth saving).
export async function extractEntries(
  userMessage: string,
  assistantReply: string,
  existing: ContextEntry[] = [],
  options: { budgetMs?: number } = {}
): Promise<ExtractionResult> {
  const memory =
    existing.length > 0
      ? existing
          .map((e) => `[${e.id}] (${e.type}) ${e.content.slice(0, MEMORY_PREVIEW_CHARS)}`)
          .join('\n')
      : '(none yet)'

  try {
    let entries: ExtractedEntry[] = []
    await complete(
      [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `EXISTING MEMORY:\n${memory}\n\nEXCHANGE:\nUser: ${userMessage}\n\nAssistant: ${assistantReply}`,
        },
      ],
      options.budgetMs ?? EXTRACT_BUDGET_MS,
      {
        models: EXTRACTION_MODELS,
        requestTimeoutMs: EXTRACT_REQUEST_TIMEOUT_MS,
        accept: (raw) => {
          const parsed = parseExtraction(raw, existing)
          if (parsed === null) return false
          entries = parsed
          return true
        },
      }
    )
    return { entries, failed: false }
  } catch (err) {
    if (err instanceof HttpError) throw err
    console.error('extractEntries: no model produced a usable answer:', err)
    return { entries: [], failed: true }
  }
}
