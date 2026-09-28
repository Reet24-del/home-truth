import {Tower} from '@/components/Tower'
import {isProblem} from '@/lib/data'
import {floorsFromFinding} from '@/lib/highlights'
import type {EntryRole, Finding, FindingStatus, Severity} from '@/lib/types'

const STATUS_LABEL: Record<FindingStatus, string> = {
  violation: 'Against the law',
  mismatch: "Doesn't match",
  single_source: 'Only one source',
  match: 'Matches',
}

const SEVERITY_LABEL: Record<Severity, string> = {critical: 'Critical', major: 'Major', minor: 'Minor'}

const ROLE: Record<EntryRole, {label: string; tone: 'good' | 'bad' | 'neutral'}> = {
  reference: {label: 'most trusted', tone: 'neutral'},
  agrees: {label: '✓ agrees', tone: 'good'},
  conflicts: {label: "✗ doesn't match", tone: 'bad'},
  limit: {label: 'legal limit', tone: 'neutral'},
  violates: {label: '✗ against the law', tone: 'bad'},
  complies: {label: '✓ within the law', tone: 'good'},
}

export function FindingCard({finding}: {finding: Finding}) {
  const problem = isProblem(finding)
  const entries = finding.entries ?? []
  const floors = floorsFromFinding(finding)

  return (
    <article
      className={`finding status-${finding.status} ${finding.severity} ${problem ? 'problem' : ''}`}
      id={finding.attribute?.key}
    >
      <header>
        <h3>{finding.attribute?.label ?? 'Unknown fact'}</h3>
        <div className="badges">
          {problem && <span className={`badge ${finding.severity}`}>{SEVERITY_LABEL[finding.severity]}</span>}
          <span className={`badge ${problem ? finding.severity : finding.status === 'match' ? 'ok' : 'neutral'}`}>
            {STATUS_LABEL[finding.status]}
          </span>
        </div>
      </header>

      <p className="summary">{finding.summary}</p>

      {floors && (
        <div className="finding-visual no-print">
          <Tower advertised={floors.advertised} registered={floors.registered} compact />
          <p className="finding-visual-note">
            Solid floors are in the sanctioned plan. The {floors.advertised - floors.registered} above the line are
            advertised only.
          </p>
        </div>
      )}

      <ul className="entries">
        {entries.map((entry, index) => (
          <li key={index} className={`entry ${ROLE[entry.role].tone}`}>
            <span className="source">{entry.claim?.source?.shortName ?? 'Unknown source'}</span>
            <span className="value">{entry.display}</span>
            <span className="role">{ROLE[entry.role].label}</span>
          </li>
        ))}
      </ul>

      {problem && finding.attribute?.buyerImpact && (
        <p className="impact">
          <strong>Why it matters:</strong> {finding.attribute.buyerImpact}
        </p>
      )}

      <details className="quotes">
        <summary>Show the exact words</summary>
        <ul>
          {entries.map((entry, index) =>
            entry.claim ? (
              <li key={index}>
                <blockquote>“{entry.claim.quote}”</blockquote>
                <cite>
                  {entry.claim.source?.title}
                  {entry.claim.location && `, ${entry.claim.location}`}
                  {!entry.claim.verified && ' · not yet checked by a person'}
                </cite>
                {entry.claim.note && <cite>Note: {entry.claim.note}</cite>}
              </li>
            ) : null,
          )}
        </ul>
      </details>
    </article>
  )
}
