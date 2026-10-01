---
title: "Home Truth: an agent that checks a builder's promises against the registered record"
published: false
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

<!-- Draft. Replace every TODO before publishing, and delete this comment. -->

## What I Built

Buying a flat in India usually means paying a large booking amount on the strength of a glossy brochure. The facts the builder is actually held to are elsewhere: the project's registration with the state Real Estate Regulatory Authority (RERA), the agreement for sale, and the RERA Act itself. They often disagree with the brochure, and buyers find out years later.

**Home Truth** reads all of them and shows where they disagree, with the exact words from each document. Then an agent answers questions like "the broker is offering me B-1502, is that okay?" or checks a pasted WhatsApp ad claim by claim.

The demo project, Nimbus Greens, is fictional, but it uses tricks buyers really run into:

| The brochure says | The registered record says |
| --- | --- |
| 4 towers, G+18 | 3 buildings, sanctioned Ground + 12 |
| Possession from March 2027 | Completion 31 December 2028 (21 months later) |
| 2 BHK, 1,050 sq ft | 690 sq ft carpet area |
| Rooftop infinity pool, amphitheatre, EV charging | Not in the registered common areas |
| ₹72 lakh all-inclusive, free parking | ₹81,55,000 in the draft agreement, with ₹4,50,000 for parking |
| All approvals in place | Environmental clearance applied, awaited |
| Pay 20% on booking | The Act caps it at 10% before a registered agreement (Section 13(1)) |

A keyword search over these documents returns "G+18" and "March 2027" confidently. Getting the right answer depends on knowing which document outranks which, what the law allows, and that "1,050 sq ft" and "690 sq ft carpet" describe the same flat. That knowledge lives in the structure.

## Demo

**Live (demo data, no sign-in):** https://home-truth-theta.vercel.app

TODO: a 60 to 90 second video:
0. The landing page: the tower is built from the project's own claims. Twelve solid floors are sanctioned; the six red ones above the ring were only ever advertised. Drag it.
1. The report: 10 of 12 facts don't hold up. Open "Floors per building" and show the exact words.
2. Ask "The broker is offering me flat B-1502. Is that okay?" and open **How I checked**.
3. Paste a broker message and show the claim-by-claim verdicts.
4. Ask "Which clauses in the draft agreement give me less than the law does?"
5. In the Studio, change a claim, run `npm run findings`, and refresh the report.

## Code

https://github.com/Reet24-del/home-truth

## How I Used Sanity

**Structured content as the source of truth.** Every document is a `sourceDocument` with a kind (registration, agreement, marketing, law). Each fact a buyer cares about is an `attribute` that defines its value type, unit, tolerance, controlled vocabulary and whether it's compared for equality or against a legal limit. Each `claim` is one fact from one document, with the exact quote and where it came from. `npm test` checks every demo quote word for word against its document, and claims Claude extracts from new documents go through the same check and stay unverified until a person reviews them in the Studio.

**Deterministic findings.** A small comparison engine turns claims into `finding` documents. The registration outranks the agreement, which outranks marketing, and the Act sets limits. No model is involved, so the report is reproducible and every line traces back to a quote.

**Sanity Context, both modes.** The agent connects to two Context MCP endpoints through Claude's MCP connector:

- `home-truth-data` (GROQ mode) for exact facts. Each chat narrows it to one project with `?groqFilter=`, and I drop `initial_context` from its tool list because the system prompt already describes the schema.
- `home-truth-kb` (Knowledge Base mode), built from the RERA Act PDF plus every `sourceDocument` body through a dataset source. The agent reads the outline, then the entries it needs.

I kept them separate on purpose: an endpoint with both a dataset and a Knowledge Base serves only the dataset.

**Knowledge Base conflicts as a feature.** TODO once the Knowledge Base is built: list the conflicts the build actually flagged between the brochure and the registration, and how you resolved them (in favour of the registration, so each decision becomes an instruction later builds keep). Mention the standing instruction that keeps marketing claims in entries, labelled "Advertised", so the agent can still say what the buyer was promised. Add a screenshot of the Issues view and a sample agent answer.

## Sanity Project Details

TODO: project ID `xxxxxxxx`, dataset `production` (public).

## Agent Session

TODO: upload the build session at https://dev.to/agent_sessions/new, click Make Public, check it for keys, then embed it here.
