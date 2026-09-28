# Home Truth: Product Requirements Document

**Version:** 0.1 (draft) · **Date:** 20 September 2026 · **Status:** v1 built as a DEV x Sanity Challenge entry, not yet connected to live data

---

## Problem Statement

A homebuyer in India decides on a flat from a brochure and a site visit, then pays a booking amount that often runs into lakhs. The facts the builder is legally held to sit somewhere else: the project's RERA registration, the agreement for sale, and the Real Estate (Regulation and Development) Act, 2016. Those documents are public or in the buyer's hands, but they are long, full of jargon, and written to be skimmed past. Buyers find out about the unregistered floor, the 21-month-later completion date or the ₹9.5 lakh of charges outside the "all-inclusive" price only after the money is gone.

The cost of not solving it is concrete: money paid on a promise that no document supports, and a dispute that takes years to unwind.

**Evidence still to gather:** see Open Questions. The v1 demo is built on a fictional project that reproduces patterns known from RERA complaints, not on measured user research.

---

## Goals

1. **A buyer sees every mismatch in under two minutes.** From opening a project to reading the first finding, with no login and no jargon.
2. **Every displayed fact traces to the words that support it.** 100% of findings show the exact quote and the document it came from.
3. **The agent never answers from thin air.** Every factual claim in an answer cites a document in the record or the Act; when neither has the answer, it says so and points to where to check.
4. **A buyer leaves with actions, not anxiety.** Every report and answer ends with what to ask the builder or what to see before paying.
5. **One person can add a real project in under 30 minutes**, including extraction, verification and recomputing findings.

---

## Non-Goals

1. **Legal advice.** The product explains what documents say and where they disagree. It does not tell anyone whether to buy, or whether a clause is enforceable. Verdicts on enforceability need a lawyer.
2. **Scraping state RERA portals (v1).** Every state runs its own portal, some behind bot checks, with different formats and terms of use. v1 works from documents the operator or buyer supplies.
3. **Publishing accusations about named builders (v1).** Findings are framed as differences to verify. The demo project is fictional for this reason.
4. **Price, investment or resale advice.** Out of scope entirely.
5. **Buyer accounts, payments or document storage for consumers (v1).** An uploaded agreement is personal data; until retention and privacy are settled, v1 is read-only over curated projects.
6. **Languages other than English (v1).** Many buyers need Hindi or Marathi. It matters, but it comes after the core loop works.

---

## Users

| Persona | What they need |
| --- | --- |
| **First-time buyer** (primary) | Plain-language answers, fast, on a phone, before a payment deadline |
| **The family checker** (primary) | The person in the family who "handles documents"; wants the list of questions to ask |
| **Buyer's lawyer or advocate** (secondary) | Exact quotes, clause references, the source documents themselves |
| **Content operator** (internal) | To add a project's documents and get trustworthy claims out of them quickly |

---

## User Stories

**Buyer**

1. As a buyer, I want to see where the brochure and the registered record disagree, so that I know what is actually promised.
2. As a buyer, I want to check the specific flat I'm being offered (building and floor), so that I don't book a unit with no sanctioned plan.
3. As a buyer, I want to paste the broker's message or ad and get a verdict on each claim, so that I can answer a sales pitch with facts.
4. As a buyer, I want to know which clauses in my draft agreement give me less than the law does, so that I can ask for them to be changed before signing.
5. As a buyer, I want the exact words from each document, so that I can show the builder what I'm asking about.
6. As a buyer, I want to know when a fact hasn't been checked by a person yet, so that I don't rely on it blindly.
7. As a buyer on a phone with a slow connection, I want the report to load and read without a chat conversation, so that I get value even if the agent is unavailable.

**Operator**

8. As an operator, I want to paste a document's text and have claims extracted with quotes, so that adding a project takes minutes rather than hours.
9. As an operator, I want to review and verify extracted claims in one place, so that nothing unchecked reaches a buyer.
10. As an operator, I want to resolve a conflict between sources once and have that decision persist, so that later rebuilds don't reopen it.

**Edge cases**

11. As a buyer whose project has no registration document loaded, I want to be told the comparison is incomplete, not shown a clean bill of health.
12. As a buyer asking something no document answers, I want to be told that, and where to look instead.

---

## Requirements

### Must-Have (P0)

**P0-1. Structured claim model** *(built)*
Documents, attributes, claims and findings are separate content types; a claim carries its verbatim quote, location and verified flag.
- Given a claim, when it is displayed, then its quote and source document are shown with it.
- A claim whose quote does not appear word for word in its source document is rejected at extraction time.

**P0-2. Deterministic findings** *(built)*
Comparison runs in code, not in a model: law > registration > agreement > marketing, with tolerances, controlled vocabularies and legal limits.
- Given the same claims, when findings are recomputed, then the output is identical.
- Given only one source states a fact, then the status is "only one source", never "matches".
- Given a value exceeds a legal maximum from the Act, then the status is "against the law" and names the section.

**P0-3. Report page** *(built)*
A public, no-login page per project: counts, findings ordered by severity, per-source values, why it matters, and expandable quotes.
- Given a phone-sized screen, when the report loads, then it reads without horizontal scrolling.
- Given Sanity is unreachable, when the page loads, then it shows an error rather than an empty "no problems found".

**P0-4. Agent over Sanity Context** *(built, not yet run against live endpoints)*
The agent reads structured facts in GROQ mode and the law and document prose in Knowledge Base mode, scoped to the current project.
- Given a question about a fact in the record, then the answer cites the document and quote.
- Given a pasted ad, then each claim gets one of: Matches, Contradicts the registered record, Not in any registered document, Can't check.
- Given the agent has no supporting source, then it says so instead of answering.

**P0-5. Visible reasoning trail** *(built)*
Each answer exposes the queries and Knowledge Base entries it used.

**P0-6. Safety framing** *(built)*
Disclaimer on every report; unverified claims labelled; fictional demo marked as fictional.

**P0-7. Live deployment on real content** *(not done)*
Knowledge Base built and its conflicts resolved, both MCP endpoints live, app deployed, at least one project whose documents are real and public.

### Nice-to-Have (P1)

- **Upload a PDF instead of pasting text.** Extraction from the uploaded file, so a buyer's own agreement can be checked.
- **Unit-level claims.** Facts about a specific flat (tower, floor, carpet area, price) so "is B-1502 okay?" is answered from data, not inference.
- ~~**Questions-to-ask export.**~~ *(built)* A printable checklist at `/projects/[slug]/checklist`, generated from the findings, with the document to ask for on each line. A WhatsApp-ready text version is still open.
- **Change alerts.** When a refreshed source changes a registered fact, notify anyone following that project.
- **Hindi and Marathi** for the report and the agent's answers.
- **State rules layer.** State RERA rules sit above the central Act and differ; model them as another law source.

### Future Considerations (P2)

- Connectors that pull registration data directly from state portals, where terms allow.
- A library of public projects buyers can search by name or registration number.
- Referral to a property lawyer for a paid review, with the findings attached.
- Comparing two projects side by side.

These shape the schema now: attributes are jurisdiction-agnostic, sources carry a publisher and date, and the law is modelled as just another source, so adding state rules or a second country doesn't require a rewrite.

---

## Success Metrics

**Leading (days to weeks)**

| Metric | Target | How |
| --- | --- | --- |
| Report reach | 80% of visitors open at least one finding's quotes | Page events |
| Time to first finding | Under 30 seconds from landing | Page events |
| Answers with a citation | 95% of factual answers cite a document | Sample 50 answers manually |
| Extraction precision | 85% of Claude-extracted claims accepted unchanged at verification | Verification log in the Studio |
| Chat answer latency | Median under 25 seconds | Server timing |
| Agent dead ends | Under 10% of questions answered with "no source" | Answer review |

**Lagging (weeks to months)**

- Buyers who report asking the builder a question from the report, from a short feedback prompt.
- Projects in the library, and repeat visits per project.
- For the challenge specifically: a complete, on-time submission with a working demo the judges can use.

**Not instrumented yet.** No analytics are wired in; see Open Questions.

---

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Naming a real builder as misleading invites legal trouble | Fictional demo; findings framed as differences to verify; only public or buyer-supplied documents |
| The model invents a quote or a section number | Quotes verified against source text; findings computed in code; citations required; human verification before a claim goes live |
| A document changes and the report goes stale | Dataset and website sources refresh on a schedule; `publishedAt` shown on every source |
| Beta dependencies (Knowledge Bases, MCP connector) change | Retrieval sits behind one module; the report works without the agent |
| Per-question model cost | Stable system prompt for caching, scoped queries, and a cheaper model configurable by env var |
| A buyer treats output as legal advice | Disclaimer on every report and in the agent's instructions; suggest a lawyer for large payments |

---

## Open Questions

**Blocking**

1. **Legal:** can we publish a comparison naming a real, registered project, and what framing does counsel require? Everything past the fictional demo waits on this.
2. **Data:** which state portals permit automated access or mirroring of registration documents, and under what terms?
3. **Privacy:** if buyers upload their own agreement, what is the retention policy, and where is it stored? Until answered, uploads stay out of scope.

**Non-blocking**

4. **Engineering:** should findings be recomputed by a Sanity Function on document change instead of a script an operator runs?
5. **Engineering:** do unit-level claims (per flat) justify their own content type, or are they attributes with a scope field?
6. **Design:** how much of the quote evidence belongs on screen by default on a phone, versus behind "show the exact words"?
7. **Data:** what event logging is acceptable given that pages may reveal which project a person is considering?
8. **Product:** who adds projects at scale — a small curated team, or buyers adding their own documents?

---

## Timeline

**Phase 0: prototype** *(done)*
Content model, comparison engine with tests, report page, agent code, fictional demo project.

**Phase 1: submission** *(by 4 October 2026)*
Connect Sanity Context, build the Knowledge Base and resolve its conflicts, deploy, record the demo, publish the DEV post with the project ID and a public dataset.
Depends on: Context and Knowledge Bases enabled for the organization, an organization token, an Anthropic API key.

**Phase 2: one real project** *(2 to 4 weeks after)*
Answer the legal question, load one project from public documents, add unit-level claims and the questions-to-ask export, and run it past five buyers.

**Phase 3: scale** *(not scheduled)*
State rules, more languages, and portal connectors, subject to the data question.
