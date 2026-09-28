// Deterministic comparison of claims. No model is involved here: given the
// same claims, this always produces the same findings, so the report a buyer
// sees can be traced back to exact quotes.

export type ValueType = 'number' | 'money' | 'date' | 'list' | 'text'
export type Comparison = 'equal' | 'at_most' | 'at_least'
export type SourceKind = 'registration' | 'agreement' | 'marketing' | 'law' | 'other'
export type Severity = 'critical' | 'major' | 'minor'
export type FindingStatus = 'match' | 'mismatch' | 'violation' | 'single_source'
export type EntryRole = 'reference' | 'agrees' | 'conflicts' | 'limit' | 'violates' | 'complies'

export interface Term {
  key: string
  label: string
}

export interface AttributeDef {
  key: string
  label: string
  valueType: ValueType
  unit?: string | null
  tolerance?: number | null
  comparison?: Comparison | null
  severity?: Severity | null
  vocabulary?: Term[] | null
}

export interface ClaimRecord {
  id: string
  attributeKey: string
  source: {id: string; shortName: string; kind: SourceKind}
  numberValue?: number | null
  dateValue?: string | null
  textValue?: string | null
  listValue?: string[] | null
}

export interface FindingEntry {
  claimId: string
  role: EntryRole
  display: string
}

export interface FindingResult {
  attributeKey: string
  status: FindingStatus
  severity: Severity
  summary: string
  entries: FindingEntry[]
}

// How far each kind of document is trusted when sources disagree.
export const AUTHORITY: Record<SourceKind, number> = {
  law: 4,
  registration: 3,
  agreement: 2,
  other: 1,
  marketing: 0,
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const byAuthority = (a: ClaimRecord, b: ClaimRecord) =>
  AUTHORITY[b.source.kind] - AUTHORITY[a.source.kind]

const endSentence = (text: string) => (text.endsWith('.') ? text : `${text}.`)

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function termLabel(attr: AttributeDef, key: string): string {
  return attr.vocabulary?.find((term) => term.key === key)?.label ?? key
}

function formatInr(value: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
  return value === 0 ? `${formatted} (free)` : formatted
}

function formatNumber(value: number, unit?: string | null): string {
  const num = value.toLocaleString('en-IN', {maximumFractionDigits: 2})
  if (!unit) return num
  if (unit === '%') return `${num}%`
  const singular = value === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit
  return `${num} ${singular}`
}

interface ParsedDate {
  year: number
  month: number
  day?: number
}

function parseDate(value: string): ParsedDate {
  const [year, month, day] = value.split('-').map(Number)
  return {year, month, day}
}

function formatDate(value: string): string {
  const {year, month, day} = parseDate(value)
  const monthName = MONTHS[month - 1]
  return day ? `${day} ${monthName} ${year}` : `${monthName} ${year}`
}

function monthsBetween(from: string, to: string): number {
  const a = parseDate(from)
  const b = parseDate(to)
  return (b.year - a.year) * 12 + (b.month - a.month)
}

// A month-only date ("March 2027") agrees with any day in that month.
function datesAgree(a: string, b: string): boolean {
  const x = parseDate(a)
  const y = parseDate(b)
  if (x.year !== y.year || x.month !== y.month) return false
  return x.day === undefined || y.day === undefined || x.day === y.day
}

function relativeDifference(a: number, b: number): number {
  if (a === b) return 0
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b))
}

export function hasValue(attr: AttributeDef, claim: ClaimRecord): boolean {
  switch (attr.valueType) {
    case 'number':
    case 'money':
      return typeof claim.numberValue === 'number' && Number.isFinite(claim.numberValue)
    case 'date':
      return typeof claim.dateValue === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(claim.dateValue)
    case 'text':
      return typeof claim.textValue === 'string' && claim.textValue.trim() !== ''
    case 'list':
      return Array.isArray(claim.listValue)
  }
}

export function formatValue(attr: AttributeDef, claim: ClaimRecord): string {
  switch (attr.valueType) {
    case 'money':
      return formatInr(claim.numberValue!)
    case 'number':
      return formatNumber(claim.numberValue!, attr.unit)
    case 'date':
      return formatDate(claim.dateValue!)
    case 'text':
      return termLabel(attr, claim.textValue!)
    case 'list':
      return claim.listValue!.map((key) => termLabel(attr, key)).join(', ') || 'none'
  }
}

function listDifference(from: string[], minus: string[]): string[] {
  const exclude = new Set(minus)
  return from.filter((key) => !exclude.has(key))
}

function agrees(attr: AttributeDef, reference: ClaimRecord, claim: ClaimRecord): boolean {
  switch (attr.valueType) {
    case 'number':
    case 'money':
      return (
        relativeDifference(reference.numberValue!, claim.numberValue!) <= (attr.tolerance ?? 0)
      )
    case 'date':
      return datesAgree(reference.dateValue!, claim.dateValue!)
    case 'text':
      return normalizeText(reference.textValue!) === normalizeText(claim.textValue!)
    case 'list': {
      const extras = listDifference(claim.listValue!, reference.listValue!)
      // Marketing that leaves something out isn't a problem; promising extras is.
      if (claim.source.kind === 'marketing') return extras.length === 0
      return extras.length === 0 && listDifference(reference.listValue!, claim.listValue!).length === 0
    }
  }
}

function describeConflict(attr: AttributeDef, reference: ClaimRecord, claim: ClaimRecord): string {
  const said = `The ${claim.source.shortName} says`
  const refSaid = `the ${reference.source.shortName} says`
  switch (attr.valueType) {
    case 'number':
    case 'money': {
      const base = `${said} ${formatValue(attr, claim)}; ${refSaid} ${formatValue(attr, reference)}.`
      const a = claim.numberValue!
      const b = reference.numberValue!
      // Percentages help for measured quantities (area, money), which are the
      // attributes with a tolerance; "33% more buildings" just reads oddly.
      if (attr.tolerance == null || a === 0 || b === 0) return base
      const pct = Math.round((Math.abs(a - b) / Math.abs(b)) * 100)
      return `${base} That's ${pct}% ${a > b ? 'more' : 'less'} than the ${reference.source.shortName}.`
    }
    case 'date': {
      const months = monthsBetween(claim.dateValue!, reference.dateValue!)
      const gap = months === 0 ? '' : `, ${Math.abs(months)} months ${months > 0 ? 'later' : 'earlier'}`
      return `${said} ${formatValue(attr, claim)}; ${refSaid} ${formatValue(attr, reference)}${gap}.`
    }
    case 'text':
      return `${said} "${formatValue(attr, claim)}"; ${refSaid} "${formatValue(attr, reference)}".`
    case 'list': {
      const labels = (keys: string[]) => keys.map((key) => termLabel(attr, key)).join(', ')
      const extras = listDifference(claim.listValue!, reference.listValue!)
      const missing = listDifference(reference.listValue!, claim.listValue!)
      if (claim.source.kind === 'marketing') {
        return `Advertised in the ${claim.source.shortName} but not in the ${reference.source.shortName}: ${labels(extras)}.`
      }
      const parts: string[] = []
      if (extras.length) parts.push(`The ${claim.source.shortName} lists ${labels(extras)}, which the ${reference.source.shortName} doesn't.`)
      if (missing.length) parts.push(`The ${reference.source.shortName} lists ${labels(missing)}, which the ${claim.source.shortName} doesn't.`)
      return parts.join(' ')
    }
  }
}

function compareToLimit(
  attr: AttributeDef,
  comparison: 'at_most' | 'at_least',
  limit: ClaimRecord,
  others: ClaimRecord[],
  severity: Severity,
): FindingResult {
  const limitValue = limit.numberValue!
  const limitText = formatValue(attr, limit)
  const entries: FindingEntry[] = [{claimId: limit.id, role: 'limit', display: limitText}]
  const bound = comparison === 'at_most' ? 'maximum' : 'minimum'

  if (others.length === 0) {
    return {
      attributeKey: attr.key,
      status: 'single_source',
      severity,
      summary: `The ${limit.source.shortName} sets a ${bound} of ${limitText}. No project document states this.`,
      entries,
    }
  }

  const breaks = (claim: ClaimRecord) =>
    comparison === 'at_most' ? claim.numberValue! > limitValue : claim.numberValue! < limitValue
  const violating = others.filter(breaks)
  for (const claim of others) {
    entries.push({
      claimId: claim.id,
      role: breaks(claim) ? 'violates' : 'complies',
      display: formatValue(attr, claim),
    })
  }

  if (violating.length === 0) {
    return {
      attributeKey: attr.key,
      status: 'match',
      severity,
      summary: `Within the legal ${bound} of ${limitText} (${limit.source.shortName}).`,
      entries,
    }
  }

  const summary = violating
    .map((claim) =>
      comparison === 'at_most'
        ? `The ${claim.source.shortName} says ${formatValue(attr, claim)}, but the ${limit.source.shortName} caps it at ${limitText}.`
        : `The ${claim.source.shortName} says ${formatValue(attr, claim)}, but the ${limit.source.shortName} requires at least ${limitText}.`,
    )
    .join(' ')
  return {attributeKey: attr.key, status: 'violation', severity, summary, entries}
}

function compareEqual(attr: AttributeDef, claims: ClaimRecord[], severity: Severity): FindingResult {
  const [reference, ...others] = [...claims].sort(byAuthority)
  const entries: FindingEntry[] = [
    {claimId: reference.id, role: 'reference', display: formatValue(attr, reference)},
  ]

  if (others.length === 0) {
    return {
      attributeKey: attr.key,
      status: 'single_source',
      severity,
      summary: endSentence(`Only the ${reference.source.shortName} states this: ${formatValue(attr, reference)}`),
      entries,
    }
  }

  const conflicts: ClaimRecord[] = []
  for (const claim of others) {
    const ok = agrees(attr, reference, claim)
    if (!ok) conflicts.push(claim)
    entries.push({claimId: claim.id, role: ok ? 'agrees' : 'conflicts', display: formatValue(attr, claim)})
  }

  if (conflicts.length === 0) {
    const who = claims.length === 2 ? 'Both sources agree' : `All ${claims.length} sources agree`
    return {
      attributeKey: attr.key,
      status: 'match',
      severity,
      summary: endSentence(`${who}: ${formatValue(attr, reference)}`),
      entries,
    }
  }

  return {
    attributeKey: attr.key,
    status: 'mismatch',
    severity,
    summary: conflicts.map((claim) => describeConflict(attr, reference, claim)).join(' '),
    entries,
  }
}

export function compareAttribute(attr: AttributeDef, claims: ClaimRecord[]): FindingResult | null {
  const valid = claims.filter((claim) => hasValue(attr, claim))
  if (valid.length === 0) return null

  const severity = attr.severity ?? 'major'
  const comparison = attr.comparison ?? 'equal'
  const numeric = attr.valueType === 'number' || attr.valueType === 'money'

  if (comparison !== 'equal' && numeric) {
    const [limit] = valid.filter((claim) => claim.source.kind === 'law')
    if (limit) {
      const others = valid.filter((claim) => claim.source.kind !== 'law')
      return compareToLimit(attr, comparison, limit, others, severity)
    }
  }
  return compareEqual(attr, valid, severity)
}

export function computeFindings(attributes: AttributeDef[], claims: ClaimRecord[]): FindingResult[] {
  const byAttribute = new Map<string, ClaimRecord[]>()
  for (const claim of claims) {
    const list = byAttribute.get(claim.attributeKey) ?? []
    list.push(claim)
    byAttribute.set(claim.attributeKey, list)
  }
  return attributes.flatMap((attr) => {
    const result = compareAttribute(attr, byAttribute.get(attr.key) ?? [])
    return result ? [result] : []
  })
}
