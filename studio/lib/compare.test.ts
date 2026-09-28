import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {compareAttribute, computeFindings, type AttributeDef, type ClaimRecord} from './compare'
import {loadDemo, toClaimRecord} from './demo'
import {ids} from './ids'
import {quoteAppearsIn} from './quotes'

const source = (kind: ClaimRecord['source']['kind'], shortName: string = kind) => ({id: kind, shortName, kind})

describe('demo project', () => {
  const demo = loadDemo()
  const records = demo.claims.map((claim) => toClaimRecord(claim, demo.sources))
  const findings = new Map(computeFindings(demo.attributes, records).map((f) => [f.attributeKey, f]))

  it('finds the planted problems and the true matches', () => {
    const statuses = Object.fromEntries([...findings].map(([key, f]) => [key, f.status]))
    assert.deepEqual(statuses, {
      promoter_name: 'match',
      tower_count: 'mismatch',
      floors_per_tower: 'mismatch',
      completion_date: 'mismatch',
      area_2bhk_sqft: 'mismatch',
      amenities: 'mismatch',
      parking_price_inr: 'mismatch',
      price_2bhk_total_inr: 'mismatch',
      environmental_clearance: 'mismatch',
      land_area_acres: 'match',
      advance_before_agreement_pct: 'violation',
      defect_liability_years: 'violation',
    })
  })

  it('treats the registration as the reference and only flags the brochure date', () => {
    const f = findings.get('completion_date')!
    assert.deepEqual(
      f.entries.map((e) => [e.role, e.display]),
      [
        ['reference', '31 December 2028'],
        ['agrees', '31 December 2028'],
        ['conflicts', 'March 2027'],
      ],
    )
    assert.match(f.summary, /21 months later/)
  })

  it('lists advertised amenities that are not registered', () => {
    assert.equal(
      findings.get('amenities')!.summary,
      'Advertised in the Brochure but not in the RERA registration: Swimming pool, Amphitheatre, EV charging.',
    )
  })

  it('compares against legal limits', () => {
    assert.equal(
      findings.get('advance_before_agreement_pct')!.summary,
      'The Brochure says 20%, but the RERA Act 2016 caps it at 10%.',
    )
    assert.equal(
      findings.get('defect_liability_years')!.summary,
      'The Draft agreement says 1 year, but the RERA Act 2016 requires at least 5 years.',
    )
  })

  it('writes plain sentences', () => {
    assert.equal(findings.get('promoter_name')!.summary, 'All 3 sources agree: Kestrel Habitat Pvt. Ltd.')
    assert.equal(
      findings.get('floors_per_tower')!.summary,
      'The Brochure says 18 floors above ground; the RERA registration says 12 floors above ground.',
    )
    assert.match(findings.get('area_2bhk_sqft')!.summary, /52% more than the RERA registration\.$/)
  })

  it('formats money the Indian way', () => {
    assert.match(findings.get('parking_price_inr')!.summary, /₹0 \(free\).*₹4,50,000/)
    assert.match(findings.get('price_2bhk_total_inr')!.summary, /₹72,00,000.*₹81,55,000/)
  })

  it('quotes every project claim word for word from its source', () => {
    for (const claim of demo.claims.filter((c) => !c.law)) {
      const body = demo.sources.find((s) => s.id === claim.sourceId)!.body!
      assert.ok(quoteAppearsIn(body, claim.quote), `${claim.id}: quote not found: ${claim.quote}`)
    }
  })

  it('gives extracted claims the same IDs as seeded ones, so re-extraction replaces them', () => {
    for (const claim of demo.claims) {
      assert.equal(ids.claimForSource(claim.sourceId, claim.attribute), claim.id)
    }
  })

  it('uses only vocabulary terms for list and text claims', () => {
    for (const claim of demo.claims) {
      const attr = demo.attributes.find((a) => a.key === claim.attribute)!
      if (!attr.vocabulary) continue
      const keys = new Set(attr.vocabulary.map((t) => t.key))
      for (const value of claim.listValue ?? (claim.textValue ? [claim.textValue] : [])) {
        assert.ok(keys.has(value), `${claim.id}: ${value} is not in the ${attr.key} vocabulary`)
      }
    }
  })
})

describe('compareAttribute', () => {
  const dateAttr: AttributeDef = {key: 'd', label: 'Date', valueType: 'date'}
  const numberAttr: AttributeDef = {key: 'n', label: 'Area', valueType: 'number', unit: 'sq ft', tolerance: 0.02}

  it('treats a month-only date as agreeing with any day in that month', () => {
    const result = compareAttribute(dateAttr, [
      {id: 'a', attributeKey: 'd', source: source('registration'), dateValue: '2028-12-31'},
      {id: 'b', attributeKey: 'd', source: source('marketing'), dateValue: '2028-12'},
    ])
    assert.equal(result?.status, 'match')
  })

  it('allows differences within the tolerance', () => {
    const claims = (value: number): ClaimRecord[] => [
      {id: 'a', attributeKey: 'n', source: source('registration'), numberValue: 690},
      {id: 'b', attributeKey: 'n', source: source('agreement'), numberValue: value},
    ]
    assert.equal(compareAttribute(numberAttr, claims(700))?.status, 'match')
    assert.equal(compareAttribute(numberAttr, claims(720))?.status, 'mismatch')
  })

  it('reports a single source instead of guessing', () => {
    const result = compareAttribute(numberAttr, [
      {id: 'a', attributeKey: 'n', source: source('marketing', 'Brochure'), numberValue: 1050},
    ])
    assert.equal(result?.status, 'single_source')
    assert.equal(result?.summary, 'Only the Brochure states this: 1,050 sq ft.')
  })

  it('ignores claims without a value of the right type', () => {
    assert.equal(
      compareAttribute(numberAttr, [{id: 'a', attributeKey: 'n', source: source('marketing'), textValue: 'big'}]),
      null,
    )
  })
})
