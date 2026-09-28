import {sortFindings} from './data'
import type {Finding, Severity} from './types'

export interface ChecklistItem {
  id: string
  label: string
  detail: string
  askFor: string | null
  severity: Severity
  kind: 'problem' | 'unconfirmed'
}

/**
 * The questions a buyer should take to the builder, derived from the findings:
 * every problem, then facts only marketing states. Same input, same list.
 */
export function buildChecklist(findings: Finding[]): ChecklistItem[] {
  return sortFindings(findings)
    .filter(
      (finding) =>
        finding.status === 'violation' ||
        finding.status === 'mismatch' ||
        (finding.status === 'single_source' && finding.severity !== 'minor'),
    )
    .map((finding) => ({
      id: finding._id,
      label: finding.attribute?.label ?? 'This fact',
      detail: finding.summary,
      askFor: finding.attribute?.askFor ?? null,
      severity: finding.severity,
      kind: finding.status === 'single_source' ? 'unconfirmed' : 'problem',
    }))
}
