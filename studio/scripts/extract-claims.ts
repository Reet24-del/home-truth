// Reads source documents with Claude and turns them into claims.
//
//   npm run extract -- --project nimbus-greens        every document in a project
//   npm run extract -- --source source-my-brochure    one document
//   add --dry-run to print claims without saving, --overwrite to replace verified claims
//
// Every quote is checked word for word against the document before it is
// saved, and new claims are saved as unverified so a person reviews them in
// the Studio ("Claims to verify").

import {parseArgs} from 'node:util'

import Anthropic from '@anthropic-ai/sdk'
import {betaZodOutputFormat} from '@anthropic-ai/sdk/helpers/beta/zod'
import {getCliClient} from 'sanity/cli'
import {z} from 'zod'

import {hasValue, type AttributeDef, type ClaimRecord, type Term} from '../lib/compare'
import {recomputeFindings} from '../lib/findingsWriter'
import {ids, ref} from '../lib/ids'
import {quoteAppearsIn} from '../lib/quotes'

const {values: args} = parseArgs({
  args: process.argv.slice(2),
  options: {
    project: {type: 'string'},
    source: {type: 'string'},
    'dry-run': {type: 'boolean', default: false},
    overwrite: {type: 'boolean', default: false},
  },
  strict: false,
})

if (!args.project && !args.source) {
  console.error('Pass --project <slug> or --source <sourceDocument id>')
  process.exit(1)
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5'
const sanity = getCliClient({apiVersion: '2025-09-01'})
const anthropic = new Anthropic()

type Attribute = AttributeDef & {_id: string; description?: string; vocabulary?: Term[]}
interface SourceDoc {
  _id: string
  title: string
  shortName: string
  kind: ClaimRecord['source']['kind']
  body: string
  projectId: string | null
  verifiedAttributes: string[]
}

const attributes = await sanity.fetch<Attribute[]>(
  `*[_type == "attribute" && defined(key)]{_id, key, label, description, valueType, unit, vocabulary[]{key, label}}`,
)
const sources = await sanity.fetch<SourceDoc[]>(
  `*[_type == "sourceDocument" && defined(body) && (_id == $source || project->slug.current == $project)]{
    _id, title, shortName, kind, body, "projectId": project._ref,
    "verifiedAttributes": *[_type == "claim" && source._ref == ^._id && verified == true].attribute->key
  }`,
  {source: args.source ?? '', project: args.project ?? ''},
)

if (sources.length === 0) {
  console.error('No matching source documents with a body. Check the slug or id.')
  process.exit(1)
}

const attributeKeys = attributes.map((attr) => attr.key) as [string, ...string[]]

const Extraction = z.object({
  claims: z.array(
    z.object({
      attribute: z.enum(attributeKeys),
      numberValue: z.number().nullable(),
      dateValue: z.string().nullable(),
      textValue: z.string().nullable(),
      listValue: z.array(z.string()).nullable(),
      quote: z.string(),
      location: z.string(),
      note: z.string().nullable(),
    }),
  ),
})

const SYSTEM = `You extract facts from real-estate documents for Home Truth, a tool that helps homebuyers in India compare what a builder advertises with what is registered with the regulator and written in the agreement for sale. Buyers act on these facts, so an attribute the document doesn't state is better skipped than guessed.`

function describeAttribute(attr: Attribute): string {
  const unit = attr.unit ? ` (unit: ${attr.unit})` : ''
  const vocab = attr.vocabulary?.length
    ? ` Allowed terms: ${attr.vocabulary.map((t) => `${t.key} (${t.label})`).join(', ')}.`
    : ''
  return `- ${attr.key}: ${attr.label}. Type: ${attr.valueType}${unit}. ${attr.description ?? ''}${vocab}`
}

function buildPrompt(source: SourceDoc): string {
  return `<attributes>
${attributes.map(describeAttribute).join('\n')}
</attributes>

<document title="${source.title}" kind="${source.kind}">
${source.body}
</document>

Extract one claim for each attribute this document states.

- Only extract what the document states. Skip attributes it doesn't mention.
- Convert values to the attribute's unit: 1 sq m = 10.7639 sq ft, 1 acre = 4,046.86 sq m, ₹1 lakh = 1,00,000, ₹1 crore = 1,00,00,000. Money is in rupees. "G+12" means 12 floors above ground.
- Dates are YYYY-MM-DD, or YYYY-MM when the document only gives a month.
- For list attributes, map each item to an allowed term and drop items with no matching term. For text attributes with allowed terms, use the matching term.
- quote: the shortest passage that supports the value, copied exactly as one continuous span. For a table row, copy the cells in order separated by " | ".
- location: the nearest heading, clause or section.
- note: a short note when the basis is unclear, for example an area not labelled as carpet area. Otherwise null.
- Fill only the value field that matches the attribute's type and set the other value fields to null.`
}

let saved = 0
for (const source of sources) {
  console.log(`\nReading "${source.title}"...`)
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: {type: 'adaptive'},
    system: SYSTEM,
    messages: [{role: 'user', content: buildPrompt(source)}],
    output_config: {format: betaZodOutputFormat(Extraction)},
  })

  if (response.stop_reason === 'refusal') {
    console.warn('  The model declined this document; skipping it.')
    continue
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    console.warn('  The response was cut off or could not be parsed; skipping this document.')
    continue
  }

  const seen = new Set<string>()
  const tx = sanity.transaction()
  for (const extracted of response.parsed_output.claims) {
    const attr = attributes.find((a) => a.key === extracted.attribute)!
    const terms = new Set(attr.vocabulary?.map((t) => t.key))
    const listValue = extracted.listValue?.filter((key) => terms.size === 0 || terms.has(key)) ?? null
    const record: ClaimRecord = {
      id: ids.claimForSource(source._id, attr.key),
      attributeKey: attr.key,
      source: {id: source._id, shortName: source.shortName, kind: source.kind},
      numberValue: extracted.numberValue,
      dateValue: extracted.dateValue,
      textValue: extracted.textValue,
      listValue,
    }

    const problem = seen.has(attr.key)
      ? 'more than one claim for this attribute'
      : !hasValue(attr, record)
        ? `no ${attr.valueType} value`
        : attr.valueType === 'text' && terms.size > 0 && !terms.has(record.textValue!)
          ? `"${record.textValue}" is not an allowed term`
          : !quoteAppearsIn(source.body, extracted.quote)
            ? 'quote not found word for word in the document'
            : source.verifiedAttributes.includes(attr.key) && !args.overwrite
              ? 'a verified claim already exists (use --overwrite to replace it)'
              : null
    if (problem) {
      console.log(`  skip ${attr.key}: ${problem}`)
      continue
    }
    seen.add(attr.key)
    console.log(`  ${attr.key}: ${JSON.stringify(record.numberValue ?? record.dateValue ?? record.textValue ?? record.listValue)}  "${extracted.quote}"`)

    tx.createOrReplace({
      _id: record.id,
      _type: 'claim',
      attribute: ref(attr._id),
      source: ref(source._id),
      project: source.projectId ? ref(source.projectId) : undefined,
      numberValue: record.numberValue ?? undefined,
      dateValue: record.dateValue ?? undefined,
      textValue: record.textValue ?? undefined,
      listValue: record.listValue ?? undefined,
      quote: extracted.quote,
      location: extracted.location,
      note: extracted.note ?? undefined,
      verified: false,
      extractedBy: 'claude',
    })
  }

  if (args['dry-run']) continue
  await tx.commit()
  saved += seen.size
}

if (args['dry-run']) {
  console.log('\nDry run: nothing was saved.')
} else {
  console.log(`\nSaved ${saved} claims as unverified. Review them in the Studio under "Claims to verify".`)
  await recomputeFindings(sanity)
}
