import type {Finding, ProjectReport} from './types'

/** Numbers the landing page shows, read from the findings rather than hardcoded. */

export interface Comparison {
  key: string
  label: string
  claimed: {value: number; display: string; source: string}
  registered: {value: number; display: string; source: string}
}

const HERO_FALLBACK = {advertised: 18, registered: 12}

function byKey(report: ProjectReport | null, key: string): Finding | undefined {
  return report?.findings?.find((finding) => finding.attribute?.key === key)
}

function pair(finding: Finding | undefined): Comparison | null {
  if (!finding?.attribute) return null
  const entries = finding.entries ?? []
  const reference = entries.find((entry) => entry.role === 'reference' || entry.role === 'limit')
  const claimed = entries.find((entry) => entry.role === 'conflicts' || entry.role === 'violates')
  if (!reference?.claim || !claimed?.claim) return null
  if (typeof reference.claim.numberValue !== 'number' || typeof claimed.claim.numberValue !== 'number') return null
  return {
    key: finding.attribute.key,
    label: finding.attribute.label,
    claimed: {
      value: claimed.claim.numberValue,
      display: claimed.display,
      source: claimed.claim.source?.shortName ?? 'Marketing',
    },
    registered: {
      value: reference.claim.numberValue,
      display: reference.display,
      source: reference.claim.source?.shortName ?? 'Registered record',
    },
  }
}

export function towerFloors(report: ProjectReport | null): {advertised: number; registered: number} {
  const comparison = pair(byKey(report, 'floors_per_tower'))
  if (!comparison) return HERO_FALLBACK
  const advertised = Math.round(Math.max(comparison.claimed.value, comparison.registered.value))
  const registered = Math.round(Math.min(comparison.claimed.value, comparison.registered.value))
  // Keep the model sane if the data is odd.
  if (advertised < 1 || advertised > 60 || registered < 1) return HERO_FALLBACK
  return {advertised, registered}
}

export function gapComparisons(report: ProjectReport | null): Comparison[] {
  return ['floors_per_tower', 'area_2bhk_sqft', 'price_2bhk_total_inr']
    .map((key) => pair(byKey(report, key)))
    .filter((comparison): comparison is Comparison => comparison !== null)
}

/** Floors advertised vs sanctioned, for the tower inside a finding card. */
export function floorsFromFinding(finding: Finding): {advertised: number; registered: number} | null {
  if (finding.attribute?.key !== 'floors_per_tower') return null
  const comparison = pair(finding)
  if (!comparison) return null
  const advertised = Math.round(Math.max(comparison.claimed.value, comparison.registered.value))
  const registered = Math.round(Math.min(comparison.claimed.value, comparison.registered.value))
  if (advertised < 1 || advertised > 60 || registered < 1 || advertised === registered) return null
  return {advertised, registered}
}

export interface EvidenceSide {
  quote: string
  source: string
  location: string | null
  display: string
}

export interface Evidence {
  label: string
  claimed: EvidenceSide
  official: EvidenceSide
  note: string | null
}

const SEVERITY_ORDER = {critical: 0, major: 1, minor: 2}

function sides(finding: Finding): {claimed: EvidenceSide; official: EvidenceSide} | null {
  const entries = finding.entries ?? []
  const official = entries.find((entry) => entry.role === 'reference' || entry.role === 'limit')
  const claimed = entries.find((entry) => entry.role === 'conflicts' || entry.role === 'violates')
  if (!official?.claim || !claimed?.claim) return null
  const side = (entry: typeof official): EvidenceSide => ({
    quote: entry!.claim!.quote,
    source: entry!.claim!.source?.shortName ?? 'Unknown source',
    location: entry!.claim!.location ?? null,
    display: entry!.display,
  })
  return {claimed: side(claimed), official: side(official)}
}

/** The single strongest contradiction, quoted from both documents. */
export function headlineEvidence(report: ProjectReport | null): Evidence | null {
  const problems = (report?.findings ?? [])
    .filter((finding) => finding.status === 'mismatch' || finding.status === 'violation')
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  for (const finding of problems) {
    const pairSides = sides(finding)
    if (pairSides && finding.attribute) {
      return {
        label: finding.attribute.label,
        note: finding.attribute.buyerImpact ?? null,
        ...pairSides,
      }
    }
  }
  return null
}

export interface LedgerRow {
  key: string
  label: string
  severity: Finding['severity']
  status: Finding['status']
  claimed: {display: string; source: string}
  official: {display: string; source: string}
}

/** Every contradiction as one line of a ledger: claimed, recorded, and by whom. */
export function ledgerRows(report: ProjectReport | null): LedgerRow[] {
  return (report?.findings ?? [])
    .filter((finding) => finding.status === 'mismatch' || finding.status === 'violation')
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .flatMap((finding) => {
      const pairSides = sides(finding)
      if (!pairSides || !finding.attribute) return []
      return [
        {
          key: finding.attribute.key,
          label: finding.attribute.label,
          severity: finding.severity,
          status: finding.status,
          claimed: {display: pairSides.claimed.display, source: pairSides.claimed.source},
          official: {display: pairSides.official.display, source: pairSides.official.source},
        },
      ]
    })
}
