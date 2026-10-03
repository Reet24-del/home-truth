import {agentConfigError, GroqError, runAgent} from '@/lib/agent'
import type {AgentEvent, ChatMessage} from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const MAX_MESSAGES = 40
const MAX_CHARS = 20_000

interface ChatRequest {
  projectId: string
  projectLabel: string
  messages: ChatMessage[]
}

function parseRequest(body: unknown): ChatRequest | string {
  if (!body || typeof body !== 'object') return 'Expected a JSON object.'
  const {projectId, projectLabel, messages} = body as Record<string, unknown>
  if (typeof projectId !== 'string' || !ID_PATTERN.test(projectId)) return 'Invalid projectId.'
  if (typeof projectLabel !== 'string' || projectLabel.length > 200) return 'Invalid projectLabel.'
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return `Send between 1 and ${MAX_MESSAGES} messages.`
  }
  for (const message of messages) {
    const {role, content} = (message ?? {}) as Record<string, unknown>
    if (role !== 'user' && role !== 'assistant') return 'Each message needs a user or assistant role.'
    if (typeof content !== 'string' || !content.trim() || content.length > MAX_CHARS) {
      return `Each message needs text of at most ${MAX_CHARS} characters.`
    }
  }
  if (messages[messages.length - 1].role !== 'user') return 'The last message must be from the user.'
  return {projectId, projectLabel, messages: messages as ChatMessage[]}
}

function describeError(error: unknown): string {
  if (error instanceof GroqError) {
    if (error.status === 401) return 'The Groq API key is missing or invalid. Check GROQ_API_KEY.'
    if (error.status === 429) return 'Too many requests right now. Try again in a minute.'
    return `The AI service returned an error (${error.status}): ${error.message}`
  }
  if (error instanceof Error && error.name === 'AbortError') return 'Stopped.'
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export async function POST(request: Request) {
  const configError = agentConfigError()
  if (configError) return Response.json({error: configError}, {status: 503})

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({error: 'Invalid JSON.'}, {status: 400})
  }
  const parsed = parseRequest(body)
  if (typeof parsed === 'string') return Response.json({error: parsed}, {status: 400})

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        await runAgent({...parsed, emit, signal: request.signal})
        emit({type: 'done'})
      } catch (error) {
        console.error('chat failed', error)
        emit({type: 'error', message: describeError(error)})
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store'},
  })
}
