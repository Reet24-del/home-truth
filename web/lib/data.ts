import {createClient} from '@sanity/client'

import demoReport from '@/demo/nimbus-greens.json'

import type {Finding, ProjectListItem, ProjectReport} from './types'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

// Reads the public dataset. When no project is configured, pages fall back to
// the demo report in web/demo so the app works before Sanity is set up.
const client = projectId
  ? createClient({projectId, dataset, apiVersion: '2025-09-01', useCdn: false, perspective: 'published'})
  : null

export const isLive = client !== null

const DEMO_REPORTS = [demoReport as ProjectReport]

const PROJECTS_QUERY = /* groq */ `*[_type == "project" && defined(slug.current)] | order(name asc){
  _id, name, "slug": slug.current, city, state, registrationNumber, isDemo,
  "problems": count(*[_type == "finding" && project._ref == ^._id && status in ["mismatch", "violation"]]),
  "critical": count(*[_type == "finding" && project._ref == ^._id && status in ["mismatch", "violation"] && severity == "critical"]),
  "total": count(*[_type == "finding" && project._ref == ^._id])
}`

const REPORT_QUERY = /* groq */ `*[_type == "project" && slug.current == $slug][0]{
  _id, name, "slug": slug.current, city, state, registrationNumber, promoter, isDemo, summary,
  "sources": *[_type == "sourceDocument" && (project._ref == ^._id || kind == "law")]{
    _id, title, shortName, kind, publisher, publishedAt, url, body
  },
  "findings": *[_type == "finding" && project._ref == ^._id]{
    _id, status, severity, summary,
    "attribute": attribute->{key, label, description, buyerImpact, askFor},
    "entries": entries[]{
      role, display,
      "claim": claim->{
        _id, quote, location, note, verified, numberValue,
        "source": source->{shortName, kind, title, url}
      }
    }
  }
}`

const isProblem = (f: Finding) => f.status === 'mismatch' || f.status === 'violation'

/** The dataset couldn't be reached. Pages show an error instead of an empty report. */
export class DataUnavailableError extends Error {}

async function query<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    console.error('Sanity query failed', error)
    throw new DataUnavailableError('Could not read the dataset.')
  }
}

export async function getProjects(): Promise<ProjectListItem[]> {
  if (client) return query(() => client.fetch<ProjectListItem[]>(PROJECTS_QUERY))
  return DEMO_REPORTS.map((report) => {
    const problems = report.findings.filter(isProblem)
    return {
      _id: report._id,
      name: report.name,
      slug: report.slug,
      city: report.city,
      state: report.state,
      registrationNumber: report.registrationNumber,
      isDemo: report.isDemo,
      problems: problems.length,
      critical: problems.filter((f) => f.severity === 'critical').length,
      total: report.findings.length,
    }
  })
}

export async function getReport(slug: string): Promise<ProjectReport | null> {
  if (client) return query(() => client.fetch<ProjectReport | null>(REPORT_QUERY, {slug}))
  return DEMO_REPORTS.find((report) => report.slug === slug) ?? null
}

const SEVERITY_RANK = {critical: 0, major: 1, minor: 2}
const STATUS_RANK = {violation: 0, mismatch: 1, single_source: 2, match: 3}

/** Problems first, most severe first. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      Number(isProblem(b)) - Number(isProblem(a)) ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status],
  )
}

export {isProblem}
