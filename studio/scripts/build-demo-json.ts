// Writes the demo report to web/demo so the web app can show it before
// Sanity is connected. The shape matches the web app's report query.
// Run with: npm run demo:json

import fs from 'node:fs'
import path from 'node:path'

import {computeFindings} from '../lib/compare'
import {loadDemo, toClaimRecord} from '../lib/demo'
import {ids} from '../lib/ids'

const demo = loadDemo()
const {project} = demo
const results = computeFindings(
  demo.attributes,
  demo.claims.map((claim) => toClaimRecord(claim, demo.sources)),
)

const report = {
  _id: project.id,
  name: project.name,
  slug: project.slug,
  city: project.city,
  state: project.state,
  registrationNumber: project.registrationNumber,
  promoter: project.promoter,
  isDemo: project.isDemo,
  summary: project.summary,
  sources: demo.sources.map((source) => ({
    _id: source.id,
    title: source.title,
    shortName: source.shortName,
    kind: source.kind,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    url: source.url ?? null,
    body: source.body ?? null,
  })),
  findings: results.map((result) => {
    const attr = demo.attributes.find((a) => a.key === result.attributeKey)!
    return {
      _id: ids.finding(project.slug, result.attributeKey),
      status: result.status,
      severity: result.severity,
      summary: result.summary,
      attribute: {
        key: attr.key,
        label: attr.label,
        description: attr.description,
        buyerImpact: attr.buyerImpact,
        askFor: attr.askFor,
      },
      entries: result.entries.map((entry) => {
        const claim = demo.claims.find((c) => c.id === entry.claimId)!
        const source = demo.sources.find((s) => s.id === claim.sourceId)!
        return {
          role: entry.role,
          display: entry.display,
          claim: {
            _id: claim.id,
            quote: claim.quote,
            location: claim.location,
            note: claim.note ?? null,
            verified: true,
            numberValue: claim.numberValue ?? null,
            source: {
              shortName: source.shortName,
              kind: source.kind,
              title: source.title,
              url: source.url ?? null,
            },
          },
        }
      }),
    }
  }),
}

const out = path.resolve(process.cwd(), '../web/demo', `${project.slug}.json`)
fs.mkdirSync(path.dirname(out), {recursive: true})
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
console.log(`Wrote ${path.relative(process.cwd(), out)} (${report.findings.length} findings)`)
