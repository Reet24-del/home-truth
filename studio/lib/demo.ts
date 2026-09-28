// Loads the fictional demo project from data/demo. Scripts run from the
// studio folder, so paths resolve from the working directory.

import fs from 'node:fs'
import path from 'node:path'

import type {AttributeDef, ClaimRecord, SourceKind, Term} from './compare'
import {ids} from './ids'

export const DEMO_DIR = path.resolve(process.cwd(), process.env.DEMO_DATA_DIR ?? '../data/demo')

export interface DemoProject {
  id: string
  slug: string
  name: string
  city: string
  state: string
  registrationNumber: string
  promoter: string
  isDemo: boolean
  summary: string
}

export interface DemoSource {
  id: string
  key: string
  title: string
  shortName: string
  kind: SourceKind
  publisher: string
  publishedAt: string
  url?: string
  body?: string
  projectScoped: boolean
}

export interface DemoAttribute extends AttributeDef {
  id: string
  description: string
  buyerImpact: string
  askFor: string
  vocabulary?: Term[]
}

export interface DemoClaim {
  id: string
  attribute: string
  sourceKey: string
  sourceId: string
  law: boolean
  numberValue?: number
  dateValue?: string
  textValue?: string
  listValue?: string[]
  quote: string
  location: string
  note?: string
}

export interface DemoData {
  project: DemoProject
  sources: DemoSource[]
  attributes: DemoAttribute[]
  claims: DemoClaim[]
}

type RawClaim = Omit<DemoClaim, 'id' | 'sourceKey' | 'sourceId' | 'law'> & {source: string}

const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(DEMO_DIR, file), 'utf8')) as T

export function loadDemo(): DemoData {
  const raw = readJson<{
    project: Omit<DemoProject, 'id'>
    sources: Array<Omit<DemoSource, 'id' | 'body' | 'projectScoped'> & {file: string}>
    lawSources: Array<Omit<DemoSource, 'id' | 'body' | 'projectScoped'>>
  }>('project.json')
  const project: DemoProject = {...raw.project, id: ids.project(raw.project.slug)}

  const sources: DemoSource[] = [
    ...raw.sources.map(({file, ...source}) => ({
      ...source,
      id: ids.source(project.slug, source.key),
      body: fs.readFileSync(path.join(DEMO_DIR, file), 'utf8'),
      projectScoped: true,
    })),
    ...raw.lawSources.map((source) => ({
      ...source,
      id: ids.lawSource(source.key),
      projectScoped: false,
    })),
  ]

  const attributes = readJson<Array<Omit<DemoAttribute, 'id'>>>('attributes.json').map((attr) => ({
    ...attr,
    id: ids.attribute(attr.key),
  }))

  const rawClaims = readJson<{projectClaims: RawClaim[]; lawClaims: RawClaim[]}>('claims.json')
  const toClaim = (law: boolean) => ({source, ...claim}: RawClaim): DemoClaim => ({
    ...claim,
    sourceKey: source,
    law,
    id: ids.claim(law ? 'law' : project.slug, source, claim.attribute),
    sourceId: law ? ids.lawSource(source) : ids.source(project.slug, source),
  })

  return {
    project,
    sources,
    attributes,
    claims: [...rawClaims.projectClaims.map(toClaim(false)), ...rawClaims.lawClaims.map(toClaim(true))],
  }
}

export function toClaimRecord(claim: DemoClaim, sources: DemoSource[]): ClaimRecord {
  const source = sources.find((s) => s.id === claim.sourceId)
  if (!source) throw new Error(`Claim ${claim.id} points at unknown source ${claim.sourceId}`)
  return {
    id: claim.id,
    attributeKey: claim.attribute,
    source: {id: source.id, shortName: source.shortName, kind: source.kind},
    numberValue: claim.numberValue,
    dateValue: claim.dateValue,
    textValue: claim.textValue,
    listValue: claim.listValue,
  }
}
