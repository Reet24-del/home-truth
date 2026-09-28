// Document IDs for everything the scripts write. IDs avoid dots on purpose:
// Sanity treats IDs with a dot as private paths, which public reads skip.

const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-')

export const ids = {
  project: (slug: string) => `project-${clean(slug)}`,
  source: (projectSlug: string, key: string) => `source-${clean(projectSlug)}-${clean(key)}`,
  lawSource: (key: string) => `source-law-${clean(key)}`,
  attribute: (key: string) => `attribute-${clean(key)}`,
  claim: (scope: string, sourceKey: string, attributeKey: string) =>
    `claim-${clean(scope)}-${clean(sourceKey)}-${clean(attributeKey)}`,
  // Same ID as `claim()` for a source created by the seed script, so
  // re-extracting a document replaces its claims instead of duplicating them.
  claimForSource: (sourceId: string, attributeKey: string) =>
    `claim-${clean(sourceId.replace(/^source-/, ''))}-${clean(attributeKey)}`,
  finding: (projectSlug: string, attributeKey: string) =>
    `finding-${clean(projectSlug)}-${clean(attributeKey)}`,
}

export const ref = (id: string) => ({_type: 'reference' as const, _ref: id})
export const weakRef = (id: string) => ({_type: 'reference' as const, _ref: id, _weak: true})
