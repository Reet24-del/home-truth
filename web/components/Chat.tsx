'use client'

import {useEffect, useRef, useState} from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type {AgentEvent, ChatMessage} from '@/lib/types'

interface Step {
  server: string
  tool: string
  detail: string
  failed?: boolean
}

interface Turn {
  role: 'user' | 'assistant'
  content: string
  steps: Step[]
  notice?: string
  error?: string
}

const SERVER_LABEL: Record<string, string> = {
  'sanity-data': 'Registered record',
  'sanity-kb': 'Knowledge Base',
}

const TOOL_LABEL: Record<string, string> = {
  groq_query: 'queried',
  schema_explorer: 'looked up the schema',
  array_field_reader: 'read a long field',
  initial_context: 'opened the outline',
  knowledge_base_read: 'read entries',
}

const SUGGESTIONS = [
  'The broker is offering me flat B-1502. Is that okay?',
  'The broker says: "Possession in 18 months, 1,050 sq ft 2 BHK, free parking, just pay 20% to book." Check it.',
  'Which clauses in the draft agreement give me less than the law does?',
  'What should I ask the builder before I pay anything?',
]

interface ChatProps {
  projectId: string
  projectLabel: string
  disabledReason: string | null
}

export function Chat({projectId, projectLabel, disabledReason}: ChatProps) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({top: logRef.current.scrollHeight})
  }, [turns])

  const updateLast = (change: (turn: Turn) => Turn) =>
    setTurns((prev) => [...prev.slice(0, -1), change(prev[prev.length - 1])])

  function handleEvent(event: AgentEvent) {
    switch (event.type) {
      case 'text':
        updateLast((t) => ({...t, content: t.content + event.text}))
        break
      case 'step':
        updateLast((t) => ({...t, steps: [...t.steps, {server: event.server, tool: event.tool, detail: event.detail}]}))
        break
      case 'step_failed':
        updateLast((t) => ({
          ...t,
          steps: t.steps.map((step, i) => (i === t.steps.length - 1 ? {...step, failed: true} : step)),
        }))
        break
      case 'notice':
        updateLast((t) => ({...t, notice: event.message}))
        break
      case 'error':
        updateLast((t) => ({...t, error: event.message}))
        break
    }
  }

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) return
    const history: ChatMessage[] = [
      ...turns
        .filter((t) => t.content.trim())
        .map((t) => ({role: t.role, content: t.content})),
      {role: 'user', content: question},
    ]
    setTurns((prev) => [
      ...prev,
      {role: 'user', content: question, steps: []},
      {role: 'assistant', content: '', steps: []},
    ])
    setInput('')
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({projectId, projectLabel, messages: history}),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null)
        handleEvent({type: 'error', message: body?.error ?? `Request failed (${response.status}).`})
        return
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const {value, done} = await reader.read()
        if (done) break
        buffer += value
        let newline: number
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (line) handleEvent(JSON.parse(line) as AgentEvent)
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        handleEvent({type: 'error', message: error instanceof Error ? error.message : 'Connection lost.'})
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  return (
    <aside className="chat-panel" aria-label="Ask Home Truth">
      <div className="chat-head">
        <h2>Ask Home Truth</h2>
        <p>Checks your question against the registered record and the law.</p>
      </div>

      {disabledReason ? (
        <p className="chat-off">{disabledReason} See the README to connect Sanity Context.</p>
      ) : (
        <>
          <div className="chat-log" ref={logRef} aria-live="polite">
            {turns.length === 0 && (
              <div className="suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => send(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <div key={index} className="msg user">
                  {turn.content}
                </div>
              ) : (
                <div key={index} className="msg assistant">
                  {turn.steps.length > 0 && (
                    <details className="trace">
                      <summary>
                        How I checked ({turn.steps.length} step{turn.steps.length === 1 ? '' : 's'})
                      </summary>
                      <ol>
                        {turn.steps.map((step, i) => (
                          <li key={i}>
                            {SERVER_LABEL[step.server] ?? step.server}: {TOOL_LABEL[step.tool] ?? step.tool}
                            {step.failed && ' (failed)'}
                            {step.detail && <code>{step.detail}</code>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {turn.content ? (
                    <Markdown remarkPlugins={[remarkGfm]}>{turn.content}</Markdown>
                  ) : (
                    busy &&
                    index === turns.length - 1 &&
                    !turn.error && <p className="working">Checking the documents…</p>
                  )}
                  {turn.notice && <p className="notice">{turn.notice}</p>}
                  {turn.error && <p className="error">{turn.error}</p>}
                </div>
              ),
            )}
          </div>

          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault()
              send(input)
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send(input)
                }
              }}
              placeholder="Ask a question or paste an ad…"
              rows={2}
              aria-label="Your question"
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()}>
                Stop
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()}>
                Ask
              </button>
            )}
          </form>
        </>
      )}
    </aside>
  )
}
