---
title: "The brochure said 18 floors. The registration said 12."
published: false
cover_image: https://raw.githubusercontent.com/Reet24-del/home-truth/main/docs/cover.png
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

## What I Built

Let me introduce you to Ananya. She's made up, but you probably know someone exactly like her.

She's 31, works in Pune, and has spent eight years saving for her first flat. One Sunday she walks into a sales office for a project called Nimbus Greens. The brochure is gorgeous. Four towers rising to eighteen floors, a rooftop pool, possession in March 2027, a 2 BHK of 1,050 square feet for ₹72 lakh "all-inclusive", parking free. The broker is friendly and in a hurry. If she pays 20% today, the price is locked.

Here's the part nobody tells her. Everything she needs to make this decision is already public. Every project in India has to be registered with the state's Real Estate Regulatory Authority (RERA), and that registration is what the builder is legally held to. Then there's the draft agreement for sale, and the RERA Act itself. Nobody reads those three next to the brochure. So nobody notices that they tell a different story:

| What the brochure says | What the record says |
| --- | --- |
| 4 towers, G+18 | 3 buildings, sanctioned for Ground + 12 |
| Possession from March 2027 | Completion on 31 December 2028 |
| 2 BHK, 1,050 sq ft | 690 sq ft carpet area |
| Rooftop pool, amphitheatre, EV charging | Not in the registered common areas |
| ₹72 lakh all-inclusive, free parking | ₹81,55,000 in the agreement, ₹4,50,000 of it for parking |
| All approvals in place | Environmental clearance applied for, still awaited |
| Pay 20% on booking | Section 13(1) of the Act allows 10% before a registered agreement |

Nimbus Greens is fictional. Every row in that table isn't. These are the tricks Indian buyers find out about years later, once the money is gone and the building has stopped at twelve floors.

So I built **Home Truth**. You give it a project's documents and it lays them side by side, finds every place they disagree, and shows you the exact sentence from each document so you don't have to take its word for anything. It turns the gaps into a checklist of questions to ask the builder. And it has an agent you can ask the kind of question a broker throws at you on the phone: *"I'm being offered flat B-1502, is that okay?"*

### Why this needed structured content

I tried the obvious version first in my head: dump the documents into a search index and let a model answer. Ask it "how many floors does Nimbus Greens have?" and the loudest, most confident answer in the pile is the brochure's "G+18". It's repeated, it's in large type, and it's wrong.

Getting it right takes knowledge that isn't written in any single document. You have to know that a registration outranks a brochure. You have to know that the law caps a booking amount at 10%, so a request for 20% is a violation, not a detail. And you have to know that "1,050 sq ft" and "690 sq ft carpet" are the same flat, measured two ways, and the brochure picked the flattering one. That knowledge lives in how the content is modelled. That's the bit I built in Sanity.

## Demo

**Live:** https://home-truth-theta.vercel.app. No sign-in. Open *Nimbus Greens* and try the chat.

{% embed https://www.youtube.com/watch?v=aKH4naHK82E %}

If you'd rather click around yourself, here's the two-minute tour.

Start on the home page and drag the building. It's drawn from the data: twelve solid floors are what the sanctioned plan covers, and the six translucent red ones on top only ever existed in the brochure. Scroll down and you can flip through the brochure itself in 3D, with the 20% line highlighted and Section 13(1) of the Act quoted right beside it.

Open the full report. Ten of twelve facts don't hold up, and five of those are critical. Every finding says why it matters to a buyer, and every one has a *Show the exact words* drawer with the quote from each document. One click on *Questions to ask the builder* turns all of it into a printable checklist that names the document to ask for.

Then ask the chat about flat B-1502. It goes to Sanity, checks the registration, sees that Building B is sanctioned for Ground + 12, and tells you a fifteenth-floor flat has no approved plan. Open *How I checked* under the answer and you'll see every query it ran.

## Code

{% github Reet24-del/home-truth %}

`studio/` holds the Sanity Studio, the schema, the comparison engine and the scripts. `web/` is the Next.js 16 site, the three.js scenes and the agent.

## How I Used Sanity

### I started with the schema, because the schema is the product

Before any UI, I sat down with the question "what is a fact, here?" and ended up with five document types.

A `sourceDocument` is one document's full text, plus a `kind`: registration, agreement, marketing or law. That one field is what lets the system know who to believe.

An `attribute` is something a buyer cares about, like floors per building, carpet area or the possession date. It also says how that fact should be compared: the unit, a tolerance, a controlled vocabulary, and whether it's checked for equality or against a legal limit. "Floors" and "booking amount" behave very differently, and the attribute is where that difference lives.

A `claim` is one document's version of one attribute, together with the exact words it came from and where they appear. The demo project has 28 of them. A `finding` is the verdict once all the claims for an attribute are compared: match, mismatch, violation, or only one source. And a `project` ties it all together.

The rule I cared most about was that nothing gets paraphrased. Every claim carries a quote, and `npm test` checks each demo quote word for word against its source document. When Claude extracts claims from a new document, they go through the same check and land in the Studio's *Claims to verify* view, marked unverified, until a person approves them.

### Code decides who's wrong, not the model

I didn't want an LLM deciding whether a builder broke the law. So findings come from a small comparison engine, `studio/lib/compare.ts`. It ranks the sources (Act, then registration, then agreement, then marketing), applies the tolerances and vocabularies, and checks legal limits. The same claims always produce the same findings, which means every line of the report can be traced back to a quote. The model's job comes later, and it's a narrower one: explain.

### Pointing Sanity Context at it

This is where it got interesting.

I created a Knowledge Base in the Context app and pointed it at my own dataset, using a GROQ source query to pull in every document that has a body:

```groq
*[_type == "sourceDocument" && defined(body)]{
  title, kind, publisher, publishedAt, "project": project->name, body
}
```

For the Knowledge Base's purpose I wrote it the way you'd brief a person: who's going to ask questions (homebuyers in India), what should lead (buyer rights, registered facts, agreement clauses, red flags), and what's out of scope.

Then I hit *Build entries*, and Context came back with six issues. Every one of them was a conflict between the brochure and the registration. The floors, the number of towers, the possession date, the sizes of both flat types, and a jogging track advertised at 1 km that's registered at 600 m. Reading through them felt a bit like watching the product work on itself. I resolved each one in favour of the registration, and Context saved every decision as an instruction that future builds keep.

But "the registration wins" on its own throws away something useful. A buyer needs to know what they were *promised* as well as what's true, because that gap is exactly what they'll raise with the builder. So I added one instruction by hand:

> When a marketing document contradicts a registration document, treat the registration as correct, but keep the marketing claim in the entry, labelled "Advertised", with its source.

Now the agent can say "you were told March 2027, but the builder is held to 31 December 2028", which is the sentence that actually helps.

I'll be honest about one gap. I meant to add the RERA Act as a PDF, as a second source. The government site wouldn't serve the file to my machine, so for now the law lives in the dataset as quoted claims, Section 13(1) on booking amounts and Section 14(3) on defect liability, and the agent reaches it through GROQ.

### Two endpoints, two jobs

The agent talks to Sanity through two Context MCP endpoints, and keeping them separate was deliberate. An endpoint that has both a dataset and a Knowledge Base attached quietly serves only the dataset.

`home-truth-data` runs in GROQ mode and answers exact questions. Each chat narrows it to the current project by adding a `groqFilter` to the endpoint URL, so the agent only sees that project, the attribute definitions and the law. Context combines that filter with the endpoint's own, so it can only ever narrow access, never widen it. I also cut its tool list down to `groq_query`, `schema_explorer` and `array_field_reader`. The system prompt already explains the schema, so `initial_context` was just spending tokens.

`home-truth-kb` runs in Knowledge Base mode. That's where the agent goes for "what does this clause mean" and "what are my rights if possession is late". It calls `initial_context` once to get the outline, then `knowledge_base_read` for the entries it needs.

### What the agent actually does

The agent runs on Groq with `openai/gpt-oss-120b`, using Groq's Responses API. Groq connects to both endpoints as remote MCP servers and runs the tool calls itself, so my server just sends the conversation and passes each step back to the page.

When I asked it how many floors the towers are registered for and what the brochure claims, it first ran:

```groq
*[_type == "finding" && attribute->label match "*floor*"]{status, severity, summary, "fact": attribute->label, entries}
```

Then it pulled the two claims behind that finding, opened the Knowledge Base outline, and read the *possession and delays* and *buyer rights* entries. The answer quoted the sanctioned plan ("Ground + 12") against the brochure ("G+18"), called it a critical mismatch, summarised Section 18 on delayed possession, and finished with what to ask the builder for and what not to pay yet. All five steps sit under *How I checked*.

The system prompt is short on personality and strict on rules. Trust the Act, then the registration, then the agreement, then marketing. Never invent a quote, a section number, a date or an amount. If neither source knows, say so and send the buyer to the state RERA portal or a lawyer.

### The parts that bit me

Project tokens don't work for Context. I got a 403 until I made an *organization* token with Context Viewer.

Deploying the schema wasn't enough, either. The GROQ endpoint kept saying "No Studio application found" until I ran `sanity deploy` and the Studio went live. Then everything turned green at once.

The model has habits. gpt-oss leaves markers like `【result[0].quote】` in its prose and drops `<br>` into table cells, so both get stripped before an answer reaches the page.

And the chat didn't start on Groq. I first built it on Claude's MCP connector, then moved it over. Because both run MCP on their side, the switch touched one file of about 90 lines. Claude still does the claim extraction for new documents.

## Sanity Project Details

The project ID is `f5y6g2q3`, and the `production` dataset is public. You can query it straight away: [every project](https://f5y6g2q3.api.sanity.io/v2025-01-01/data/query/production?query=*%5B_type%3D%3D%22project%22%5D), or [all the findings](https://f5y6g2q3.api.sanity.io/v2025-01-01/data/query/production?query=*%5B_type%3D%3D%22finding%22%5D%7Bstatus%2Cseverity%2Csummary%7D). The demo has 4 source documents, 12 attributes, 28 claims and 12 computed findings. The Studio is at https://home-truth.sanity.studio (sign-in required).

---

Ananya didn't pay 20% that day. She went home with a list of questions instead.

If you're about to book a flat in India, look the project up on your state's RERA portal first. Home Truth explains what the documents and the law say. It isn't legal advice.
