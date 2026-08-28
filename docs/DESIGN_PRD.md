# RoomScout — Product & Design Requirements Document

Status: design handoff for the first working product slice · 2026-08-27

This document is both a product/design brief and a handoff prompt for Claude
Design. It describes the intended experience, information architecture,
interaction model, visual direction, reusable components, required states, and
technical constraints for the frontend scaffold.

For frontend product and UX decisions, this document reflects the latest agreed
direction and takes precedence over earlier exploratory surface descriptions in
`PLAN.md`, `PRODUCT_EXPLORATION.md`, and `IMPLEMENTATION_PLAN.md`. Those documents
remain useful background and technical exploration, but they should not override
the Scout-first experience or add screens to this design scope.

The output should feel like a real consumer product for musicians, not an admin
demo wrapped around crawling infrastructure. The web index provides the
substance; a focused AI scout provides the personal interface; a deliberately
thin operations workspace keeps the system trustworthy and controllable.

The intended authentication implementation is **Convex Auth v2 Alpha**. This is
a deliberate hackathon experiment: the team accepts alpha-level change risk in
exchange for testing the newest Convex-native auth path. The design scaffold
should represent the flows with mock state; the separate backend implementation
will install, pin, and validate the actual alpha package before integration.

---

## 1. Product summary

### Working name

**RoomScout**

### One-line promise

> Find a rehearsal room without repeating the same search across twenty
> fragmented websites.

### Expanded promise

RoomScout maintains a current, provenance-aware index of publicly visible
rehearsal-room supply and demand. A musician can explore the market, describe
their room need conversationally, save a structured search, receive relevant
new signals, and approve precisely controlled outreach without managing a
manual email marathon.

### Product shape

RoomScout has three connected surfaces:

1. **Market Index — the substance.** Publicly searchable room offers and room-
   wanted signals, with source, freshness, known facts, unknowns, and original
   links.
2. **Room Scout — the personal interface.** A focused AI companion that turns a
   conversation into an editable search card, explains and prioritizes new
   signals, and proposes outreach drafts.
3. **Operations — the control plane.** A restricted workspace for reviewing
   signals, monitoring a small source set, approving operator-led outreach, and
   handling email replies.

The Scout is not a general-purpose music chatbot. Every Scout interaction must
advance one of three jobs:

- create or refine the user's rehearsal-room search,
- explain and prioritize a market signal,
- prepare a concrete outreach draft for approval.

### Initial geography

Design the first coherent dataset around **Stuttgart, Germany**. The interface
must not feel permanently limited to Stuttgart; city and region are normal data
dimensions so that Germany and later Europe can be added without redesigning
the product.

### Primary demo language

Use **English UI copy** for the hackathon and design handoff. Source titles,
listings, and email content may naturally contain German. The layout must
tolerate longer German labels, and the design should be ready for later
localization without including a language switcher in the first slice.

---

## 2. Product goals

### User goals

A musician or band should be able to:

- understand RoomScout's value before signing in,
- search recent public rehearsal-room signals in one place,
- distinguish available-room supply from room-seeking demand,
- judge whether a signal is useful based on location, budget, timing,
  equipment, source, freshness, and verification status,
- explain their own need in natural language,
- review and edit what the Scout understood,
- save one active search and see its current status,
- understand why a new signal may or may not fit,
- draft a message to an appropriate contact,
- approve the exact recipient and final content before sending,
- see replies in a focused inbox linked to the relevant search and signal.

### Business/product goals

The experience should demonstrate that:

- fragmented public information becomes more useful when normalized and kept
  current,
- the product remains useful before it has a large member network,
- AI performs visible, bounded work rather than appearing as a decorative chat
  box,
- live updates create a sense of a continuously operating market radar,
- external communication is controlled and trustworthy,
- operational complexity exists behind the scenes without dominating the
  musician-facing story.

### Hackathon presentation goals

Within a short demo, a viewer should understand this sequence without a verbal
architecture lecture:

```text
Scout conversation
  -> visible structured search card
  -> relevant market signals
  -> a newly detected signal appears live
  -> Scout explains why it fits
  -> exact recipient and message are approved
  -> message is sent
  -> reply appears and is parsed in the Inbox
```

---

## 3. Non-goals for the first design

Do not turn the initial product into any of the following:

- a generic AI chat product,
- a full booking marketplace or payment flow,
- a social network or public band-profile directory,
- a general musician-matching app,
- a large CRM or cold-email campaign tool,
- an analytics-first heatmap product,
- a developer-facing crawler dashboard,
- a fictional promise to contain every rehearsal room,
- a fully featured source-onboarding system,
- an autonomous system that sends messages without approval.

Compatible-band introductions, room-sharing groups, maps, embeddings, and
multi-party coordination may be represented as future-ready concepts, but they
must not crowd the core navigation or appear as already delivered features.

---

## 4. Product principles

### 4.1 Structured truth, conversational input

Conversation may be the easiest way to describe a messy need, but the result
must always become visible, editable structure. Never leave important user
preferences hidden only in chat history.

### 4.2 Source-aware, not magically omniscient

Every market signal needs visible provenance and freshness. Use language such
as "last checked 18 minutes ago" rather than vague claims such as "available
now" unless availability is actually verified.

### 4.3 Observed is not verified

The interface must distinguish:

- **Observed public signal:** found on a public source; the person or listing is
  not necessarily a RoomScout member.
- **User-verified need:** created or claimed by a signed-in user who has
  confirmed it is current.
- **Operator/source verified:** reviewed or confirmed through an appropriate
  source or response.

Do not expose scraped private identities or imply that an observed demand signal
can automatically be contacted through RoomScout.

### 4.4 AI proposes; people decide

The Scout can interpret, explain, prioritize, and draft. It cannot silently
change the user's requirements, contact someone, or introduce parties.

### 4.5 Every external message has a visible gate

Before sending, show:

- the exact recipient or recipients,
- the exact subject,
- the complete final message,
- which search/signal the message belongs to,
- a clear approval acknowledgement,
- one unambiguous send action.

### 4.6 Honest incompleteness

Unknown budget, unclear equipment, an old timestamp, or conflicting source facts
should be shown as useful uncertainty—not filled with invented values.

### 4.7 Progressive disclosure

Musicians need useful results and next actions. Operators need ingestion and
source detail. Do not place operational metadata in the primary musician flow
unless it helps assess trust or relevance.

### 4.8 Public discovery, authenticated ownership

Browsing the public market index does not require an account. Authentication is
introduced only when a person wants RoomScout to own durable or private state:

- save or activate a search,
- continue a persistent Scout thread,
- receive alerts,
- approve outreach,
- access external correspondence in Inbox.

The first implementation will try Convex Auth v2 Alpha with **Username +
Password**. Passkeys may be added later. Anonymous auth must not be the primary
identity for approvals, Inbox access, or operator actions because these require
a stable accountable user.

---

## 5. Users and roles

### 5.1 Visitor

Someone who has not signed in.

Needs:

- understand the product quickly,
- search and filter public signals,
- inspect a signal and its original source,
- see that the index is current and transparent.

Limitations:

- cannot save a search,
- cannot receive alerts,
- cannot create or send outreach,
- cannot access private Inbox content.

### 5.2 Musician or band representative

The primary product user. One account may represent an individual musician or a
band's room search; avoid forcing a complex organization model in onboarding.

Needs:

- create and maintain a room need,
- explore and save signals,
- receive focused suggestions,
- ask the Scout why something fits,
- approve outreach,
- handle replies.

### 5.3 RoomScout operator

A restricted administrative role.

Needs:

- see whether the live system is healthy,
- review new or questionable signals,
- distinguish ingestion issues from actual market changes,
- operate approved outreach safely,
- see and route incoming replies,
- inspect the audit trail for approvals and sends.

Do not mix operator navigation into the normal musician sidebar. If one person
has both roles, provide an explicit workspace switch in the account menu.

---

## 6. Information architecture and routes

Build a client-side React SPA with three route groups.

### Public routes

| Route | Purpose |
|---|---|
| `/` | Landing page with primary search, current index evidence, sample results, and trust explanation |
| `/explore` | Full list-first market explorer with filters and supply/demand segmentation |
| `/signals/:signalId` | Signal detail with normalized facts, provenance, freshness, unknowns, and action options |
| `/sign-in` | Username/password sign-in with preserved return destination and search context |
| `/sign-up` | Minimal account creation before a durable musician action |

### Signed-in musician routes

| Route | Primary navigation label | Purpose |
|---|---|---|
| `/app/scout` | Scout | Default home; conversation, active search summary, new suggestions, and next actions |
| `/app/explore` | Explore | Authenticated version of the market explorer with save and Scout actions |
| `/app/search` | My search | Structured need, alert status, suggestions, dismissed items, and search history |
| `/app/inbox` | Inbox | External communication threads tied to searches and signals |
| `/app/profile` | Profile | Minimal account/band identity and communication preferences |

### Operator routes

| Route | Primary navigation label | Purpose |
|---|---|---|
| `/ops` | Overview | Operational snapshot, live activity, and queues needing attention |
| `/ops/signals` | Signals | Review new, changed, stale, conflicting, or duplicate signal candidates |
| `/ops/sources` | Sources | Compact health/status list for the initial reviewed source cohort |
| `/ops/outreach` | Outreach | Drafts, approval state, sending status, and follow-up state |
| `/ops/inbox` | Inbox | All external AgentMail-style threads with search/signal context |
| `/ops/audit` | Audit | Approval and delivery events; secondary priority |

The first frontend scaffold should use mock route guards and mock identity while
matching the intended Convex Auth states. Do not implement Next.js routing or
server routes. After successful sign-in or account creation, return the user to
the exact interrupted action with their current query/search draft preserved.

---

## 7. Global navigation

### Public header

Keep the public header minimal:

- RoomScout wordmark or simple symbol + wordmark,
- Explore,
- "How it works" anchor on the landing page,
- Sign in,
- primary CTA: "Start my search".

### Musician application shell

Desktop sidebar:

```text
RoomScout

Scout
Explore
My search
Inbox                 [unread count]

-------------------
Profile
Account menu
```

Requirements:

- Scout is the signed-in default route.
- Keep the active item obvious without relying only on color.
- Show Inbox unread count only when nonzero.
- Account menu contains workspace switch for operators, theme preference if
  provided, and sign out.
- Do not create separate Dashboard, Matches, Alerts, or Notifications menu
  items in the first slice. Their relevant content belongs to Scout, My search,
  or Inbox.

Mobile bottom navigation:

- Scout,
- Explore,
- My search,
- Inbox.

Profile and account actions move to the top-right account menu.

### Operator shell

Use a visually related but clearly distinct workspace labeled **RoomScout Ops**.

Desktop sidebar:

```text
RoomScout Ops

Overview
Signals
Sources
Outreach
Inbox                 [needs attention count]

-------------------
Audit log
Switch to RoomScout
Account menu
```

The Ops workspace may be denser than the user application but should retain the
same typography, tokens, badges, buttons, and interaction conventions.

---

## 8. Core user flows

### Flow A — Visitor searches before signing in

1. Visitor opens `/`.
2. Hero asks for city or region, prefilled with or suggesting Stuttgart.
3. Visitor searches and lands on `/explore?location=Stuttgart`.
4. Results show both supply and demand with a clear segmented control.
5. Visitor opens a signal detail.
6. Visitor can visit the original source immediately.
7. "Save this search" or "Ask Room Scout" opens a lightweight sign-in gate.
8. After sign-in, preserve the current search context and continue onboarding.

Design requirement: authentication must not discard the user's query or make
them repeat their work.

### Flow B — Scout-led onboarding

1. New signed-in user enters `/app/scout`.
2. Scout asks one broad opening question, for example:
   "Tell me what kind of rehearsal room you are looking for."
3. User replies naturally.
4. Scout extracts known requirements and shows a live draft search card beside
   or directly below the conversation.
5. Scout asks only for high-value missing information and skips topics already
   covered.
6. User can edit any field directly on the card.
7. User confirms the card.
8. Search becomes active and the first relevant signals appear immediately.

Do not enforce a visible multi-step wizard or exactly five conversation turns.
Show progress as search completeness, not "Step 2 of 5."

### Flow C — Review a signal with the Scout

1. A new or existing signal appears as a recommendation.
2. Card explains the top two or three fit reasons and the main uncertainty.
3. User opens the detail or asks the Scout about it.
4. Scout responds using only known signal and search facts.
5. Suggested actions can include:
   - open original source,
   - save for later,
   - dismiss with optional reason,
   - update search preferences,
   - draft an inquiry when an appropriate contact route exists.

### Flow D — Approve and send outreach

1. User chooses "Draft inquiry."
2. Scout produces a draft and explains any assumptions.
3. Approval composer opens as a modal on desktop and a full-height sheet on
   mobile.
4. User reviews or edits exact recipient, subject, and message.
5. User checks an explicit acknowledgement such as:
   "I approve this exact recipient and message."
6. Primary action changes from disabled to "Approve & send."
7. Sending state is visible and cannot be triggered twice.
8. Success creates or updates an Inbox thread linked to the signal and search.

### Flow E — Receive and handle a reply

1. A reply appears in Inbox in realtime.
2. Thread displays the original approved message and incoming response.
3. Scout-generated extraction appears as a secondary summary, not as a
   replacement for the original email.
4. Example extracted facts:
   - no fixed room currently available,
   - Wednesday evening may open next month,
   - price unknown,
   - follow-up requested.
5. User may update their search, archive the thread, or request a reply draft.
6. Any reply draft repeats the exact approval flow before sending.

### Flow F — Operator reviews a live ingestion event

1. Ops Overview shows a recent new/changed event.
2. Operator opens the signal candidate.
3. Side-by-side or stacked evidence shows extracted fields and source excerpt.
4. Operator accepts, edits, marks duplicate, or suppresses the candidate.
5. Accepted signal appears in public/user views through a live state update.

The UI should make this flow demo-friendly without looking like a developer log.

### Flow G — Authentication without losing context

1. A visitor browses freely without an account.
2. They choose a durable/private action such as `Save this search`, `Start my
   Scout`, or `Draft inquiry`.
3. A login gate explains why an account is required and offers `Sign in` and
   `Create account`.
4. The current route, filters, selected signal, and any draft search text remain
   preserved.
5. User signs in or creates an account with username and password.
6. On success, the interrupted action resumes instead of returning to a generic
   dashboard.
7. Signed-in identity owns the resulting search, Scout thread, approvals, and
   Inbox threads.

Do not require authentication merely to open public source information. Do not
offer operator role selection during sign-up; operator access is assigned and
enforced by the backend.

---

## 9. Screen requirements

### 9.1 Landing page `/`

Purpose: communicate the user problem, provide immediate value, and establish
trust in under ten seconds.

Required sections:

1. **Header** with brand, Explore, How it works, Sign in, Start my search.
2. **Hero** with concise value proposition and a prominent location search.
3. **Live index proof** such as:
   - current public signals,
   - reviewed sources,
   - most recent check.
4. **Recent signals preview** with a balanced example of supply and demand.
5. **How it works** in three steps:
   - RoomScout watches fragmented public sources,
   - your Scout learns what you need,
   - you review every external action.
6. **Trust/provenance block** explaining freshness and original-source links.
7. **Final CTA** to start a search.

Suggested hero copy:

> **Stop searching the same twenty websites.**
>
> RoomScout watches the fragmented rehearsal-room market and tells you when a
> relevant signal appears.

Primary input placeholder: `City or region, e.g. Stuttgart`

Primary CTA: `Search rehearsal rooms`

Secondary CTA: `Meet your Room Scout`

Avoid inflated claims such as "every rehearsal room in one place."

### 9.2 Market Explorer `/explore` and `/app/explore`

Purpose: make heterogeneous signals comparable without hiding their origin.

Desktop composition:

```text
Page title and index freshness
Search location input
Supply | Demand segmented control
Filter bar

Left: filter panel (optional at large widths)
Right: result count, sort, bounded result list
```

Required filters, shown only if supported by the mock data:

- city/area,
- monthly vs hourly arrangement,
- budget range,
- availability or preferred times,
- equipment/features,
- freshness,
- verified/observed status.

Default sort: `Most relevant`, with `Newest` as an option.

Each result card should show:

- Supply or Demand label,
- title,
- city/neighborhood,
- price or `Budget unknown`,
- arrangement type,
- up to three high-value attributes,
- source name,
- `Last checked` or `Last seen`,
- verification/observation state,
- saved state for signed-in users,
- a short fit explanation when an active search exists.

Do not make a map necessary for the initial experience. Claude Design may
explore a list/map toggle as an optional secondary concept, but the list-first
design must be complete and excellent on its own.

### 9.3 Signal detail `/signals/:signalId`

Purpose: allow a user to decide whether a source signal is credible and useful.

Required structure:

- breadcrumb/back action,
- Supply or Demand label,
- title and location,
- primary facts grid,
- plain-language normalized summary,
- fit panel when an active search exists,
- unknown or conflicting information block,
- freshness timeline: first seen, last seen, last checked,
- source/provenance card with original-source action,
- save, dismiss, and Scout actions,
- inquiry action only when a valid contact route exists.

For observed demand, never expose private contact details or suggest that the
poster is a RoomScout member. Use copy such as:

> Public room-wanted signal observed on Musikerbörse. The original poster has
> not verified this need on RoomScout.

### 9.4 Scout onboarding `/app/scout`

Purpose: produce a confirmed structured search without making the user complete
a bureaucratic form.

Desktop layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Scout header: current mode, subtle status                  │
├───────────────────────────────┬────────────────────────────┤
│ Conversation                  │ Draft search card          │
│                               │                            │
│ Scout/user messages           │ Location                   │
│ prompt suggestions            │ Budget                     │
│ composer                      │ Schedule                   │
│                               │ Room/equipment needs       │
│                               │ Sharing flexibility        │
│                               │                            │
│                               │ Edit / Confirm             │
└───────────────────────────────┴────────────────────────────┘
```

On smaller screens, conversation and card stack. The latest card summary should
remain easy to reopen while typing.

Required behaviors:

- show a warm, focused initial prompt,
- provide two or three optional prompt starters,
- show extraction/progress without fake model theatrics,
- animate newly extracted fields subtly,
- distinguish explicit user statements from Scout suggestions,
- let users edit fields directly,
- require confirmation before activating the search,
- allow `I don't know yet` for nonessential fields.

Suggested prompt starters:

- `We need a permanent room for our band`
- `I need an affordable room for weekly practice`
- `Show me what is available around Stuttgart`

The search card should support these initial fields:

- search title,
- musician/band name, optional,
- location and acceptable radius,
- fixed monthly room vs hourly practice vs flexible,
- maximum monthly/hourly budget,
- preferred days/times,
- band size,
- essential equipment/features,
- access/noise/storage constraints,
- optional willingness to share,
- alert preference.

Not every field must be present before confirmation. Show a useful completeness
indicator based on what materially improves results.

### 9.5 Scout home after onboarding `/app/scout`

Purpose: answer "What changed, what matters, and what should I do next?"

Required content hierarchy:

1. Brief contextual greeting.
2. Active search summary with edit action.
3. Scout update, for example:
   "I found three new signals since Monday. One looks especially relevant."
4. One primary recommended signal with fit reasons and uncertainty.
5. Secondary recent suggestions.
6. Compact activity timeline: saved, dismissed, inquiry sent, reply received.
7. Persistent Scout composer.

Avoid a generic KPI dashboard. This page is an actionable briefing from the
Scout, not an analytics homepage.

### 9.6 My Search `/app/search`

Purpose: give the user explicit control over the structured state behind the
Scout conversation.

Required sections:

- active/inactive status,
- editable structured search card,
- alert channel and cadence,
- result summary,
- new, saved, and dismissed signal tabs or segments,
- search activity/history,
- pause search action,
- delete search as a deliberately secondary/destructive action.

Support one active search cleanly before designing multi-search management.

### 9.7 Approval composer

Purpose: make human authorization unmistakable without creating unnecessary
friction.

Use modal on wide screens and full-height sheet on mobile.

Required fields and information:

- `To` recipient with source/context,
- optional `Cc` only if genuinely required,
- subject,
- complete editable message,
- linked search and signal,
- note describing what will happen after approval,
- explicit approval checkbox,
- disabled primary button until valid,
- cancel/back action,
- sending, success, retry, and already-sent states.

Primary action wording: `Approve & send`

Approval acknowledgement:

> I approve this exact recipient and message.

Never use a vague action such as `Continue` for the final send transition.

### 9.8 Musician Inbox `/app/inbox`

Purpose: show external correspondence without confusing it with the Scout chat.

Desktop layout:

```text
Thread list | Conversation | Context panel
```

Required thread-list information:

- correspondent/organization,
- related signal or room,
- last-message preview,
- timestamp,
- unread/status marker,
- awaiting-user-action marker when relevant.

Conversation requirements:

- visually distinguish user-approved outbound email from inbound email,
- display delivery status unobtrusively,
- preserve original message content,
- show parsed Scout summary as a separate card,
- provide `Ask Scout`, `Draft reply`, `Update search`, and `Archive` actions,
- link back to the relevant signal and approval event.

Context panel:

- related search,
- signal summary,
- known facts changed by the reply,
- communication status,
- last approved recipient/content metadata without exposing internal IDs.

### 9.9 Profile `/app/profile`

Keep this page intentionally small:

- display name,
- optional band name,
- home city,
- email address/status,
- alert preferences,
- consent/visibility settings that actually exist,
- account actions.

Do not build a public social profile editor in this slice.

### 9.10 Ops Overview `/ops`

Purpose: show a human operator what needs attention now.

Top-level cards may include:

- new signals,
- needs review,
- pending approvals,
- awaiting replies,
- degraded sources.

Below the summary, prioritize work queues:

- signal review queue,
- recent live activity,
- outreach needing approval or follow-up,
- source failures.

Use metrics as navigation into work, not vanity charts. A small activity stream
can visibly demonstrate Firecrawl event -> normalization -> published signal ->
user update without exposing raw developer logs.

### 9.11 Ops Signals `/ops/signals`

Purpose: review exceptions and data quality, not manually curate every healthy
record.

Required features:

- status filters: new, changed, needs review, possible duplicate, published,
  suppressed,
- supply/demand filter,
- source and recency filters,
- table or dense card list,
- review drawer with normalized fields and source evidence,
- actions: accept, edit, mark duplicate, suppress,
- reason required for suppression or destructive merges.

Design a strong side drawer or detail pane so reviewing multiple items remains
fast.

### 9.12 Ops Sources `/ops/sources`

Purpose: provide enough source transparency for a small curated cohort without
becoming an infrastructure console.

Required columns/cards:

- source name and domain,
- signal side: supply, demand, or mixed,
- active/paused/degraded status,
- last successful check,
- new/changed/error counts,
- monitoring pattern label,
- review-needed indicator.

Source detail may show recent checks and extraction version. Do not design a
large multi-step source onboarding wizard in the first slice.

### 9.13 Ops Outreach `/ops/outreach`

Purpose: operate controlled communication, not bulk campaigns.

Required queues:

- drafts,
- awaiting approval,
- approved/sending,
- sent/awaiting reply,
- replied,
- failed/needs attention.

Each outreach record should show:

- recipient,
- purpose,
- linked signal/search,
- owner/requesting user,
- current approval and delivery state,
- last action time.

Use the same approval composer as the musician flow. Do not include a "send all"
action.

### 9.14 Ops Inbox `/ops/inbox`

Purpose: manage all inbound and outbound external threads with context.

Reuse the musician Inbox structure with additional operator tools:

- assignment/owner,
- needs-review status,
- parsing status,
- link to outreach approval and audit events,
- internal note area clearly separated from email content,
- route to user or archive.

### 9.15 Authentication screens and login gate

Purpose: establish a stable identity at the moment a user asks RoomScout to keep
private or durable state, without interrupting public discovery prematurely.

Required surfaces:

1. **Login gate dialog/sheet**
   - triggered by a protected action rather than initial page load,
   - briefly explains what will be saved or unlocked,
   - offers `Sign in` and `Create account`,
   - includes `Not now`/close without losing public browsing state,
   - reassures the user that their current search will be preserved.
2. **Sign in `/sign-in`**
   - username,
   - password with visibility toggle,
   - submit and submitting states,
   - invalid-credentials and network-error states,
   - link to create an account,
   - clear return-to-product context such as `Continue saving your Stuttgart
     search` when applicable.
3. **Create account `/sign-up`**
   - username,
   - password,
   - password confirmation or an equally clear confirmation pattern,
   - concise password requirements,
   - submit and error states,
   - link to sign in,
   - no musician profile questionnaire before the account exists.

This is a username/password hackathon flow targeting Convex Auth v2 Alpha. Do
not add social login, magic-link, passkey, password-reset, email-verification, or
organization-management screens to the Priority 0 scaffold. The visual
components should remain extensible enough to add another provider later.

Required auth/application states:

- loading current session,
- unauthenticated,
- authenticating,
- authenticated musician,
- authenticated operator,
- expired/invalid session with preserved unsent work,
- signed in but unauthorized for `/ops`,
- sign-out confirmation only when unsent draft work would otherwise be lost.

Authorization is not a visual route-guard feature. The design may mock roles,
but the later Convex implementation must enforce musician ownership and operator
permissions inside backend functions.

---

## 10. Scout interaction model

The Scout should feel like a capable human connector with excellent memory, not
like a mascot or a freeform assistant.

### Mode 1 — Search discovery

**Goal:** turn conversation into a confirmed search card.

Allowed behavior:

- ask one focused question at a time,
- extract explicit preferences,
- point out missing high-value information,
- suggest values when the user is unsure,
- summarize and ask for confirmation,
- allow direct edits.

Forbidden behavior:

- propose external outreach before the search is understood,
- invent preferences,
- force every optional field,
- start general music/career/gear conversation,
- imply that results are guaranteed.

### Mode 2 — Signal advisor

**Goal:** explain whether a specific signal deserves attention.

Allowed behavior:

- compare signal facts with confirmed search fields,
- explain fit reasons and conflicts,
- state uncertainty and stale information,
- recommend save, dismiss, source visit, search edit, or inquiry draft.

Forbidden behavior:

- invent missing availability or pricing,
- hide conflicts merely to sound helpful,
- claim an observed person is a RoomScout member,
- contact anyone.

### Mode 3 — Outreach drafting

**Goal:** prepare a useful message for a specific approved context.

Allowed behavior:

- draft from known search and signal facts,
- ask for one missing fact if necessary,
- show assumptions,
- revise tone or content,
- open the approval composer.

Forbidden behavior:

- choose additional recipients silently,
- send automatically,
- create pressure or deceptive urgency,
- disclose private user facts irrelevant to the request.

### Tone

- warm, concise, curious,
- comfortable with musicians without trying too hard to sound cool,
- honest about gaps,
- action-oriented,
- matches the user's language when possible,
- avoids corporate phrasing and excessive enthusiasm.

Good:

> This room matches your budget and location, but the listing does not mention
> storage. Want me to draft a short question about that?

Bad:

> Amazing news! I found the perfect dream space for your musical journey!

---

## 11. Shared component inventory

Claude Design should create reusable components rather than page-specific
markup wherever practical.

### Shell and navigation

- `PublicHeader`
- `UserAppShell`
- `OpsAppShell`
- `SidebarNav`
- `MobileBottomNav`
- `AccountMenu`
- `PageHeader`

### Market signals

- `SignalCard`
- `SignalTypeBadge`
- `VerificationBadge`
- `FreshnessBadge`
- `SignalFactsGrid`
- `ProvenanceCard`
- `FitReasonList`
- `UncertaintyNotice`
- `SignalFilters`
- `SavedSignalButton`

### Scout and search

- `ScoutConversation`
- `ScoutMessage`
- `ScoutComposer`
- `PromptSuggestion`
- `SearchProfileCard`
- `EditableSearchField`
- `SearchCompleteness`
- `ScoutRecommendationCard`
- `ActivityTimeline`

### Communication

- `ApprovalComposer`
- `ApprovalAcknowledgement`
- `ThreadList`
- `ThreadListItem`
- `MailConversation`
- `MailMessage`
- `ParsedReplyCard`
- `DeliveryStatus`
- `CommunicationContextPanel`

### Operations

- `OpsMetricCard`
- `ReviewQueue`
- `SignalReviewDrawer`
- `SourceHealthRow`
- `OutreachStatusBadge`
- `LiveActivityStream`
- `AuditEventRow`

### Primitives

- buttons with clear hierarchy,
- inputs, textarea, select, combobox,
- segmented control,
- tabs,
- badges,
- tooltip,
- dialog/modal,
- mobile sheet,
- drawer,
- toast,
- skeleton,
- empty state,
- error state,
- confirmation dialog.

---

## 12. State vocabulary

Use consistent product language across cards, filters, badges, and detail views.

### Signal type

- `Supply`
- `Demand`

### Signal lifecycle

- `New`
- `Current`
- `Changed`
- `Possibly stale`
- `Removed at source`
- `Needs review`

### Verification

- `Observed public signal`
- `User verified`
- `Source verified`
- `Operator reviewed`

Verification and freshness are separate concepts. A user-verified need can
become old; a freshly observed listing is not automatically verified.

### Outreach lifecycle

```text
Draft
  -> Awaiting approval
  -> Approved
  -> Sending
  -> Sent
  -> Replied
  -> Parsed
```

Exception states:

- `Send failed`
- `Parsing needs review`
- `Cancelled`
- `Expired`

### Search lifecycle

- `Draft`
- `Active`
- `Paused`
- `Archived`

### Source health

- `Healthy`
- `Degraded`
- `Paused`
- `Needs review`

Do not rely on color alone for any state.

---

## 13. Empty, loading, error, and edge states

Claude Design must include representative states, not only ideal populated
screens.

### Required user-facing states

- no active search yet,
- Scout processing/extracting without fake typing delays,
- draft search with missing high-value information,
- no matching signals,
- some signals hidden by current filters,
- signal removed or no longer present at source,
- source unavailable during latest check,
- no Inbox threads,
- waiting for reply,
- incoming reply not yet parsed,
- outreach send failed,
- duplicate send prevented,
- expired approval after message content changed,
- realtime connection temporarily interrupted.

### Required Ops states

- review queue empty,
- source degraded,
- extraction changed,
- possible duplicate,
- invalid or incomplete candidate,
- communication awaiting approval,
- webhook/reply processing delayed,
- no operator action required.

Error copy should state what happened, whether user data/action was preserved,
and the available next step.

---

## 14. Visual direction

### Desired character

RoomScout should feel:

- useful and quietly intelligent,
- urban and connected to real rehearsal culture,
- warm enough for musicians,
- precise enough to trust with communication,
- alive through freshness and activity,
- editorial rather than corporate,
- contemporary without looking like a generic AI startup.

### Avoid

- purple/blue AI gradients,
- glowing robot imagery,
- excessive glassmorphism,
- generic map-pin branding,
- dark nightclub clichés,
- loud festival-poster styling that harms data readability,
- sterile enterprise CRM density on user pages,
- fake charts and vanity metrics,
- excessive rounded cards floating inside other rounded cards.

### Suggested visual concept: "living signal board"

Combine a warm editorial base with precise signal/status elements:

- warm off-white or lightly tinted canvas,
- near-black charcoal text,
- clean white or subtly tinted functional surfaces,
- one vivid signal accent used sparingly,
- a restrained secondary accent for Scout presence,
- monospaced or tabular treatment for timestamps, source metadata, and status,
- strong modern grotesk/sans-serif for product copy,
- thin dividers and deliberate whitespace,
- small motion cues when a live signal arrives or a field is extracted.

Suggested starting tokens, open to refinement if contrast is preserved:

```text
Canvas:        warm off-white around #F4F1EA
Surface:       #FFFFFF
Primary ink:   near-black around #171A17
Muted ink:     neutral gray-green
Signal accent: acidic lime/chartreuse used with dark text
Scout accent:  restrained warm orange or cobalt
Borders:       warm gray with clear contrast
```

Do not use the signal accent as body text on white. All final color combinations
must meet accessible contrast requirements.

### Brand exploration

Explore a simple wordmark and optional compact symbol based on one of these
ideas:

- a scanning line finding a room-shaped opening,
- overlapping signals resolving into one clear space,
- a minimal acoustic/rehearsal-room plan mark,
- an abstract locator without using a standard map pin.

Keep the logo secondary to the product. Do not spend the design effort on a
complex mascot.

---

## 15. Layout and responsive behavior

Design at minimum for:

- desktop around 1440 px,
- compact desktop/tablet around 1024 px,
- mobile around 390 px.

### Desktop

- fixed or sticky sidebar for signed-in workspaces,
- content width appropriate to each job,
- two-column Scout layout,
- three-pane Inbox where space permits,
- table plus detail drawer for Ops review.

### Tablet

- collapsible sidebar,
- Scout card may become a narrower right rail or stacked section,
- Inbox context panel becomes a drawer,
- filters become a sheet.

### Mobile

- bottom navigation for the four core user destinations,
- one primary pane at a time,
- full-height sheets for filters, signal actions, and approval,
- Inbox follows list -> conversation -> context navigation,
- data tables become cards or horizontal-scroll only when unavoidable,
- keep final approval details readable without hidden horizontal content.

Avoid desktop-only hover interactions. Every hover affordance needs a touch and
keyboard equivalent.

---

## 16. Accessibility and usability

Target WCAG 2.2 AA behavior for the scaffold.

Requirements:

- semantic headings and landmarks,
- keyboard-operable navigation, filters, dialogs, drawers, and message composer,
- visible focus treatment,
- meaningful button labels,
- minimum comfortable touch targets,
- error descriptions associated with fields,
- status never communicated by color alone,
- reduced-motion support,
- logical screen-reader reading order in split layouts,
- dialogs trap focus and restore it on close,
- timestamps have readable full forms available,
- icon-only controls include accessible names.

Scout messages must not stream so aggressively that assistive technology is
repeatedly interrupted. Design a calm completed-message state first.

---

## 17. Content and copy guidance

### Product language

Prefer:

- `signal` for a normalized public observation,
- `listing` when the source itself is a listing,
- `search` or `room need` for the user's structured requirement,
- `Scout` for the AI companion,
- `Inbox` for external communication,
- `last checked` and `last seen` for freshness,
- `observed` and `verified` as distinct states.

Avoid:

- `lead`, `prospect`, or sales language in the musician UI,
- `AI-powered` in every headline,
- `perfect match`,
- `available now` without verification,
- `community member` for scraped public demand,
- `campaign` for controlled individual outreach,
- infrastructure words such as webhook, ingestion, embeddings, or cron in user
  surfaces.

### Scout voice examples

Onboarding:

> Tell me what kind of room you need—in your own words. I will turn it into a
> search you can review before anything becomes active.

Signal explanation:

> This looks promising because it is within your budget and in Stuttgart-West.
> The source does not say whether overnight storage is allowed.

Outreach suggestion:

> Want me to draft a short inquiry asking about storage and Tuesday evenings?
> Nothing will be sent until you approve the recipient and final message.

No results:

> I have not found a current signal that meets all of these constraints. The
> narrowest point is your Tuesday-only schedule. You can keep the search active
> or widen that preference.

---

## 18. Synthetic demo content

Use clearly fictional, privacy-safe content. Do not copy real contact details or
verbatim listings.

### Active user search

```text
Title: Permanent room for a four-piece band
Location: Stuttgart, preferably West or South
Radius: 8 km
Arrangement: Fixed monthly room
Budget: Up to €250/month
Schedule: Weekday evenings
Band size: 4
Essential: Drum kit allowed, secure equipment storage
Nice to have: Ground-floor access
Sharing: Open to compatible time-sharing
Status: Active
```

### Example supply signals

1. **Shared rehearsal room in Stuttgart-West**
   - €220/month
   - Tuesday and Thursday evenings
   - Storage mentioned, drum kit unclear
   - Observed today on fictional source `Musikboard Süd`
   - Strong fit with one uncertainty

2. **Hourly equipped practice room in Bad Cannstatt**
   - €20/hour
   - Flexible booking
   - Drum kit and PA included
   - Source verified, checked 45 minutes ago
   - Useful fallback but wrong arrangement type

3. **Basement room near Feuerbach**
   - Price unknown
   - Long-term lease suggested
   - Last seen 11 days ago
   - Possibly stale

### Example demand signals

1. **Post-punk band looking for a fixed room**
   - Stuttgart-West
   - Up to €250/month
   - Weeknight use
   - Observed public signal; not a RoomScout member

2. **Jazz trio seeking daytime rehearsal access**
   - Stuttgart-South
   - Flexible weekdays
   - User-verified need

### Example external thread

Correspondent: `Klangraum West` (fictional)

Approved outbound subject:

`Rehearsal-room availability for a four-piece band`

Incoming reply summary:

- no permanent room currently open,
- Tuesday evenings may become available next month,
- equipment storage is possible,
- operator asks whether the band can share with another group.

The original inbound message must remain visible beside the parsed summary.

---

## 19. Frontend technical constraints

The generated design scaffold must integrate cleanly with the separate RoomScout
backend work.

### Required stack

- React
- Vite
- TypeScript
- Tailwind CSS v4
- client-side routing suitable for a static SPA

### Explicitly do not use

- Next.js,
- SSR,
- React Server Components,
- server actions,
- Next.js API routes,
- a database or backend created inside the design project,
- embedded secrets or real API keys.

### Implementation requirements

- Produce a working frontend scaffold, not only static images.
- Use strict, understandable TypeScript types for display data.
- Keep synthetic fixture data in a dedicated mock-data module.
- Put mock async behavior behind small adapter/service interfaces so it can be
  replaced by Convex queries, mutations, actions, and subscriptions.
- Split screens into reusable components; avoid a single giant `App.tsx`.
- Use CSS variables/design tokens for colors, radii, shadows, and spacing.
- Keep dependencies modest and explain any major UI dependency.
- Lucide or an equivalent consistent icon set is acceptable.
- Do not bind visual components directly to localStorage as the permanent data
  model.
- Do not implement fake backend security. Route guards may be presentation-only
  and clearly marked as mock behavior.
- Preserve route-level loading and error boundaries where practical.
- Make live-update states visually demonstrable using a controlled mock event,
  not random timers that make testing nondeterministic.

### Backend integration seams

Design components should accept data and actions through props/hooks compatible
with these future domains:

- current user and role,
- authentication state, sign-in, sign-up, sign-out, and return-to-intent,
- active saved search,
- market-signal query and filters,
- signal detail and provenance,
- Scout thread and messages,
- Scout send-message action,
- saved/dismissed signal mutations,
- outreach draft and approval mutations,
- mail threads and message subscriptions,
- Ops signal-review mutations,
- source-health query,
- live activity subscription.

The design scaffold should not try to define the final Convex schema.

### Authentication integration target

- Backend target: `@convex-dev/auth@alpha` / Convex Auth v2 Alpha.
- Initial login provider: Username + Password.
- Public index routes remain unauthenticated.
- Saved searches, Scout threads, approvals, and Inbox data require a stable
  authenticated identity.
- Application profile/role data remains distinct from the auth identity.
- Supported application roles for the first slice are `musician` and
  `operator`.
- Operator assignment is backend-controlled, never selected in sign-up.
- The real implementation will pin the tested alpha version rather than depend
  on a floating alpha tag.
- If the alpha proves fundamentally blocking during the explicit auth spike,
  its replacement must preserve the same UI contract and ownership model.

---

## 20. Design deliverables

Claude Design should deliver:

### Priority 0 — required

1. Visual direction and reusable token system.
2. Responsive public landing page.
3. Responsive Market Explorer and result cards.
4. Signal detail page.
5. Scout onboarding with live editable search card.
6. Scout home after onboarding with new-signal briefing.
7. My Search page.
8. Approval composer with review, sending, success, and failure states.
9. Musician Inbox with thread list, message view, parsed reply, and context.
10. Ops Overview.
11. Ops Signals review queue and review drawer.
12. Thin Ops Outreach and Ops Inbox views.
13. Mobile adaptations for the core musician flow.
14. Login gate, Sign in, and Create account screens with preserved
    return-to-intent behavior represented in mock state.
15. Working React/Vite/TypeScript/Tailwind scaffold using deterministic mock
    data.

### Priority 1 — useful if time permits

1. Compact Sources page.
2. Profile/preferences page.
3. Audit timeline.
4. Optional list/map toggle exploration without making the map primary.
5. Dark-mode exploration only if it does not delay the primary light/warm
   visual system.

### Not required in the design scaffold

- live Convex Auth wiring,
- social login, magic links, passkeys, password reset, or email verification,
- real email sending,
- real AI responses,
- real Firecrawl monitoring,
- production data tables,
- complex charts,
- band-to-band matching UI,
- booking or payment UI.

---

## 21. Acceptance criteria

The design handoff is successful when:

- a first-time visitor can explain RoomScout after seeing the landing hero and
  first results,
- the difference between Supply and Demand is immediately understandable,
- source and freshness information is visible without overwhelming each card,
- the Scout visibly produces a structured, editable search,
- the Scout appears focused on the three defined jobs,
- the signed-in home answers what changed and what to do next,
- Scout chat cannot be confused with external Inbox communication,
- public browsing works without login and protected actions explain why an
  account is needed,
- sign-in/account creation visibly preserves and resumes the interrupted user
  intent,
- the interface never lets a user select or grant themselves operator access,
- no external message appears to send without exact approval,
- an incoming reply can be understood in original and parsed form,
- the user and Ops workspaces feel related but clearly distinct,
- the main user flow works on mobile,
- empty/error/loading/uncertainty states feel designed rather than incidental,
- the code runs as a React/Vite static SPA,
- mock data and backend integration seams are clean enough for a Convex backend
  to replace them without redesigning the components.

---

## 22. Recommended design sequence

Use this order to prevent the Ops interface from defining the whole product:

1. Establish visual language through the public result card and Scout search
   card.
2. Design Scout onboarding and the confirmed-search state.
3. Design the Market Explorer and Signal Detail around the same primitives.
4. Design the focused signed-in Scout home.
5. Design Approval and Musician Inbox as one continuous communication flow.
6. Adapt the core user flow to mobile.
7. Derive the denser Ops workspace from the established design system.
8. Add edge states and polish the deterministic demo path.

---

## 23. Copy-paste master prompt for Claude Design

The complete document above is the source of truth. The following condensed
prompt can be pasted before attaching or providing this PRD:

```text
Design and scaffold the frontend for RoomScout using the attached Product &
Design Requirements Document as the source of truth.

RoomScout helps musicians find rehearsal rooms across a fragmented online
market. Its product model is: Market Index as the substance, a focused AI Room
Scout as the personal interface, and a thin restricted Operations workspace as
the control plane.

The Room Scout has exactly three jobs:
1. turn conversation into a visible, editable rehearsal-room search card,
2. explain and prioritize new supply or demand signals,
3. propose a specific outreach draft.

It is not a general music chatbot. No message may appear to send automatically.
The final recipient, subject, and complete message must be shown in an explicit
approval composer before the “Approve & send” action becomes available. Scout
chat and the external email Inbox are separate surfaces.

Public browsing must work without an account. When a visitor saves a search,
starts a persistent Scout thread, approves outreach, or enters Inbox, introduce
a focused login gate and preserve their exact interrupted intent. Design Sign
in and Create account for Username + Password. The backend target is Convex Auth
v2 Alpha, but keep auth mocked in the design scaffold; do not add a backend,
social login, magic links, or passkeys. Never offer operator role selection in
sign-up.

Start with the musician experience, not the admin dashboard. Use Stuttgart as
the coherent fictional first-city dataset, with English product UI and realistic
but invented German market content. Clearly distinguish Supply vs Demand,
Observed vs Verified, and Freshness vs Verification.

Create a distinctive, accessible “living signal board” visual language: warm,
urban, editorial, quietly intelligent, and highly legible. Avoid generic purple
AI gradients, robots, glassmorphism, nightclub clichés, standard map-pin
branding, and enterprise CRM styling on musician pages.

Deliver a working responsive client-side SPA with React, Vite, TypeScript, and
Tailwind CSS v4. Do not use Next.js, SSR, Server Components, server actions, or
create a backend. Keep deterministic synthetic data in a dedicated mock module
and place mock behavior behind replaceable adapters so a separate Convex backend
can later provide queries, mutations, actions, realtime subscriptions, AI agent
threads, Firecrawl events, approvals, and AgentMail threads.

Prioritize:
- public landing and market explorer,
- signal detail,
- Scout onboarding plus editable search card,
- signed-in Scout briefing,
- My Search,
- exact approval composer,
- musician Inbox,
- thin Ops Overview, Signal Review, Outreach, and Inbox,
- responsive mobile core flow,
- loading, empty, error, stale, changed, awaiting-reply, and failed-send states.

Build reusable components and a coherent token system. Use the PRD’s routes,
flows, state vocabulary, sample content, acceptance criteria, and technical
integration constraints. If a visual choice is not specified, make a strong
product-design decision consistent with the principles rather than adding more
features.
```

---

## 24. Handoff boundary

Claude Design owns the initial visible product language, layouts, interaction
design, responsive behavior, and frontend component scaffold described here.

The RoomScout backend work will separately own:

- Convex schema and functions,
- Convex Agent Component and Scout orchestration,
- persisted snippets/search context and case-card modes,
- Firecrawl webhook ingestion and normalization workflows,
- saved-search matching and realtime updates,
- outreach approval records,
- AgentMail sending and inbound webhooks,
- authorization, idempotency, and audit behavior.

When both streams are ready, replace the mock adapters with Convex-backed hooks
and connect the designed states to real backend transitions. The frontend should
not need to be visually redesigned during that integration.
