import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'

import {PrintButton} from '@/components/PrintButton'
import {buildChecklist} from '@/lib/checklist'
import {DataUnavailableError, getReport} from '@/lib/data'

export const dynamic = 'force-dynamic'

type Params = Promise<{slug: string}>

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const {slug} = await params
  try {
    const report = await getReport(slug)
    return {title: report ? `Questions to ask: ${report.name}` : 'Home Truth'}
  } catch {
    return {title: 'Home Truth'}
  }
}

export default async function ChecklistPage({params}: {params: Params}) {
  const {slug} = await params

  let report
  try {
    report = await getReport(slug)
  } catch (error) {
    if (!(error instanceof DataUnavailableError)) throw error
    return (
      <main className="container">
        <p className="banner">Couldn&apos;t load this project right now. Try again in a moment.</p>
      </main>
    )
  }
  if (!report) notFound()

  const items = buildChecklist(report.findings ?? [])
  const today = new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'long', year: 'numeric'})

  return (
    <main className="container checklist-page">
      <p className="no-print">
        <Link href={`/projects/${report.slug}`}>← Back to the report</Link>
      </p>

      <header className="checklist-head">
        <h1>Questions to ask the builder</h1>
        <p className="meta">
          {report.name}
          {report.registrationNumber && ` · RERA ${report.registrationNumber}`}
          {report.promoter && ` · ${report.promoter}`}
        </p>
        <p className="meta">
          Prepared {today} from {report.sources.length} documents.
        </p>
        <PrintButton />
      </header>

      {items.length === 0 ? (
        <p>Nothing to ask about yet: every fact checked so far matches the registered record.</p>
      ) : (
        <ol className="checklist">
          {items.map((item) => (
            <li key={item.id} className={`checklist-item ${item.severity}`}>
              <div className="tick" aria-hidden="true" />
              <div>
                <h2>
                  {item.label}
                  {item.kind === 'unconfirmed' && <span className="badge neutral">not confirmed</span>}
                </h2>
                <p className="detail">{item.detail}</p>
                {item.askFor && (
                  <p className="ask">
                    <strong>Ask for:</strong> {item.askFor}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <section className="checklist-foot">
        <h2>Before you pay anything</h2>
        <ul>
          <li>Get every answer in writing, not on a phone call.</li>
          <li>Check the project yourself on your state&apos;s official RERA portal.</li>
          <li>Have a property lawyer read the agreement for sale before you sign or pay a large amount.</li>
        </ul>
        <p className="meta">
          Prepared by Home Truth from: {report.sources.map((source) => source.title).join('; ')}. This is not legal
          advice.
        </p>
      </section>
    </main>
  )
}
