export type SourceKind = 'registration' | 'agreement' | 'marketing' | 'law' | 'other'
export type FindingStatus = 'match' | 'mismatch' | 'violation' | 'single_source'
export type Severity = 'critical' | 'major' | 'minor'
export type EntryRole = 'reference' | 'agrees' | 'conflicts' | 'limit' | 'violates' | 'complies'

export interface SourceSummary {
  _id: string
  title: string
  shortName: string
  kind: SourceKind
  publisher: string | null
  publishedAt: string | null
  url: string | null
  body: string | null
}

export interface FindingEntry {
  role: EntryRole
  display: string
  claim: {
    _id: string
    quote: string
    location: string | null
    note: string | null
    verified: boolean | null
    numberValue: number | null
    source: {shortName: string; kind: SourceKind; title: string; url: string | null} | null
  } | null
}

export interface Finding {
  _id: string
  status: FindingStatus
  severity: Severity
  summary: string
  attribute: {
    key: string
    label: string
    description: string | null
    buyerImpact: string | null
    askFor: string | null
  } | null
  entries: FindingEntry[] | null
}

export interface ProjectReport {
  _id: string
  name: string
  slug: string
  city: string | null
  state: string | null
  registrationNumber: string | null
  promoter: string | null
  isDemo: boolean | null
  summary: string | null
  sources: SourceSummary[]
  findings: Finding[]
}

export interface ProjectListItem {
  _id: string
  name: string
  slug: string
  city: string | null
  state: string | null
  registrationNumber: string | null
  isDemo: boolean | null
  problems: number
  critical: number
  total: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Streamed from /api/chat as one JSON object per line. */
export type AgentEvent =
  | {type: 'text'; text: string}
  | {type: 'step'; server: string; tool: string; detail: string}
  | {type: 'step_failed'}
  | {type: 'notice'; message: string}
  | {type: 'error'; message: string}
  | {type: 'done'}
