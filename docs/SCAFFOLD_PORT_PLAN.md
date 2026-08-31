# RoomScout — Scaffold & Claude Design Port Plan

**Status:** scaffold history with an active integration checkpoint
**Last updated:** 2026-08-28
**Inputs:** `DESIGN_PRD.md`, the Claude Design RoomScout handoff, and the provisional product/implementation documents

This plan turns the Claude Design handoff into the actual RoomScout application.
It is intentionally narrower than `IMPLEMENTATION_PLAN.md`: it defines the
scaffold, design port, integration seams, and the shortest end-to-end MVP path.
The 2026-08-28 Firecrawl Native Monitor architecture in
`IMPLEMENTATION_PLAN.md` supersedes the original retrieval contract below.

## Integration checkpoint — 2026-08-28

- The real Convex Scout, saved search, fact memory, context import, and profile
  memory UI replaced their fixtures.
- Firecrawl Native Monitoring, multi-entry extraction, personal AgentMail
  inboxes, matching, Realtime Voice, and Mapbox/geographic foundations now exist
  in the application code.
- The remaining work is controlled provider proof and final frontend connection,
  not a return to the original fixture-first architecture.

## Execution checkpoint — 2026-08-27

- Gate A is complete: all RoomScout handoff surfaces run as a responsive,
  fixture-labelled React SPA; unrelated Jumper screens and assets were not
  copied.
- The compatibility and backend scaffold portions of Gate B are complete:
  Convex Auth v2, Agent, and Static Hosting compile together; the backend owns
  signals, saved needs, Scout threads, exact approvals, Firecrawl ingestion,
  AgentMail delivery, and replies.
- Auth is connected end to end and has been browser-tested. The remaining Gate B
  work is to replace the visible signal, Scout, search, approval, and Inbox
  fixtures with their Convex hooks one vertical slice at a time, then configure
  real provider credentials and deploy.

## 1. Outcome

Build one React/Vite/TypeScript SPA that:

- faithfully preserves the handoff's **Signal Ledger** visual direction;
- works responsively rather than shipping the static desktop mockups unchanged;
- uses deterministic fixtures while a screen is being ported;
- replaces fixtures with Convex data one vertical user flow at a time;
- uses Convex Auth v2 Alpha for identity and authorization boundaries;
- uses the Convex Agent component for the focused Room Scout;
- shows one genuine Firecrawl-to-Convex realtime signal update;
- sends exactly one explicitly approved message through AgentMail and receives its reply;
- deploys through the Convex Static Hosting component to `convex.site`.

The core demo path is:

> Public discovery → sign in without losing context → Scout structures a search → a new signal appears live → the user approves exact outreach → the reply appears in the Inbox → Ops can inspect the evidence.

## 2. Execution model: two gates, vertical integration

We will not build an isolated frontend and an isolated backend and attempt a large final integration.

### Gate A — faithful fixture-backed design port

The visible product runs as a real React SPA with typed, deterministic fixtures. Components receive data and actions through props or feature hooks; they never import fixture records directly.

### Gate B — live MVP walking skeleton

Feature containers are switched from fixture adapters to Convex hooks in this order:

1. public signals;
2. auth and return-to-intent;
3. Scout thread and saved search;
4. live ingestion;
5. approval, email, and reply;
6. thin Ops review.

This makes every integration step demonstrable and prevents a late rewrite of the UI.

## 3. Audit of the Claude Design handoff

The handoff provides nine strong visual references, not an application scaffold:

- nine static HTML pages;
- one global CSS file plus substantial inline CSS;
- a sidebar written with `document.write`;
- inline DOM manipulation, `onclick` handlers, and mock timers;
- Lucide loaded from a CDN;
- no responsive media queries or mobile navigation;
- no React, Vite, TypeScript, Tailwind, Convex, auth, or test setup.

Therefore the port copies **visual intent, content hierarchy, and interaction patterns**, not the source DOM or JavaScript.

### Port map

| Handoff reference | Target route | React implementation |
|---|---|---|
| `index.html` | `/` | `LandingPage` |
| `explore.html` | `/explore`, `/app/explore` | shared `ExplorePage` with public/app shell modes |
| `signal.html` | `/signals/:signalId` | `SignalDetailPage` |
| `sign-in.html` | `/sign-in`, `/sign-up` | shared `AuthPage` with explicit mode |
| `scout-onboarding.html` | `/app/scout` | `ScoutPage` in `discovery` state |
| `scout-home.html` | `/app/scout` | `ScoutPage` in `active` state |
| `inbox.html` | `/app/inbox` | `MusicianInboxPage` |
| `ops.html` | `/ops` | `OpsOverviewPage` |
| `ops-signals.html` | `/ops/signals` | `OpsSignalsPage` |
| `rs-shell.js` | shared layouts | `PublicLayout`, `AppShell`, `OpsShell` |
| `roomscout.css` | tokens and components | Tailwind v4 theme plus small semantic CSS layer |

### Missing surfaces to design during the port

Required thin MVP surfaces:

- `/app/search`;
- `/ops/outreach`;
- `/ops/inbox`;
- mobile versions of the core musician flow.

Lower-priority surfaces may remain intentional placeholders until the walking skeleton works:

- `/app/profile`;
- `/ops/sources`;
- `/ops/audit`.

No navigation item may lead to a dead `#` link. A deferred route must either have a useful thin state or be absent from the navigation.

## 4. What is reused and what is excluded

### Reuse

- Signal Ledger cards and dense information hierarchy;
- supply/demand, provenance, freshness, and verification language;
- explicit unknown values;
- Scout conversation beside an editable structured search card;
- Scout briefings and fit explanations;
- exact-recipient approval composer;
- visible separation between Scout chat and external mail;
- original email beside a separately labelled AI interpretation;
- Ops review queue and evidence drawer;
- simple inline RoomScout mark;
- the room background image, after optimization and attribution in the build log.

### Adapt

- extract only tokens actually used by RoomScout;
- rename inherited brand tokens, for example `--jumper-orange` to `--signal`;
- implement the mark as a local React SVG;
- use `lucide-react`, not the CDN script;
- use `@fontsource-variable/inter` unless the local font files' license is verified;
- optimize the large room photograph into responsive WebP/AVIF output;
- translate dialogs, sheets, tabs, and menus to accessible React primitives;
- replace mock timers with deterministic, manually triggered demo events.

### Exclude

- Jumper landing, dashboard, booking, and creator UI;
- Jumper logos, coin, social assets, deck images, uploads, previews, and temporary files;
- the complete inherited token library, Geist files, and unused compatibility tokens;
- the alternative Glass Board and Evidence Split variants;
- `document.write`, inline scripts, inline event handlers, CDN dependencies, and `href="#"` placeholders;
- unlabelled fake product metrics such as “128 signals” or “14 sources.”

## 5. Target application structure

```text
src/
  app/
    router.tsx
    providers.tsx
    routeGuards.tsx
  layouts/
    PublicLayout.tsx
    AppShell.tsx
    OpsShell.tsx
  routes/
    public/
      LandingPage.tsx
      ExplorePage.tsx
      SignalDetailPage.tsx
      AuthPage.tsx
    musician/
      ScoutPage.tsx
      SearchPage.tsx
      InboxPage.tsx
      ProfilePage.tsx
    ops/
      OverviewPage.tsx
      SignalsPage.tsx
      SourcesPage.tsx
      OutreachPage.tsx
      InboxPage.tsx
      AuditPage.tsx
  features/
    auth/
    signals/
    scout/
    search/
    outreach/
    inbox/
    ops/
  components/
    brand/
    navigation/
    signals/
    scout/
    outreach/
    inbox/
    ops/
    ui/
  data/
    ports.ts
    fixtureAdapters.ts
    convexAdapters.ts
  mocks/
    demoData.ts
  styles/
    app.css
  assets/
    room-background.webp
```

### Component boundaries

The first reusable components should be:

- `RoomScoutMark`, `PublicHeader`, `SidebarNav`, `MobileTabBar`, `AccountMenu`;
- `SignalCard`, `SignalFilters`, `SignalTypeBadge`, `FreshnessIndicator`, `ProvenanceCard`, `FitExplanation`;
- `ScoutConversation`, `ScoutMessage`, `SearchProfileCard`, `ScoutBriefing`, `PromptComposer`;
- `ApprovalComposer`, `RecipientSummary`, `ApprovalConfirmation`, `DeliveryStatus`;
- `ThreadList`, `MailConversation`, `ParsedReplyCard`, `ThreadContextPanel`;
- `MetricsGrid`, `ActivityStream`, `ReviewQueue`, `ReviewDrawer`;
- accessible `Button`, `Card`, `Input`, `Select`, `Badge`, `Dialog`, `Sheet`, `Toast`, `EmptyState`, and `LoadingState` primitives.

Route components orchestrate data. Presentation components do not know whether data comes from fixtures or Convex.

## 6. Technical scaffold

### Frontend

- React, Vite, and strict TypeScript;
- Tailwind CSS v4 with CSS-variable-backed RoomScout tokens;
- React Router with a static-hosting-compatible SPA fallback;
- `lucide-react`;
- one accessible primitive library for dialog/menu/tab behavior rather than several overlapping UI kits;
- Inter variable font;
- ESLint, formatting, typecheck, Vitest/Testing Library, and Playwright scripts;
- route-level loading, error, signed-out, and forbidden states.

No Next.js, SSR, server components, server actions, or framework API routes.

### Convex and integrations

- `convex`;
- an exactly pinned, tested Convex Auth v2 Alpha package;
- `@convex-dev/agent`;
- `@convex-dev/static-hosting`;
- OpenAI SDK for in-product model work;
- AgentMail SDK or a small typed HTTP adapter;
- Firecrawl SDK or a small typed HTTP adapter, chosen after validating the current package and API contract.

All package versions are checked and pinned during the technical spike. A floating `alpha` tag must not remain in `package.json`.

The starting Auth v2 candidate is `@convex-dev/auth@2.0.0-alpha.1`; the spike verifies it against the versions actually installed before that pin becomes part of the scaffold.

### Convex file layout

```text
convex/
  convex.config.ts
  auth.config.ts
  auth.ts
  http.ts
  crons.ts
  schema.ts
  lib/
    authz.ts
    errors.ts
    fingerprints.ts
    projections.ts
  users.ts
  signals.ts
  savedNeeds.ts
  scoutContexts.ts
  scout.ts
  scoutTools.ts
  sources.ts
  ingestion.ts
  firecrawl.ts
  outreach.ts
  agentmail.ts
  inbox.ts
  ops.ts
```

Generated Convex files remain generated and are never hand-edited.

## 7. Auth v2 spike and ownership model

Auth is the first integration gate because it affects providers, HTTP routing, protected routes, Scout ownership, and Static Hosting.

The spike must prove:

- username/password sign-up and sign-in;
- session restoration after reload in the Vite SPA;
- sign-out;
- stable mapping from auth identity to the app-owned `users` record;
- protected Convex functions deriving the current user server-side;
- public signal queries working without auth;
- musician functions rejecting anonymous callers;
- Ops functions checking an app-owned `operator` role;
- the client cannot select or grant the operator role;
- return-to-intent restores route, filters, selected signal, and pending action;
- `/`, `/explore`, `/sign-in`, `/api/...`, and direct deep-route reloads coexist under Static Hosting.

In app-owned HTTP routing, exact Auth and `/api/...` routes are registered before the Static Hosting SPA fallback. The catch-all is registered last so it cannot swallow auth or webhook traffic.

The auth component owns credentials and sessions. The RoomScout `users` table owns display identity, role, profile, and product preferences. Authentication never replaces per-function authorization.

If Auth v2 Alpha is fundamentally blocked, record the reproduced blocker before using the documented fallback contract. UI and application ownership must remain unchanged.

## 8. Minimal backend domains

The first schema should model only data needed by the walking skeleton.

| Domain | Responsibility | Required query paths |
|---|---|---|
| `users` | app profile and backend-controlled role | by auth subject |
| `sources` | source identity, policy/review status, display metadata | by status, by canonical domain |
| `sourceTargets` | URL, Firecrawl mode/tag, schedule, last result, pause state | by source, by next run |
| `ingestionEvents` | immutable provider receipt and processing state | by provider event key, by status/time |
| `signals` | public canonical supply/demand projection | by city/type/freshness, by review state |
| `signalEvidence` | source URL, observed facts, timestamps, raw-reference metadata | by signal, by source entry |
| `savedNeeds` | user-owned structured room search | by user/status |
| `scoutContexts` | app ownership and focus mapping for Agent component threads | by user, by thread id |
| Agent component threads | persistent Scout conversation | by authenticated user/thread |
| `outreachDrafts` | recipient, subject, body, source context, content fingerprint | by user/status, by signal |
| `outreachApprovals` | exact approved fingerprint, approver, timestamp | by draft, by approver |
| `mailThreads` | AgentMail thread mapping and user/search context | by provider thread id, by user |
| `mailMessages` | original inbound/outbound messages and parsed interpretation | by thread/time, by provider message id |
| `providerEvents` | AgentMail/Firecrawl webhook deduplication and processing | by provider/event id |

Every public Convex function has argument and return validators. Filtered queries use indexes. Sensitive writes and provider calls are internal functions or actions.

## 9. Integration contracts

### Scout

The Room Scout has exactly three modes:

1. turn conversation into an editable search card;
2. explain and prioritize a signal against that search;
3. propose an outreach draft.

The case card for each mode defines goal, allowed actions, forbidden actions, and completion evidence. The Agent component persists threads; app tables persist structured searches and business state.

Scout tools may read signals, update a draft search, save a confirmed need, and create an outreach draft. They may **never send mail, approve on behalf of a user, grant roles, or expose another user's private data**.

### Firecrawl

The implemented MVP path is:

1. Firecrawl Native Monitoring owns the public-page retrieval schedule;
2. `monitor.page` and `monitor.check.completed` reach the authenticated Convex
   webhook;
3. Convex records provider IDs idempotently and schedules processing;
4. a changed index page expands into individual `sourceEntries`;
5. only bounded new or meaningfully changed detail pages reach OpenAI
   normalization; and
6. Convex publishes the signal, matches owned needs, and updates subscribed
   screens.

The Convex cron reconciles monitor health and stuck work; it does not schedule a
duplicate scrape. Pilot monitors remain off until each source is reviewed and
`FIRECRAWL_MONITORS_ENABLED=true` is set deliberately.

The original `sourceTargets` plus `changeTracking` sequence above is retained in
Git history only and must not be restored alongside Native Monitoring.

### Approval and AgentMail

The approval boundary is data, not a checkbox:

1. Scout creates an editable draft.
2. The UI displays exact recipient, subject, and body.
3. Approval persists their canonical representation and content fingerprint.
4. Any material edit invalidates the approval.
5. Only an internal send action can call AgentMail.
6. The action verifies ownership, approval status, unchanged fingerprint, and idempotency key.
7. A deterministic personal mailbox is provisioned lazily for the user; there
   is no global RoomScout sending inbox.
8. Delivery and reply events update the same mail thread.
9. Incoming original content remains visible; OpenAI interpretation is separate and labelled.

Provider webhooks must verify signatures against the raw request body when required and deduplicate using stable provider event/message ids. Retries and double-clicks must not create duplicate sends.

## 10. Build slices and exit gates

### Slice 0 — preflight and runnable spine

Work:

- record current repo state without touching unrelated documentation changes;
- create Vite/React/TypeScript/Tailwind project scripts;
- initialize Convex and register Auth, Agent, and Static Hosting components;
- complete the Auth v2 and deep-route hosting spike;
- add a reactive health query;
- establish tests, lint, typecheck, and production build commands.

Exit:

- dev app talks to Convex;
- auth survives reload;
- one authenticated and one anonymous query behave correctly;
- one minimal Agent thread persists;
- `/`, `/explore`, and one deep route survive direct reload in the hosting test;
- production build passes locally;
- no production deployment occurs without explicit instruction.

### Slice 1 — visual foundation

Work:

- extract and rename RoomScout tokens;
- add optimized background, Inter, icons, and local mark;
- build accessible primitives and the three shells;
- add desktop/sidebar, tablet, and mobile/bottom-nav behavior;
- establish typed fixture adapters and deterministic demo states.

Exit:

- shells and primitives render at 390, 768, and 1440 px;
- no Jumper-specific token names or unrelated assets ship;
- no CDN, inline script, or random timer remains;
- keyboard focus and reduced motion work.

### Slice 2 — public discovery

Work:

- port Landing, Explore, Signal Detail, auth gate, Sign In, and Sign Up;
- build signal/provenance/freshness components first;
- implement filter state in the URL where useful;
- preserve interrupted action and query through auth;
- switch public signal list/detail from fixtures to safe Convex projections.

Exit:

- anonymous visitors can browse and understand a signal's origin and freshness;
- supply, demand, observed, and verified cannot be confused;
- protected actions return through auth without losing context;
- counts are live or clearly labelled demo fixtures.

### Slice 3 — Scout and My Search

Work:

- port onboarding and home as two states of one Scout route;
- wire a persistent Agent component thread;
- port the editable search card;
- persist confirmed `savedNeeds`;
- add the thin My Search route;
- resume thread and structured search after reload.

Exit:

- conversation visibly produces editable structured fields;
- a user can correct every extracted field;
- confirming creates an app-owned saved search;
- the Scout stays inside its three defined jobs.

### Slice 4 — live signal

Work:

- configure one or two reviewed public source targets;
- schedule Firecrawl change tracking;
- make ingestion idempotent;
- normalize a new/changed record with OpenAI;
- publish one traceable signal;
- update Scout, Explore, and Ops through Convex subscriptions.

Exit:

- replaying the same event is harmless;
- a controlled real change appears without reload;
- provenance and freshness survive every transformation;
- processing failures are visible and retryable.

### Slice 5 — approval, mail, and Inbox

Work:

- port Approval Composer and its review/sending/success/failure states;
- persist drafts and exact approvals;
- implement the guarded AgentMail send action;
- ingest delivery and reply events;
- port Inbox with original and parsed reply views;
- expose a useful reply-draft action through the same approval boundary.

Exit:

- no backend path can send without a valid exact approval;
- edits revoke prior approval;
- retry/double-click sends once;
- reply appears in realtime and is attached to the right user/search/signal;
- original message remains distinguishable from AI interpretation.

### Slice 6 — thin Ops cockpit

Work:

- port Ops Overview, Signals, and Review Drawer fully;
- add thin Outreach and Inbox routes with real state;
- add Sources only if it helps operate the chosen source targets;
- defer Audit/Profile polish until the core flow works.

Exit:

- operator can inspect the live signal's source evidence and processing state;
- musician/anonymous users cannot call Ops functions;
- no Ops navigation item is dead.

### Slice 7 — deployment and demo hardening

Work:

- verify Static Hosting and `/api` routing;
- verify deep-link reloads;
- test loading, empty, stale, error, and permission states;
- rehearse a disclosed, controlled ingestion event and one controlled email round trip;
- verify the mobile core flow;
- update reuse notes and build evidence.

Exit:

- the core demo path works from a clean browser session;
- the flow is reproducible and does not depend on random timers;
- secrets and private content do not appear in the public repo or logs;
- deployment happens only after explicit instruction.

## 11. Parallel work allocation

After Slice 0 establishes shared files, implementation can use three parallel lanes.

| Lane | Owns | Must not concurrently edit |
|---|---|---|
| Design port | route presentations, `src/components/**`, visual tests | Convex schema/config, package manifest |
| Backend | `convex/**`, authz, integrations, contract tests | route JSX and global styles |
| Integration/QA | feature containers, adapters, E2E, responsive verification | generated files or another lane's active component |

One integrator owns the conflict-heavy files:

- `package.json` and lockfile;
- app entry and router;
- global theme stylesheet;
- central data ports/types;
- `convex.config.ts`, `http.ts`, and generated Convex bindings.

Subagents should receive bounded file ownership and exit criteria. They must not independently choose new product scope or modify the same shared files in parallel.

## 12. Verification matrix

| Gate | Required proof |
|---|---|
| Every implementation slice | lint, typecheck, relevant tests, production build |
| Design port | route navigation plus visual comparison at 390, 768, and 1440 px |
| Accessibility | keyboard flow, visible focus, labels, dialog focus trap/return, reduced motion |
| Auth | sign-up, sign-in, reload, sign-out, return-to-intent |
| Authorization | anonymous/musician calls cannot access user-private or Ops data |
| Public data | projections contain no private fields or raw communication data |
| Realtime | new signal and reply appear without reload |
| Firecrawl | auth/signature contract, duplicate receipt, retry, and changed/removed behavior |
| Approval | changed content invalidates approval; unapproved send is impossible |
| AgentMail | one send per idempotency key; reply maps to the correct thread |
| Hosting | direct loading of public, musician, Ops, auth, and `/api` routes |
| Demo | complete controlled path from discovery through external reply |

## 13. Scope cuts

Cut first if time becomes constrained:

- polished Profile and Audit screens;
- broad source-registry administration;
- complex Ops metrics;
- maps, graph analytics, and embeddings;
- band matching and introductions;
- Germany- or Europe-wide coverage;
- optional visual variants and dark-mode exploration.

Do not cut:

- provenance and freshness;
- observed versus verified language;
- editable Scout search card;
- one genuine Firecrawl → Convex realtime moment;
- persisted exact approval before every external send;
- one genuine AgentMail send/reply round trip;
- original email beside separately labelled AI interpretation;
- backend authorization for every private or Ops operation.

## 14. MVP definition of done

The MVP is complete when a visitor can find a public rehearsal-room signal, authenticate without losing context, use the Scout to structure and save a search, see one newly ingested matching signal appear in realtime, approve the exact recipient and message, and read the external reply in the Inbox. An operator can inspect that signal and its provenance. The flow runs on `convex.site`, and no external message can be sent without a persisted valid approval.
