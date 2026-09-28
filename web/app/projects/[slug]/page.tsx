import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'

import {Chat} from '@/components/Chat'
import {FindingCard} from '@/components/FindingCard'
import {agentConfigError} from '@/lib/agent'
import {DataUnavailableError, getReport, isLive, isProblem, sortFindings} from '@/lib/data'

export const dynamic = 'force-dynamic'

type Params = Promise<{slug: string}>

const KIND_LABEL: Record<string, string> = {
  registration: 'Registration',
  agreement: 'Agreement',
  marketing: 'Marketing',
  law: 'Law',
  other: 'Other',
}

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  try {
    const report = await getReport((await params).slug)
    return {title: report ? `${report.name} · Home Truth` : 'Home Truth'}
  } catch {
    return {title: 'Home Truth'}
  }
}

export default async function ProjectPage({params}: {params: Params}) {
  let report
  try {
    report = await getReport((await params).slug)
  } catch (error) {
    if (!(error instanceof DataUnavailableError)) throw error
    return (
      <main className="container">
        <p className="banner">
          Couldn&apos;t load this project right now. The report is missing, not clean: try again in a moment.
        </p>
      </main>
    )
  }
  if (!report) notFound()

  const findings = sortFindings(report.findings ?? [])
  const problems = findings.filter(isProblem)
  const critical = problems.filter((f) => f.severity === 'critical')
  const matches = findings.filter((f) => f.status === 'match')
  const chatDisabled = isLive
    ? agentConfigError()
    : 'Chat is off while the app shows built-in demo data.'
  const projectLabel = `${report.name}${report.registrationNumber ? `, RERA ${report.registrationNumber}` : ''}`

  return (
    <main className="container">
      <section className="project-hero">
        <div className="badges">
          {report.isDemo && <span className="badge neutral">Fictional demo project</span>}
          {!isLive && <span className="badge major">Offline demo data</span>}
        </div>
        <h1>{report.name}</h1>
        <p className="meta">
          {report.registrationNumber && `RERA ${report.registrationNumber} · `}
          {report.promoter && `${report.promoter} · `}
          {[report.city, report.state].filter(Boolean).join(', ')}
        </p>
        {report.summary && <p className="summary">{report.summary}</p>}

        <div className="scoreboard">
          <div className="score critical">
            <strong>{critical.length}</strong>
            <span>critical problems</span>
          </div>
          <div className="score">
            <strong>{problems.length}</strong>
            <span>facts that don&apos;t hold up</span>
          </div>
          <div className="score ok">
            <strong>{matches.length}</strong>
            <span>facts that match</span>
          </div>
          <div className="score">
            <strong>{report.sources.length}</strong>
            <span>documents checked</span>
          </div>
        </div>

        {findings.length > 0 && (
          <p className="cta">
            <Link className="button" href={`/projects/${report.slug}/checklist`}>
              Questions to ask the builder →
            </Link>
          </p>
        )}
      </section>

      <div className="report-grid">
        <section className="findings" aria-label="Findings">
          {findings.length === 0 ? (
            <p className="empty">
              Nothing has been compared for this project yet. Add claims in the Studio, then run{' '}
              <code>npm run findings</code>. An empty report doesn&apos;t mean the project is clean.
            </p>
          ) : (
            findings.map((finding) => <FindingCard key={finding._id} finding={finding} />)
          )}
        </section>
        <Chat projectId={report._id} projectLabel={projectLabel} disabledReason={chatDisabled} />
      </div>

      <h2 className="section-title">Documents checked</h2>
      <ul className="sources-list">
        {report.sources.map((source) => (
          <li key={source._id}>
            <span>
              {source.url ? <a href={source.url}>{source.title}</a> : source.title}
              {source.publisher && <span className="kind"> · {source.publisher}</span>}
            </span>
            <span className="kind">
              {KIND_LABEL[source.kind] ?? source.kind}
              {source.publishedAt && ` · ${source.publishedAt}`}
            </span>
          </li>
        ))}
      </ul>

      <p className="disclaimer">
        Home Truth explains what documents and the law say. It isn&apos;t legal or financial advice. Always check the
        project on your state&apos;s official RERA portal, and have a property lawyer review the agreement before a
        large payment.
      </p>
    </main>
  )
}
