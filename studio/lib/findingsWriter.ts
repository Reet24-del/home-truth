import type {SanityClient} from '@sanity/client'

import {computeFindings, type AttributeDef, type ClaimRecord} from './compare'
import {ids, weakRef} from './ids'

interface FetchedData {
  attributes: Array<AttributeDef & {_id: string}>
  projects: Array<{_id: string; slug: string; name: string}>
  claims: Array<Omit<ClaimRecord, 'id'> & {_id: string; projectId: string | null}>
}

const QUERY = /* groq */ `{
  "attributes": *[_type == "attribute" && defined(key)]{
    _id, key, label, valueType, unit, tolerance, comparison, severity, vocabulary[]{key, label}
  },
  "projects": *[_type == "project" && defined(slug.current)]{_id, "slug": slug.current, name},
  "claims": *[_type == "claim" && defined(attribute) && defined(source)]{
    _id,
    "attributeKey": attribute->key,
    "projectId": project._ref,
    numberValue, dateValue, textValue, listValue,
    "source": source->{"id": _id, shortName, kind}
  }
}`

/** Recomputes every project's findings from its claims plus the law claims. */
export async function recomputeFindings(client: SanityClient): Promise<void> {
  const data = await client.fetch<FetchedData>(QUERY)
  const attributeIds = new Map(data.attributes.map((attr) => [attr.key, attr._id]))
  const computedAt = new Date().toISOString()

  for (const project of data.projects) {
    const claims: ClaimRecord[] = data.claims
      .filter((claim) => claim.projectId === project._id || claim.projectId === null)
      .filter((claim) => claim.source?.kind)
      .map(({_id, projectId: _unused, ...claim}) => ({id: _id, ...claim}))

    const results = computeFindings(data.attributes, claims)
    const keep = results.map((result) => ids.finding(project.slug, result.attributeKey))
    const stale = await client.fetch<string[]>(
      `*[_type == "finding" && project._ref == $projectId && !(_id in $keep)]._id`,
      {projectId: project._id, keep},
    )

    const tx = client.transaction()
    for (const result of results) {
      tx.createOrReplace({
        _id: ids.finding(project.slug, result.attributeKey),
        _type: 'finding',
        project: weakRef(project._id),
        attribute: weakRef(attributeIds.get(result.attributeKey)!),
        status: result.status,
        severity: result.severity,
        summary: result.summary,
        entries: result.entries.map((entry, index) => ({
          _key: `e${index}`,
          _type: 'entry',
          role: entry.role,
          display: entry.display,
          claim: weakRef(entry.claimId),
        })),
        computedAt,
      })
    }
    for (const id of stale) tx.delete(id)
    await tx.commit()

    const problems = results.filter((r) => r.status === 'mismatch' || r.status === 'violation')
    console.log(
      `${project.name}: ${results.length} findings, ${problems.length} problems` +
        (stale.length ? `, removed ${stale.length} stale` : ''),
    )
  }
}
