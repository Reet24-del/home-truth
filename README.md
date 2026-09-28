# Home Truth

Before you pay for a flat, check the builder's promises.

Home Truth compares what a builder advertises (brochures, websites, broker messages) with what is registered with the state Real Estate Regulatory Authority (RERA), what the draft agreement for sale says, and what the Real Estate (Regulation and Development) Act, 2016 requires. Every finding shows the exact words it came from.

Built for the [DEV x Sanity Challenge](https://dev.to/challenges/sanity-2026-09-16), Path One: an agent that queries real content through Sanity Context.

## Why it needs structured content

Ask a keyword search "how many floors does Nimbus Greens have?" and the brochure answers "G+18" with total confidence. Home Truth knows three things a search engine doesn't:

1. **Which document outranks which.** The registration is what the builder is legally held to; the brochure is marketing. The sanctioned plan says Ground + 12, so floors 13 to 18 have no approved plan.
2. **What the law allows.** The brochure asks for 20% on booking; Section 13(1) of the Act caps it at 10% before a registered agreement. The draft agreement gives one year of defect liability; Section 14(3) requires five.
3. **What the numbers mean.** "1,050 sq ft" in the brochure and "690 sq ft carpet area" in the registration describe the same flat. The advertised number is 52% bigger than the space the buyer actually gets.

## How it works

```
data/demo/*.md ──seed──▶ Sanity dataset
                         ├─ sourceDocument   full text of each document, with its kind
                         ├─ attribute        a fact buyers care about, and how to compare it
                         ├─ claim            one fact from one document, with the exact quote
                         └─ finding          computed by studio/lib/compare.ts (no model involved)
                                  │
            ┌─────────────────────┴──────────────────────┐
  Context MCP "home-truth-data"            Context MCP "home-truth-kb"
  GROQ mode, narrowed per project          Knowledge Base mode: the RERA Act PDF
  with ?groqFilter=                        plus every sourceDocument body, with
                                           conflicts resolved into instructions
            └───────────── Claude (MCP connector) ────────┘
                                  │
                  web/ (Next.js): report page + chat agent
```

- **Claims are checked, not trusted.** Each claim carries a quote, and `npm test` checks every demo quote against its document word for word. Claims extracted by Claude go through the same check and are saved as unverified until a person reviews them in the Studio.
- **Findings are deterministic.** `studio/lib/compare.ts` ranks sources (law > registration > agreement > marketing), applies tolerances and controlled vocabularies, and checks legal limits. The same claims always give the same findings.
- **The agent uses both retrieval modes.** GROQ mode gives exact facts ("which buildings are registered?"). Knowledge Base mode answers what the law says and what a clause means. One Context MCP endpoint serves one mode, so the agent connects to two.

## Run it now with demo data (no accounts)

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. The landing page builds the project in 3D from its own data: twelve solid floors are what the sanctioned plan covers, the six translucent red ones above the ring are what the brochure sold. Drag to turn it.

Pick Nimbus Greens for the full report. It works offline from `web/demo/nimbus-greens.json`; chat stays off until Sanity Context is connected. **Questions to ask the builder** turns the findings into a printable checklist.

Stack: Next.js 16 and React 19, three.js for the tower, Sanity Studio v6, and Claude through the Anthropic SDK.

Nimbus Greens, Kestrel Habitat and registration DEMO-RERA-0001 are fictional. The RERA Act quotes are real and were checked against the [official text](https://rera.mohua.gov.in/real-estate-regulation-and-development-act-2016.html).

## Connect Sanity (about 30 minutes)

You need Node 22.12+, a Sanity account, and an Anthropic API key for the chat.

### 1. Create the project and load the data

```bash
cd studio
npm install
npx sanity login
npx sanity init --bare          # creates a project; note the project ID it prints
cp .env.example .env            # then set SANITY_STUDIO_PROJECT_ID
npx sanity dataset visibility set production public
npm run schema:deploy           # Context reads the deployed schema
npm run seed                    # 1 project, 4 documents, 12 attributes, 28 claims, 12 findings
npm run dev                     # optional: the Studio at http://localhost:3333
```

### 2. Turn on Sanity Context

An organization admin enables **Context** and **Context Knowledge Bases** on the Labs page of your organization at [sanity.io/manage](https://www.sanity.io/manage).

Then create an **organization** API token with **Context Viewer** permission under Manage > your organization > API > Tokens. A project token will not work (you'd get `403 contextGrantRequired`).

### 3. Build the Knowledge Base

In the Sanity Dashboard, open **Context > New knowledge base**:

- **Title:** Home Truth
- **Purpose:** Helps homebuyers in India check whether a real-estate project's marketing, RERA registration and draft agreement for sale agree with each other and with the Real Estate (Regulation and Development) Act, 2016. Covers buyer rights, registered project facts, agreement clauses and red flags.
- **Source 1, Dataset:**
  ```groq
  *[_type == "sourceDocument" && defined(body)]{title, kind, publisher, publishedAt, "project": project->name, body}
  ```
- **Source 2, Files:** the Act as a PDF, from the [official RERA page](https://rera.mohua.gov.in/real-estate-regulation-and-development-act-2016.html).

Click **Build entries**. Then open **Issues**. Expect conflicts where the brochure and the registration disagree, such as floors, possession date or the jogging track length. For each one, keep the registration's claim. Each decision becomes an instruction that later builds keep.

Add one instruction yourself in the **Instructions** view, anchored to the dataset source:

> When a marketing document contradicts a registration document, treat the registration as correct, but keep the marketing claim in the entry, labelled "Advertised", with its source.

Copy the Knowledge Base id (it starts with `kb`).

### 4. Create the two MCP endpoints

In the Context app, create:

| Name | Source | Mode |
| --- | --- | --- |
| `home-truth-data` | Dataset `<project id>.production` | GROQ |
| `home-truth-kb` | The Home Truth Knowledge Base | Knowledge Base |

Don't put both sources on one endpoint: the dataset wins and the Knowledge Base is silently ignored.

### 5. Start the web app with chat

```bash
cd web
cp .env.example .env.local      # fill in every value
npm run dev
```

Ask the suggested questions, then open **How I checked** under an answer to see each GROQ query and Knowledge Base read.

### Troubleshooting

| Symptom | Cause |
| --- | --- |
| `403 contextGrantRequired` | The token is a project token. Use an organization token with Context Viewer. |
| `-32004 Only datasets with deployed Studio applications` | Run `npm run schema:deploy` in `studio/`. |
| `-32005 ... no knowledge bases are configured` | The KB endpoint has no Knowledge Base source, or the id is wrong. |
| Queries return nothing | Check the endpoint's GROQ filter. The app narrows it further per project. |

## Add a real project

1. In the Studio, create a **Project**, then a **Source document** for each document (paste the text into Full text and set its kind).
2. Let Claude extract claims. Quotes that don't appear word for word in the document are rejected.
   ```bash
   npm run extract -- --project your-project-slug --dry-run   # preview
   npm run extract -- --project your-project-slug
   ```
3. Review **Claims to verify** in the Studio, mark each one verified, then run `npm run findings`.

With real builders, present findings as differences to ask about, from public documents, not as accusations.

## Scripts

| Where | Command | What it does |
| --- | --- | --- |
| `studio` | `npm test` | Comparison engine tests, plus quote and vocabulary checks on the demo data |
| `studio` | `npm run seed` | Loads the demo project and computes its findings |
| `studio` | `npm run extract -- --project <slug>` | Extracts claims with Claude (needs `ANTHROPIC_API_KEY` in `studio/.env`) |
| `studio` | `npm run findings` | Recomputes findings after claims change |
| `studio` | `npm run demo:json` | Regenerates `web/demo/nimbus-greens.json` for offline mode |
| `web` | `npm run dev` / `build` | The app |

## Model

The agent and the extractor use `claude-opus-5` by default (set `ANTHROPIC_MODEL` to change it). Both enable server-side fallbacks (`fallbacks: "default"`), so a request the model declines is retried on Anthropic's recommended fallback model instead of failing.

## Deploy

Import the repository on Vercel with **Root Directory** set to `web` and add the variables from `web/.env.example`. The chat route streams for up to 300 seconds.

## Layout

```
data/demo/     fictional project documents, attributes and claims
studio/        Sanity Studio, schema, comparison engine, scripts
web/           Next.js app: report pages, /api/chat agent
PRD.md         what v1 is, what it isn't, and what comes next
DESIGN.md      UI tokens, components, voice and accessibility
SUBMISSION.md  draft of the DEV challenge post
```

Home Truth explains what documents and the law say. It isn't legal or financial advice.
