---
title: "The brochure said 18 floors. The registration said 12."
published: false
cover_image: https://raw.githubusercontent.com/Reet24-del/home-truth/main/docs/cover.png
tags: devchallenge, sanitychallenge, sanity, ai
---

*This is a submission for the [Sanity Challenge, Path One: Ship an Agent That Queries Real Content](https://dev.to/challenges/sanity-2026-09-16)*

## What I Built

Ananya is 31. She works in Pune, and after eight years of saving she is ready to book her first flat.

The broker has a brochure for Nimbus Greens. It's beautiful: four towers, G+18, a rooftop pool, possession from March 2027, "₹72 lakh all-inclusive, free parking". He also has a request. Pay 20% today, before the offer goes away.

Everything Ananya needs to know is public. It's just spread across three documents nobody reads side by side: the project's registration with the state Real Estate Regulatory Authority (RERA), the draft agreement for sale, and the RERA Act itself. Put them next to the brochure and the story changes:

| The brochure says | The record says |
| --- | --- |
| 4 towers, G+18 | 3 buildings, sanctioned for Ground + 12 |
| Possession from March 2027 | Completion 31 December 2028, 21 months later |
| 2 BHK, 1,050 sq ft | 690 sq ft carpet area |
| Pool, amphitheatre, EV charging | Not in the registered common areas |
| ₹72 lakh all-inclusive, free parking | ₹81,55,000 in the agreement, ₹4,50,000 of it for parking |
| All approvals in place | Environmental clearance: applied, awaited |
| Pay 20% on booking | Section 13(1) of the Act caps it at 10% before a registered agreement |

Ananya and Nimbus Greens are made up. The tricks aren't. Every row is something Indian homebuyers run into, usually years later, usually after the money is gone.

**Home Truth** puts those documents side by side before you pay. It shows every place they disagree, quotes the exact words from each one, and turns the gaps into questions to ask the builder. Then there's an agent you can ask the questions brokers ask you: *"I'm being offered flat B-1502, is that okay?"* or *"Here's the WhatsApp ad, check it."*

Here's why a search box can't do this. Ask "how many floors does Nimbus Greens have?" and the most confident answer in the pile is the brochure's "G+18". To get it right you need to know three things the text doesn't tell you:

1. **Which document outranks which.** The registration is what the builder is legally held to. The brochure is marketing.
2. **What the law allows.** 20% sounds like a normal booking amount until you know the Act says 10%.
3. **What the numbers mean.** "1,050 sq ft" and "690 sq ft carpet" describe the same flat. The bigger number is a different measurement, used because it's bigger.

That knowledge doesn't live in any single document. It lives in the structure, and that's what I built in Sanity.

## Demo

**Live:** https://home-truth-theta.vercel.app (no sign-in; open *Nimbus Greens* and try the chat)

{% embed https://www.youtube.com/watch?v=aKH4naHK82E %}

What to look for:

- **The tower on the home page is built from the data.** Twelve solid floors are what the sanctioned plan covers. The six translucent red ones above the ring exist only in the brochure. Drag it around.
- **The brochure is there in 3D**, with the 20% line highlighted and Section 13(1) quoted next to it.
- **The report:** 10 of 12 facts don't hold up, 5 of them critical. Every finding has a *Show the exact words* drawer with the quote from each document.
- **Questions to ask the builder:** the findings become a printable checklist that says which document to ask for.
- **The agent:** ask about flat B-1502. It runs GROQ queries against the project, works out that Building B is sanctioned for Ground + 12, and says a 15th-floor flat has no approved plan. *How I checked* shows every query it ran.

## Code

{% github Reet24-del/home-truth %}

`studio/` is the Sanity Studio, the schema, the comparison engine and the scripts. `web/` is the Next.js 16 site and the agent.

## How I Used Sanity

### The content model is the product

I started with the schema, because the whole idea depends on it. Five types:

- **`sourceDocument`**: one document's full text, plus its `kind`: `registration`, `agreement`, `marketing` or `law`. The kind is what lets the system rank sources.
- **`attribute`**: one fact a buyer cares about, like floors per building, carpet area or possession date. It says how to compare that fact: its unit, a tolerance, a controlled vocabulary, and whether it's checked for equality or against a legal limit.
- **`claim`**: one document's version of one attribute, with the **exact quote** and where it appears. The demo has 28.
- **`finding`**: what you get when you compare all the claims for an attribute: `match`, `mismatch`, `violation` or `single_source`.
- **`project`**: ties it together.

Two rules keep it honest. First, **claims are checked, not trusted.** `npm test` checks every demo quote word for word against its document. Claims that Claude extracts from a new document go through the same check, and arrive marked unverified until a person approves them in the Studio's *Claims to verify* view.

Second, **findings come from code, not a model.** `studio/lib/compare.ts` ranks the sources (Act > registration > agreement > marketing), applies tolerances and vocabularies, and checks legal limits. The same claims always give the same findings, so every line of the report traces back to a quote. I didn't want an LLM deciding whether a builder broke the law.

### Sanity Context: a Knowledge Base and two MCP endpoints

The agent reads Sanity through two Context MCP endpoints, one per retrieval mode.

**`home-truth-data` (GROQ mode)** gives exact facts. Every chat narrows it to one project by adding a `?groqFilter=` to the endpoint URL, so the agent can only see that project, the attribute definitions and the law. Context combines that filter with the endpoint's own, so it can only ever narrow access. I also trimmed its tool list to `groq_query`, `schema_explorer` and `array_field_reader`. The system prompt already describes the schema, so `initial_context` was wasted tokens.

**`home-truth-kb` (Knowledge Base mode)** answers the "what does this mean" questions. I pointed the Knowledge Base at the dataset with this source query:

```groq
*[_type == "sourceDocument" && defined(body)]{
  title, kind, publisher, publishedAt, "project": project->name, body
}
```

That gives it the full text of the brochure, the registration and the agreement. The Knowledge Base's purpose is written for buyers: who comes with questions, what should lead, what to leave out.

**The conflict review turned out to be the best part.** On the first build, Context flagged six conflicts between the brochure and the registration: the floors, the tower count, the possession date, both flat sizes, and the jogging track (1 km advertised, 600 m registered). I resolved every one in favour of the registration. Each decision becomes an instruction that later builds keep.

Then I added one instruction by hand, because "the registration wins" on its own throws away something useful:

> When a marketing document contradicts a registration document, treat the registration as correct, but keep the marketing claim in the entry, labelled "Advertised", with its source.

So the agent can still say *"you were promised X, the builder is held to Y"*, which is exactly the sentence a buyer needs.

### What the agent does with it

The agent runs on Groq's Responses API with `openai/gpt-oss-120b`. Groq connects to both Context endpoints as remote MCP servers and runs the tool calls itself, so my server code only sends the conversation and relays the steps back to the UI. A typical answer looks like this:

1. `groq_query` for the findings that are mismatches or violations;
2. `groq_query` for the registration's claims on the facts in question;
3. `initial_context` on the Knowledge Base, then `knowledge_base_read` on the entries it needs, like *possession and delays* or *buyer rights*;
4. an answer that cites each fact by document and quote, then says what to ask for and what not to pay yet.

The system prompt gives it the trust order and one hard rule: never invent a quote, section number, date or amount. If neither source has the answer, it says so and points to the state RERA portal or a lawyer.

### Things I learned the hard way

- **One endpoint, one mode.** An endpoint with both a dataset and a Knowledge Base silently serves only the dataset. Hence two.
- **Project tokens don't work for Context.** You get `403`. It needs an *organization* token with Context Viewer.
- **A deployed schema isn't enough.** The GROQ endpoint said "No Studio application found" until I actually ran `sanity deploy`. After that it went green.
- **The model has habits.** gpt-oss leaves tool-result markers like `【result[0].quote】` in its prose and puts `<br>` inside table cells. Both get stripped before the answer reaches the page.
- **The chat started on Claude.** I built it first on Claude's MCP connector, then moved it to Groq. Because both providers run MCP server-side, the switch touched one file of about 90 lines. Claude still does the claim extraction for new documents.

## Sanity Project Details

- **Project ID:** `f5y6g2q3`
- **Dataset:** `production` (public)
- **Try it:** [every project in the dataset](https://f5y6g2q3.api.sanity.io/v2025-01-01/data/query/production?query=*%5B_type%3D%3D%22project%22%5D) · [the findings](https://f5y6g2q3.api.sanity.io/v2025-01-01/data/query/production?query=*%5B_type%3D%3D%22finding%22%5D%7Bstatus%2Cseverity%2Csummary%7D)
- **Studio:** https://home-truth.sanity.studio (sign-in required)

The demo dataset has 4 source documents, 12 attributes, 28 claims and 12 computed findings.

## Agent Session

The whole build, from "connect my two github projects to sanity" to the demo video, was one Claude Code session:

{% agent_session building-home-truth-a-rera-checking-agent-on-sanity-context-be7jrx %}

---

Ananya didn't pay 20% that day.

If you're about to book a flat in India, check the project on your state's RERA portal first. Home Truth explains what the documents and the law say. It isn't legal advice.
