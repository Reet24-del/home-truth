import Anthropic from '@anthropic-ai/sdk'

import type {AgentEvent, ChatMessage} from './types'

// The agent reaches Sanity Context through Claude's MCP connector: Anthropic's
// API connects to both Context MCP endpoints and runs the tool calls
// server-side, so this file only streams the conversation.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5'
const DATA_SERVER = 'sanity-data'
const KB_SERVER = 'sanity-kb'
// A long server-tool turn can pause; we resume it this many times at most.
const MAX_CONTINUATIONS = 4

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

export async function runAgent({projectId, projectLabel, messages, emit, signal}: RunAgentOptions) {
  const client = new Anthropic()
  const token = process.env.SANITY_ORGANIZATION_TOKEN!
  const conversation: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        betas: ['mcp-client-2025-11-20', 'server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: {type: 'adaptive'},
        cache_control: {type: 'ephemeral'},
        system: [
          {type: 'text', text: SYSTEM_PROMPT},
          {
            type: 'text',
            text: `The buyer is looking at ${projectLabel} (document id "${projectId}"). ${DATA_SERVER} is already limited to this project, the attribute definitions and the law. Today is ${new Date().toISOString().slice(0, 10)}.`,
          },
        ],
        mcp_servers: [
          {type: 'url', name: DATA_SERVER, url: scopedDataUrl(projectId), authorization_token: token},
          {type: 'url', name: KB_SERVER, url: kbUrl()!, authorization_token: token},
        ],
        tools: [
          {type: 'mcp_toolset', mcp_server_name: DATA_SERVER},
          {type: 'mcp_toolset', mcp_server_name: KB_SERVER},
        ],
        messages: conversation,
      },
      {signal},
    )

    // Separate text that comes before and after tool calls into paragraphs.
    let wroteText = turn > 0
    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_start' && event.content_block.type === 'text' && wroteText) {
        emit({type: 'text', text: '\n\n'})
      }
    })
    stream.on('text', (delta) => {
      wroteText = true
      emit({type: 'text', text: delta})
    })
    stream.on('contentBlock', (block) => {
      if (block.type === 'mcp_tool_use') {
        emit({type: 'step', server: block.server_name, tool: block.name, detail: describeStep(block.name, block.input)})
      } else if (block.type === 'mcp_tool_result' && block.is_error) {
        emit({type: 'step_failed'})
      }
    })

    const message = await stream.finalMessage()

    if (message.stop_reason === 'pause_turn') {
      conversation.push({role: 'assistant', content: message.content})
      continue
    }
    if (message.stop_reason === 'refusal') {
      emit({type: 'error', message: 'The model declined to answer this. Try rephrasing your question.'})
    } else if (message.stop_reason === 'max_tokens') {
      emit({type: 'notice', message: 'The answer was cut off because it reached the length limit.'})
    }
    return
  }
  emit({type: 'notice', message: 'Stopped after too many steps. Try a narrower question.'})
}
