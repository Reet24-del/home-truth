import Link from 'next/link'

import {Brochure} from '@/components/Brochure'
import {Tower} from '@/components/Tower'
import {DataUnavailableError, getProjects, getReport, isLive, isProblem} from '@/lib/data'
import {headlineEvidence, ledgerRows, towerFloors} from '@/lib/highlights'
import type {ProjectReport} from '@/lib/types'

export const dynamic = 'force-dynamic'

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]
const numberWord = (value: number) => NUMBER_WORDS[value] ?? String(value)

export default async function Home() {
  let projects
  let featured: ProjectReport | null = null
  try {
    projects = await getProjects()
    if (projects.length > 0) featured = await getReport(projects[0].slug)
  } catch (error) {
    if (!(error instanceof DataUnavailableError)) throw error
    return (
      <main className="container">
        <p className="banner">Couldn&apos;t load the projects right now. Try again in a moment.</p>
      </main>
    )
  }

  const {advertised, registered} = towerFloors(featured)
  const evidence = headlineEvidence(featured)
  const ledger = ledgerRows(featured)
  const marketing = featured?.sources?.find((source) => source.kind === 'marketing' && source.body)
  const problems = (featured?.findings ?? []).filter(isProblem)

  return (
    <main>
      <section className="cinema">
        <div className="cinema-scene">
          <Tower advertised={advertised} registered={registered} cinematic />
        </div>
        <div className="cinema-window" aria-hidden="true" />
        <div className="cinema-vignette" aria-hidden="true" />

        {/* The redline over the building stops where this headline starts. */}
        <h1 className="cinema-title" data-markup-floor>
          <span className="line one">
            <span>{numberWord(advertised - registered)} floors</span>
            <span>nobody</span>
          </span>
          <span className="line two">
            <span>approved</span>
          </span>
        </h1>

        <div className="cinema-foot">
          <div>
            <p className="cinema-file">
              File 01 · {featured?.name ?? 'Nimbus Greens'}
              {featured?.registrationNumber ? ` · RERA ${featured.registrationNumber}` : ''}
            </p>
            <p className="cinema-lede">
              The brochure sells {advertised} storeys. The sanctioned plan allows {registered}. We read both, and quote
              every gap word for word.
            </p>
            {featured && (
              <p className="cinema-links">
                <Link className="link-cta" href={`/projects/${featured.slug}`}>
                  Read the whole file
                </Link>
                <a className="link-quiet" href="#ledger">
                  {problems.length} findings below
                </a>
              </p>
            )}
          </div>
        </div>
      </section>

      {evidence && (
        <section className="evidence">
          <div className="container evidence-grid">
            {marketing?.body ? (
              <Brochure
                markdown={marketing.body}
                highlight={evidence.claimed.quote}
                stampText="Not in the sanctioned plan"
                label={`${marketing.shortName}${marketing.publishedAt ? ` · ${marketing.publishedAt}` : ''} — drag to turn, tap a page, scroll to zoom`}
              />
            ) : (
              <article className="scan">
                <p className="doc-meta">{evidence.claimed.source}</p>
                <blockquote>
                  <mark>{evidence.claimed.quote}</mark>
                </blockquote>
                <p className="doc-value">{evidence.claimed.display}</p>
                <span className="stamp">Not in the sanctioned plan</span>
              </article>
            )}

            <article className="record">
              <p className="doc-meta">
                {evidence.official.source}
                {evidence.official.location ? ` · ${evidence.official.location}` : ''}
              </p>
              <blockquote>{evidence.official.quote}</blockquote>
              <p className="doc-value">{evidence.official.display}</p>
              {evidence.note && <p className="doc-note">{evidence.note}</p>}
              <p className="record-foot">
                The highlighted line in the brochure is {evidence.label.toLowerCase()}. This is the filed record for
                the same fact.
              </p>
            </article>
          </div>
        </section>
      )}

      {ledger.length > 0 && (
        <section className="container section" id="ledger">
          <h2 className="rule-title">Everything else that doesn&apos;t hold up</h2>
          <p className="section-lede">
            One slip per contradiction: what the sale pitch says, and what the filed record says underneath it.
          </p>
          <ul className="slips">
            {ledger.map((row) => (
              <li key={row.key} className={`slip ${row.severity}`}>
                <h3>
                  {row.label}
                  {row.status === 'violation' && <span className="flag">against the law</span>}
                </h3>
                <p className="slip-side said">
                  <span className="who">{row.claimed.source}</span>
                  <span className="value">{row.claimed.display}</span>
                </p>
                <p className="slip-side recorded">
                  <span className="who">{row.official.source}</span>
                  <span className="value">{row.official.display}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="container section sequence-section">
        <p className="kicker">How the check works</p>
        <ol className="sequence">
          <li>
            <span className="num" aria-hidden="true">01</span>
            <h3>Claims</h3>
            <p>
              Every document is broken into facts, and each one keeps the exact words it came from. Nothing here is a
              paraphrase.
            </p>
          </li>
          <li>
            <span className="num" aria-hidden="true">02</span>
            <h3>Ranking</h3>
            <p>
              The Act outranks the registration, the registration outranks the agreement, the agreement outranks the
              brochure. Code compares, so the same documents always give the same answer.
            </p>
          </li>
          <li>
            <span className="num" aria-hidden="true">03</span>
            <h3>Answers</h3>
            <p>
              Paste a broker&apos;s message and every claim in it is checked against the record, quoted, and turned into
              a question to ask before you pay.
            </p>
          </li>
        </ol>
      </section>

      <section className="container section files" id="projects">
        <p className="kicker">Files</p>
        {projects.length === 0 ? (
          <p className="empty">
            No projects yet. Add one in the Studio, then run <code>npm run seed</code>.
          </p>
        ) : (
          <ul className="folders">
            {projects.map((project, index) => {
              const share = project.total ? Math.round((project.problems / project.total) * 100) : 0
              return (
                <li key={project._id}>
                  <Link href={`/projects/${project.slug}`} className="folder">
                    <span className="folder-tab">
                      File {String(index + 1).padStart(2, '0')}
                      {project.isDemo ? ' · fictional' : ''}
                    </span>
                    <span className="folder-name">{project.name}</span>
                    <span className="folder-meta">
                      {[project.city, project.state].filter(Boolean).join(', ')}
                      {project.registrationNumber && ` · RERA ${project.registrationNumber}`}
                    </span>
                    <span className="folder-score">
                      <span className="folder-bar" aria-hidden="true">
                        <span style={{width: `${share}%`}} />
                      </span>
                      <span>
                        <strong>{project.problems}</strong> of {project.total} facts don&apos;t hold up
                        {project.critical > 0 && ` · ${project.critical} critical`}
                      </span>
                    </span>
                    <span className="folder-cta">Open the file</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {!isLive && <p className="demo-note">Demo data. Connect a Sanity dataset to open your own files.</p>}
      </section>

      <footer className="site-footer">
        <div className="container">
          <p>
            Home Truth explains what documents and the law say. It isn&apos;t legal or financial advice. Always check a
            project on your state&apos;s official RERA portal.
          </p>
        </div>
      </footer>
    </main>
  )
}
