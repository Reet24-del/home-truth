# Home Truth: UI design

The design system behind the app in `web/`. Tokens live in [`web/app/globals.css`](web/app/globals.css); components live in `web/components/` and `web/app/`. If a value isn't a token here, it shouldn't be in a component.

---

## Principles

1. **Evidence stays one tap away.** Every claim on screen can be traced to the words that support it, without leaving the page. "Show the exact words" is never more than one disclosure deep.
2. **Alarming facts, calm surface.** The content is frightening enough. There is no colour to shout with: severity is a solid edge, a dashed one, or a hairline.
3. **Plain words beat product words.** "Doesn't match", not "Mismatch detected". "Against the law", not "Compliance violation". A first-time buyer reading on a phone is the default reader.
4. **The report works without the agent.** The findings are server-rendered and readable with chat off, offline data, or a dead API key. Chat is an addition, never a prerequisite.
5. **Phone first, and the phone is slow.** Two self-hosted webfonts, no icon library, no client-side data fetching on the report. Only the chat and the 3D scene run on the client, and both load after the page is usable.
6. **The 3D has a job.** The tower isn't decoration: it is the finding. Twelve solid floors are what the sanctioned plan covers; the translucent red ones above the ring are what the brochure sold. If a visual can't carry a fact, it doesn't ship.

---

## Tokens

All tokens are CSS custom properties on `:root`, redefined under `@media (prefers-color-scheme: dark)`. Components reference tokens only.

### Colour

Dusk. The site is one warm dark theme: espresso walls, lamplight type, and the three verdict colours tuned for a dark room. It's built to feel like a photograph of a room at sunset, and every section below the hero lives in that same room. Every text pair is at least 6.2:1.

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` / `--bg-deep` | `#17120d` / `#0f0b08` | The room; the deepest shadow at the top of the hero |
| `--surface` / `--surface-2` | `#201a14` / `#2b231b` | Cards, slips, panels |
| `--text` | `#f4e9d8` | Lamplight cream |
| `--muted` / `--faint` | `#b6a58e` / `#93816a` | Captions, sources, metadata |
| `--border` / `--rule` | `#3a2f24` / `#4a3b2c` | Edges and ruled lines |
| `--accent` | `#b8cf7d` | Olive: the record, the sanction band, links |
| `--accent-2` | `#e5ae57` | Amber: **decoration only** |
| `--critical` / `--critical-bg` | `#ff8163` / `#3a1d15` | Coral-brick: contradictions, unapproved floors, the accusation in the headline |
| `--major` / `--major-bg` | `#f3b552` / `#3a2a12` | Caution |
| `--ok` / `--ok-bg` | `#a9cf74` / `#1e2a14` | Facts that match |
| `--lamp` | amber 50% | Window light in the hero |

**The one exception:** the 3D brochure is printed paper (`#fbf3e4`, brown-black ink, brick stamp) whatever the room looks like, because a brochure is an object you hold, not a panel on a screen.

**Semantic rule:** olive means the document agrees with the one that outranks it, coral-brick means it contradicts, amber means be careful. Claimed values are also struck through, so the verdict never rests on colour alone.

### Logo

A filed sheet with a folded corner. Inside it, a building: two floors drawn as dashed brick outlines, a solid ink line, then two solid floors. Advertised above the line, approved below it — the product's whole argument at 32 pixels. It sits in the masthead beside the wordmark and doubles as the favicon (`app/icon.svg`).

### Type

Four voices, each with a job. **Inter Tight 200** (`--grotesk`) sets the hero headline and copy — thin, wide, and quiet enough to sit on a photograph. **Fraunces** (`--display`) sets every other heading and every quoted document line: it is warm, slightly odd, and unmistakably not a dashboard font. **IBM Plex Mono** (`--mono`) carries anything that came off a document: file numbers, values, source names, GROQ in the chat trace. The system sans stack carries body copy, where reading speed matters more than character. Both webfonts are self-hosted through `next/font`, so there is no third-party request and no layout shift.

| Role | Face | Size | Notes |
| --- | --- | --- | --- |
| Landing headline | Display 600 | `clamp(40px, 6.4vw, 78px)` | Line height 0.98, the accusation in italic brick |
| Page title | Display 600 | `clamp(26px, 4vw, 36px)` | Report header |
| Section title | Display 600 | `clamp(22px, 2.6vw, 30px)` | Sits on a hairline rule |
| Card / slip title | Display 600 | 17–21px | Findings, slips, file names |
| Quoted document line | Display 400 | `clamp(19px, 2vw, 24px)` | In quote marks, highlighter optional |
| Values and metadata | Mono 400–500 | 10.5–16px | Uppercase and letterspaced when it's a label |
| Body | System sans | 15–19px | Line height 1.55 |

### Shape, spacing, motion

- `--radius: 4px` — paper has corners, not pills. Badges stay round; everything else is nearly square.
- Spacing steps in use: 4, 6, 8, 10, 12, 16, 24, 32, 48px. Card padding is 16–20px; page gutter is 16px.
- Motion is nearly absent: slips straighten and lift on hover (0.25s), and the building drifts. No scroll animation, no entrance stagger, no spinners — "Checking the documents…" is text. Everything is disabled under `prefers-reduced-motion`.

---

## Layout

| Breakpoint | Behaviour |
| --- | --- |
| Base (≥320px) | Single column, 16px gutters, `.container` max 1200px |
| ≤560px | Entry rows drop to two columns; the masthead stacks |
| ≤640px | Tower labels move below the canvas instead of floating over it |
| ≥860px | Evidence becomes two documents side by side |
| ≥940px | The case splits: headline left, building right |
| Slips | `auto-fill` from 290px, so they reflow rather than sit in a grid |
| ≥1000px | Report becomes `1fr / 420px`: findings left, chat panel sticky right at `calc(100vh - 32px)` |

Verified at 375×812 (no horizontal scroll, both themes) and 1440×960.

---

## Components

### The room (every page)

The dusk isn't a hero effect; it's where the whole site lives. A fixed layer in the root layout sits behind every page — landing, report, checklist — and content scrolls over it:

| Layer | What it is |
| --- | --- |
| Base | Espresso gradient, deepest at the top and bottom of the viewport |
| Window glow | A warm amber pool top-left, a fainter lamp pool bottom-right |
| Curtains | Warm wash with vertical folds down the left edge, fading out by a third of the width |
| Light shafts | Three soft diagonal beams, blurred, screen-blended |
| Vignette | Dark corners, like a lens |

Panels are translucent (`--surface` is 74% opaque) so the light passes through them, and the three big ones — chat, the registration card, the brochure fallback — are frosted with a 10px backdrop blur. The layer is hidden in print.

One gotcha worth knowing: only `html` paints a background colour. If `body` painted one too, it would cover the room, which sits at a negative z-index.

### Hero: a room at dusk

Modelled on interior-photography sites: full-bleed, dark and warm, with the subject lit from one side and one line of type holding the whole screen.

| Layer | What it is |
| --- | --- |
| The scene | The 3D building in `cinematic` mode: a low amber key light raking in from the left like late sun through a window, fog that swallows the floor, three additive light shafts, a lower camera looking up. On wide screens the building stands right of centre (a view offset, the way a photographer frames a figure); on phones the camera steps back and nudges it right to leave room for the redline |
| Curtains | CSS: a warm wash from the left with faint vertical folds, masked off by mid-screen |
| Vignette | Dark corners and a dark floor so the type at the bottom always reads |
| The redline | The facts are drawn onto the building instead of written beside it. An architect's dimension line (slash ticks, mono caption) measures the sanctioned floors: **12 · sanctioned** in the brand green. A dashed red dimension marks the rest: **+6 · brochure only**, with the caption in Fraunces italic like a reviewer's handwriting. A red-pen loop, drawn in once on load, rings the unapproved floors. It's HTML over the canvas, pinned every frame to the building's projected edges (`--mk-*` pixels from `TowerScene`). It takes whichever side of the building has more room, and stops just above the headline, fading out rather than cutting through the type |
| Credits | Under the headline, over a hairline, like the credits under a title card: the mono file line, one sentence ("The brochure sells 18 storeys. The sanctioned plan allows 12…"), and the links. It's one row on wide screens and stacks below 900px |
| Headline | Inter Tight 200, uppercase, 8.6vw: "SIX FLOORS · NOBODY / APPROVED", split left-right then centred. The first phrase is coral, the rest cream. The number is spelled out from the findings |
| Masthead | Floats over the hero with a hairline, no background |

Text over the scene doesn't take pointer events, so the building can be dragged through the headline.

### Landing page

It reads as a case file, not a product page. There are no gradient blobs, no stat band and no numbered feature cards, because that is the house style of every generated landing page and this product's whole argument is that it deals in documents.

| Section | What it is |
| --- | --- |
| **File line** | A mono rule above the headline: file number, project, registration number |
| **Headline** | One sentence in Fraunces, with the accusation in brick italic: "They sold 6 floors that no plan *approves*." The numbers come from the findings |
| **The building** | Sitting to the right on a warm wash, as if on a drawing board |
| **Evidence** | The brochure as a 3D booklet you can turn, zoom and read, beside the registration card with an olive rule down its edge |
| **Slips** | One paper slip per remaining contradiction, each rotated a fraction: what the pitch said in brick, what the record says in olive, with a severity bar across the top |
| **How it works** | Three beats — Claims, Ranking, Answers — under giant outlined numerals in the hero's thin grotesk; the numeral fills with amber on hover |
| **Files** | Each project is a folder: a tab reading "File 01 · fictional", the name in the hero's thin uppercase type, a thin amber-to-coral bar for the share of facts that don't hold up, and one "Open the file" link. Demo status is a quiet mono note, not a banner |

Every number, quote and source name on the page is read from the findings, so a different project writes a different page.

**Texture:** a fixed SVG grain sits over everything at 32% (20% and soft-light in dark mode). Cards tilt by fractions of a degree and the stamp by seven. Those small irregularities are what stop a warm palette reading as a template.

### Brochure (3D)

The sales brochure as an object rather than a screenshot. Its pages are drawn from the document's own markdown: headings in the display face, body in sans, tables and metadata in mono, page numbers at the foot.

| Behaviour | How |
| --- | --- |
| Read it | Pages are canvas textures at 1000 × 1360, so they stay sharp when zoomed |
| Turn a page | Tap a side, or the ‹ › buttons; leaves rotate on the spine over 0.7s |
| Zoom | Scroll, or the + − buttons; the camera dollies between 0.42× and 1.6× of a fitted spread |
| Angle | Drag to tilt, clamped so it never turns away from the reader |
| Opens at the claim | The page carrying the quoted claim is the one facing you, highlighted, with the stamp beside it |
| Closed book | Centred rather than shunted to one side of the spine |
| Screen readers | The full text sits under "Read it as plain text"; the canvas is `aria-hidden` |
| No WebGL | The plain text is all that renders |

The highlight matches on the first three words of the claim, normalised, because a quote wraps across printed lines.

### Tower (3D)

A three.js scene, one component, two sizes.

| Prop | Meaning |
| --- | --- |
| `advertised` | Floors the marketing claims |
| `registered` | Floors the sanctioned plan covers |
| `compact` | Smaller, shadowless version for a finding card |

**What it shows:** a real building up to the sanctioned limit, a lit ring and a green band at that limit, then translucent red floors above it. Drag turns it; it drifts slowly on its own; the unapproved floors breathe.

Detail carries the realism, and each piece has a reason:

| Element | Why it's there |
| --- | --- |
| Floor plates that overhang the glass line | Reads as a building, not a stack of boxes |
| Glazed bands with sills and recessed spandrels | The two horizontal lines that stop a facade looking painted on |
| Corner fins and three mullions per face | Vertical rhythm, and they catch the key light |
| Warm and cool lit windows, about 40% of them | Someone lives there; it's the flat being sold |
| Balconies with metal rails on the long faces | Scale: you can read the floor height against them |
| Taller lobby, canopy, plinth and steps | A ground line, so the tower isn't floating |
| Roof parapet, stair core, water tank, three AC units, mast | Roofs are never flat and empty |
| Planters and trees around a soft plaza | Human scale next to a 12-storey block |
| Outlined corner posts through the unapproved floors | Structure drawn but never built |

The building is cream stone with ink glazing. The sanctioned floors are built; the advertised ones above the ring are **drawn** — 10% fill and a full-strength outline, so they read as line work laid over the real thing. That is the whole argument in one image, and it needs no colour.

**Rules**
- Numbers come from the finding's claims, never hardcoded. A project with sanctioned floors matching the brochure shows no tower.
- Colours are read from the CSS tokens at mount, so light and dark stay consistent with the rest of the page.
- Labels are HTML, not 3D text: they stay crisp, translate later, and move below the canvas under 640px.

**Behaviour and cost**
- Loaded with a dynamic import, so three.js never blocks first paint.
- One render happens immediately on mount, so a page that opens in a background tab still has a picture ready.
- The loop pauses when the canvas scrolls out of view; animation pauses when the tab is hidden.
- Pixel ratio is capped at 2, shadows are off in compact mode, and every geometry, material and the renderer are disposed on unmount.
- Reduced motion: no drift, no pulse, still draggable.
- No WebGL: a CSS fallback draws the same comparison as stacked bars.
- Accessibility: the canvas is `role="img"` with a sentence that states both numbers and what the red floors mean.

### Stat band, gap bars

The stat band is four numbers from the same findings: problems, critical, matches, documents. The gap bars put two sources on one scale (advertised vs registered) for floors, carpet area and total cost; bars grow once on load. Values, labels and source names all come from claims, so a different project produces different bars with no code change.

### Tilt cards

The "how it works" steps and project cards lift 6px and rotate ~3° on hover, with an accent-tinted shadow. Disabled entirely under reduced motion. Never used on a finding card: the report stays still.

### Finding card

The core unit. One card per attribute compared.

**Anatomy:** title + badges → one-sentence summary → one row per source → "Why it matters" (problems only) → "Show the exact words" disclosure.

| Variant | Left border | Badges |
| --- | --- | --- |
| `status-violation` | severity colour | Severity + "Against the law" |
| `status-mismatch` | severity colour | Severity + "Doesn't match" |
| `status-single_source` | `--border` | "Only one source" |
| `status-match` | `--ok` | "Matches" |

Severity (`critical`, `major`, `minor`) only colours the border and badge on problem cards; a matching fact is never red because it's critical.

**Entry row roles** map to a tone, not a colour choice made per card:

| Role | Label | Tone |
| --- | --- | --- |
| `reference` | most trusted | neutral |
| `agrees` | ✓ agrees | good |
| `conflicts` | ✗ doesn't match | bad |
| `limit` | legal limit | neutral |
| `complies` | ✓ within the law | good |
| `violates` | ✗ against the law | bad |

**Rules**
- The summary sentence comes from `compare.ts`, not the component. The UI never writes its own comparison text.
- Quotes are always attributed: document title, then clause or section, then "not yet checked by a person" when the claim is unverified.
- Cards carry `id={attribute.key}` so a finding can be linked to directly.

| ✅ Do | ❌ Don't |
| --- | --- |
| Let the summary carry the meaning | Add an icon that repeats the badge |
| Keep quotes verbatim, in quote marks | Trim a quote to make it fit |
| Show the unverified note when it applies | Hide provenance to look more confident |

### Badge

Pill, 13px, 600 weight, `--*-bg` background with matching foreground. Four tones: `critical`, `major`, `minor`/`neutral`, `ok`. Text only, no dot or icon. Used for severity, status, "Fictional demo project" and "Offline demo data".

### Scoreboard tile

Big number over a plain label: critical problems, facts that don't hold up, facts that match, documents checked. The critical tile uses `--critical`, the match tile `--ok`, the rest inherit `--text`. Four tiles wrap to 2×2 on a phone.

### Project card

A link. Badges first (demo, critical count, "N of M facts don't hold up"), then name, then city and registration number. Hover moves the border to `--accent`; the whole card is the hit area.

### Chat panel

| State | What shows |
| --- | --- |
| Empty | Four suggested questions as full-width buttons (44px minimum height) |
| Working | "Checking the documents…" in muted text until the first token arrives |
| Streaming | Markdown renders progressively; the log scrolls itself; `aria-live="polite"` |
| Step trace | `<details>` above the answer: "How I checked (N steps)", each step as "Registered record: queried" plus the query in mono |
| Error | One red line inside the assistant turn; the conversation stays usable |
| Disabled | Panel header plus one muted line explaining what's missing; the report is unaffected |

The composer is a 2-row textarea plus one button. Enter sends, Shift+Enter adds a line, and the button becomes "Stop" while a response streams.

**Rules**
- User turns render as plain text in an accent bubble, never as Markdown — a pasted broker message must appear exactly as pasted.
- Assistant turns render Markdown with GFM tables; tables scroll horizontally rather than squeezing columns.
- The trace is collapsed by default but always present when steps ran. It is the product's honesty, not a debug panel.

### Checklist item

One row of the printable "Questions to ask the builder" page: an empty tick box, the fact's name, the finding's own sentence, and "Ask for:" the document that settles it. The left border carries severity; an item that exists only because one document says something unconfirmed gets a "not confirmed" badge.

The page is built for paper: A4-friendly width, items that don't break across pages, and a print button that disappears when printing.

### Empty and error states

| Situation | What shows |
| --- | --- |
| No projects | Dashed card: add one in the Studio, then seed |
| No findings for a project | Dashed card that says plainly that an empty report doesn't mean the project is clean |
| Dataset unreachable | Banner: "The report is missing, not clean: try again in a moment" |
| Project not found | Next.js 404 |

The wording matters more than the styling here: silence must never read as approval.

### Banner

Full-width, `--major-bg`, one sentence, used for "showing built-in demo data". Never dismissible; when the condition ends, the banner goes.

---

## Content and voice

- **Sentence case everywhere**, including buttons and badges.
- **Say the number, then the meaning.** "The Brochure says 1,050 sq ft; the RERA registration says 690 sq ft. That's 52% more than the RERA registration."
- **Indian formatting:** `₹81,55,000`, `2.10 acres`, dates as "31 December 2028". Money of zero renders as "₹0 (free)".
- **Name documents by short name** ("Brochure", "RERA registration", "Draft agreement", "RERA Act 2016"), not by type.
- **No blame words.** The UI says what each document says. It never says the builder lied, cheated or misled.
- **Every report ends with the disclaimer.** Not legal advice; check the state RERA portal; a lawyer for large payments.

---

## Accessibility

Measured contrast ratios (WCAG 2.1, normal text needs 4.5):

| Pair | Light | Dark |
| --- | --- | --- |
| Body text on surface | 17.7 | 14.7 |
| Muted text on surface | 5.5 | 7.6 |
| Muted text on row background | 4.8 | 6.7 |
| Link / accent on surface | 8.3 | 9.3 |
| Text on accent button | 8.3 | 9.2 |
| Decorative blue on surface | 6.7 | 8.2 |
| Critical on critical background | 5.8 | 5.6 |
| Major on major background | 4.9 | 7.7 |
| Minor on minor background | 7.2 | 6.4 |
| Match green on its background | 6.0 | 8.4 |

Everything passes AA; the lowest pair is 4.8 in light and 5.6 in dark.

- **Never colour alone.** Every tone is paired with a word: "✓ agrees", "✗ doesn't match", "Against the law".
- **Focus** is a 2px `--accent` outline with 2px offset on every link, button, textarea and disclosure.
- **Keyboard:** disclosures toggle with Enter or Space, Enter sends a chat message, Shift+Enter inserts a newline, Stop is reachable by Tab while streaming.
- **Screen readers:** the chat log is `aria-live="polite"`; the panel is `aria-label="Ask Home Truth"`; the findings list is `aria-label="Findings"`; the textarea is labelled.
- **Touch targets** are at least 44px in the chat; card links are large.
- **Dark mode** follows the system setting only. There's no toggle yet.

---

## Print

Printing switches every token to black on white, drops the header, chat, buttons and links, and keeps cards from breaking across pages. The checklist is the page designed to be printed. The report prints too, but without the quote disclosures: a closed `<details>` can't be opened from CSS, so paper gets the findings and the checklist gets the evidence.

## Known gaps

1. **No loading skeleton** on the report. It's server-rendered, so a slow query means a blank wait.
2. **Trace detail is raw GROQ.** Fine for judges and developers; a buyer sees a query they can't read.
3. **No dark-mode toggle**, and no way to force light mode for a screenshot.
4. **Devanagari untested.** Hindi and Marathi need line-height and font-stack checks before the P1 translation work.
5. **Printed report drops quotes.** Acceptable for now because the checklist carries what a buyer needs; a print-only expanded copy would fix it.
6. **3D untested on low-end phones.** The scene is small (about 30 boxes, one shadow-casting light) but it hasn't been measured on a budget Android device, which is what many buyers will use.
7. **The tower only covers floors.** Carpet area and unregistered amenities deserve the same treatment and currently get bars and lists.

---

## Extending it

- **New severity or status:** add it to the union in `studio/lib/compare.ts`, to `STATUS_LABEL`/`SEVERITY_LABEL` in `FindingCard.tsx`, and to the CSS classes. Three places, on purpose: the data, the words, the paint.
- **New colour:** add the token to both `:root` blocks before using it. A hardcoded hex in a component is a bug.
- **New component:** reuse `.badge`, `.entry` and `.score` before inventing a pattern; they cover most of what a report needs.
