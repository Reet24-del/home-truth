// Loads the fictional demo project into your dataset and computes its findings.
// Run with: npm run seed   (uses your `sanity login` session)

import {getCliClient} from 'sanity/cli'

import {loadDemo} from '../lib/demo'
import {recomputeFindings} from '../lib/findingsWriter'
import {ref} from '../lib/ids'

const client = getCliClient({apiVersion: '2025-09-01'})
const demo = loadDemo()
const {project} = demo

const tx = client.transaction()

tx.createOrReplace({
  _id: project.id,
  _type: 'project',
  name: project.name,
  slug: {_type: 'slug', current: project.slug},
  registrationNumber: project.registrationNumber,
  promoter: project.promoter,
  city: project.city,
  state: project.state,
  isDemo: project.isDemo,
  summary: project.summary,
})

for (const source of demo.sources) {
  tx.createOrReplace({
    _id: source.id,
    _type: 'sourceDocument',
    title: source.title,
    shortName: source.shortName,
    kind: source.kind,
    project: source.projectScoped ? ref(project.id) : undefined,
    publisher: source.publisher,
    publishedAt: source.publishedAt,
    url: source.url,
    body: source.body,
  })
}

for (const attr of demo.attributes) {
  tx.createOrReplace({
    _id: attr.id,
    _type: 'attribute',
    key: attr.key,
    label: attr.label,
    description: attr.description,
    valueType: attr.valueType,
    unit: attr.unit,
    tolerance: attr.tolerance,
    comparison: attr.comparison,
    severity: attr.severity,
    buyerImpact: attr.buyerImpact,
    askFor: attr.askFor,
    vocabulary: attr.vocabulary?.map((term) => ({_key: term.key, _type: 'term', ...term})),
  })
}

for (const claim of demo.claims) {
  const attr = demo.attributes.find((a) => a.key === claim.attribute)
  if (!attr) throw new Error(`Claim ${claim.id} uses unknown attribute ${claim.attribute}`)
  tx.createOrReplace({
    _id: claim.id,
    _type: 'claim',
    attribute: ref(attr.id),
    source: ref(claim.sourceId),
    project: claim.law ? undefined : ref(project.id),
    numberValue: claim.numberValue,
    dateValue: claim.dateValue,
    textValue: claim.textValue,
    listValue: claim.listValue,
    quote: claim.quote,
    location: claim.location,
    note: claim.note,
    // Project quotes are checked against the demo documents by `npm test`; the
    // two law quotes were checked against the official text of the Act.
    verified: true,
    extractedBy: 'seed',
  })
}

await tx.commit()
console.log(
  `Seeded ${project.name}: ${demo.sources.length} sources, ${demo.attributes.length} attributes, ${demo.claims.length} claims.`,
)

await recomputeFindings(client)
