import type {AgentEvent, ChatMessage} from './types'

// The agent reaches Sanity Context through Groq's remote MCP support: Groq's
// Responses API connects to both Context MCP endpoints and runs the tool calls
// server-side, so this file only sends the conversation and relays the result.

const GROQ_URL = 'https://api.groq.com/openai/v1/responses'
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const DATA_SERVER = 'sanity_data'
const KB_SERVER = 'sanity_kb'

export class GroqError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const SYSTEM_PROMPT = `You are Home Truth, an assistant that helps homebuyers in India check a real-estate project before they pay. You compare what the builder advertises with what is registered with the state Real Estate Regulatory Authority (RERA), what the agreement for sale says, and what the Real Estate (Regulation and Development) Act, 2016 requires.

The people you help are often first-time buyers about to make the biggest payment of their lives. Be direct, use plain English, and keep answers short. Use a small table when you compare several facts.

## Your two sources

1. \`${DATA_SERVER}\` (GROQ mode) is the structured record for the project in this conversation. Use it for exact facts and comparisons. Content types:
   - \`project\`: name, slug, registrationNumber, promoter, city, state.
   - \`sourceDocument\`: title, shortName, kind (registration | agreement | marketing | law | other), publisher, publishedAt, url, body (full text).
   - \`attribute\`: a fact buyers care about: key, label, valueType, unit, comparison (equal | at_most | at_least), severity, buyerImpact, vocabulary.
   - \`claim\`: one fact as stated by one document: attribute->, source->, numberValue | dateValue | textValue | listValue, quote (exact words), location, verified.
   - \`finding\`: the computed comparison for one attribute: status (match | mismatch | violation | single_source), severity, summary, entries[] {role, display, claim->}.
   Findings are computed by deterministic code from quotes that were checked against the documents, so trust them over your own reading. Useful queries:
   - Problems: *[_type == "finding" && status in ["mismatch", "violation"]]{status, severity, summary, "fact": attribute->label}
   - Registered facts: *[_type == "claim" && source->kind == "registration"]{"fact": attribute->label, numberValue, dateValue, textValue, listValue, quote, location}
   - A document's text: *[_type == "sourceDocument" && shortName == "Draft agreement"][0]{title, body}
2. \`${KB_SERVER}\` (Knowledge Base mode) holds the RERA Act and the project's documents as an outline of entries, with conflicts between sources already resolved and every entry citing its sources. Use it for what the law says, buyer rights, what a clause means, and anything the structured record doesn't model. Call initial_context once to get the outline, then read the entries you need with knowledge_base_read, several paths in one call.

## How to answer

- When documents disagree, trust them in this order: the Act, then the RERA registration, then the agreement for sale, then marketing (brochures, websites, ads, broker messages). The registration is what the builder is legally held to.
- When the buyer pastes an ad, a broker's message or a price quote, split it into separate claims and check each against the registered record. Give each a verdict: Matches, Contradicts the registered record, Not in any registered document, or Can't check.
- If they ask about a specific flat such as B-1502, check its building against the registered buildings and its floor against the sanctioned floors.
- Cite every fact with the document's short name and the exact quote or clause. Never invent a quote, section number, date or amount. If neither source has the answer, say so and tell them where to check: the state RERA portal, the sanctioned plan, or a lawyer.
- End with what to do next: questions to ask the builder, documents to ask for, or what not to pay until something is fixed.
- You explain what the documents and the law say. You don't give legal or financial advice or tell anyone whether to buy; for a large payment, suggest a property lawyer reviews the agreement.
- Claims with verified: false haven't been checked by a person yet. Say so when your answer depends on one.`

function kbUrl(): string | null {
  if (process.env.SANITY_CONTEXT_KB_MCP_URL) return process.env.SANITY_CONTEXT_KB_MCP_URL
  const kbId = process.env.SANITY_KNOWLEDGE_BASE_ID
  const dataUrl = process.env.SANITY_CONTEXT_MCP_URL
  if (!kbId || !dataUrl) return null
  const url = new URL(dataUrl)
  url.searchParams.set('mode', 'knowledge_base')
  url.searchParams.set('knowledgeBases', kbId)
  return url.toString()
}

/** Returns what's missing for the chat agent, or null when it's ready. */
export function agentConfigError(): string | null {
  const missing: string[] = []
  if (!process.env.GROQ_API_KEY) missing.push('GROQ_API_KEY')
  if (!process.env.SANITY_ORGANIZATION_TOKEN) missing.push('SANITY_ORGANIZATION_TOKEN')
  if (!process.env.SANITY_CONTEXT_MCP_URL) missing.push('SANITY_CONTEXT_MCP_URL')
  if (!kbUrl()) missing.push('SANITY_CONTEXT_KB_MCP_URL (or SANITY_KNOWLEDGE_BASE_ID)')
  return missing.length ? `Chat is not configured. Missing: ${missing.join(', ')}.` : null
}

// Narrows the data endpoint to this project, the attribute definitions and the
// law (documents and claims with no project). Context combines this with the
// endpoint's own filter, so it can only ever narrow access.
function scopedDataUrl(projectId: string): string {
  const url = new URL(process.env.SANITY_CONTEXT_MCP_URL!)
  url.searchParams.set(
    'groqFilter',
    `_type == "attribute" || _id == "${projectId}" || project._ref == "${projectId}" || (_type in ["claim", "sourceDocument"] && !defined(project))`,
  )
  // The schema is described in the system prompt, so skip initial_context here;
  // that also keeps the tool names of the two servers from overlapping.
  url.searchParams.set('tools', 'groq_query,schema_explorer,array_field_reader')
  return url.toString()
}

function describeStep(tool: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>
  if (tool === 'groq_query' && typeof args.query === 'string') return args.query
  if (tool === 'knowledge_base_read' && Array.isArray(args.paths)) return args.paths.join(', ')
  if (tool === 'schema_explorer' && typeof args.type === 'string') return args.type
  if (tool === 'array_field_reader') return `${args.field ?? ''} (${args.mode ?? ''})`
  return ''
}

interface RunAgentOptions {
  projectId: string
  projectLabel: string
  messages: ChatMessage[]
  emit: (event: AgentEvent) => void
  signal: AbortSignal
}

// The parts of a Responses API output item this file reads.
interface OutputItem {
  type: string
  server_label?: string
  name?: string
  arguments?: string
  error?: unknown
  content?: {type: string; text?: string}[]
}

function parseArguments(raw: string | undefined): unknown {
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export async function runAgent({projectId, projectLabel, messages, emit, signal}: RunAgentOptions) {
  const authorization = `Bearer ${process.env.SANITY_ORGANIZATION_TOKEN}`
  const context = `The buyer is looking at ${projectLabel} (document id "${projectId}"). ${DATA_SERVER} is already limited to this project, the attribute definitions and the law. Today is ${new Date().toISOString().slice(0, 10)}.`

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: MODEL,
      instructions: `${SYSTEM_PROMPT}\n\n${context}`,
      input: messages.map((m) => ({role: m.role, content: m.content})),
      tools: [
        {
          type: 'mcp',
          server_label: DATA_SERVER,
          server_url: scopedDataUrl(projectId),
          server_description: 'Structured record for this project: findings, claims, attributes and source documents (GROQ).',
          headers: {Authorization: authorization},
          require_approval: 'never',
        },
        {
          type: 'mcp',
          server_label: KB_SERVER,
          server_url: kbUrl()!,
          server_description: 'Knowledge Base: the RERA Act and the project documents as cited entries.',
          headers: {Authorization: authorization},
          require_approval: 'never',
        },
      ],
      stream: false,
    }),
    signal,
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new GroqError(response.status, body?.error?.message ?? response.statusText)
  }

  // Groq has already run every tool call; replay them as steps, then the answer.
  let wroteText = false
  for (const item of (body.output ?? []) as OutputItem[]) {
    if (item.type === 'mcp_call' && item.name) {
      emit({
        type: 'step',
        server: item.server_label ?? '',
        tool: item.name,
        detail: describeStep(item.name, parseArguments(item.arguments)),
      })
      if (item.error) emit({type: 'step_failed'})
    } else if (item.type === 'message') {
      for (const part of item.content ?? []) {
        // gpt-oss leaves tool-result markers such as 【result[0].quote】 in its text,
        // and puts <br> inside table cells, which the chat shows literally.
        const text = part.text?.replace(/【[^】]*】/g, '').replace(/\s*<br\s*\/?>\s*/gi, ' ')
        if (part.type !== 'output_text' || !text) continue
        if (wroteText) emit({type: 'text', text: '\n\n'})
        emit({type: 'text', text})
        wroteText = true
      }
    }
  }

  if (body.status === 'incomplete') {
    emit({type: 'notice', message: 'The answer was cut off because it reached the length limit.'})
  } else if (!wroteText) {
    emit({type: 'error', message: 'The model returned no answer. Try rephrasing your question.'})
  }
}
