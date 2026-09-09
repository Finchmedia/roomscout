# DATA_BINDING_PLAN — prototype UI ↔ Convex backend

Companion to `SCOUT_SCREENS.md`, `SCOUT_STATE.md`, `SETTINGS_SCREENS.md`, `OPERATOR_SCREENS.md`
and `DATA_MAP.md`. Those five say **what the prototype looks like** and **what the backend has**.
This file says, for every prototype stage / view / section / control:

- which backend state derives it (query · field · condition),
- which mutation or action each control calls,
- what loading / empty / error must show,
- what is **purely demo-simulated and must not be faked**,
- what has **no backend counterpart today** and how to treat it.

Every function name, argument object and field below was checked against the working tree on
`ui-port` (`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/convex`,
`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src`). Where a claim contradicts
`DATA_MAP.md` the repo was re-read and the difference is marked ⚠.

German copy is quoted verbatim (`„ “`, `·`, `–`, `—`, `€`, `…`). Never paraphrase a quoted string.

---

## 0. Reading key

| Marker | Meaning |
|---|---|
| **REAL** | a persisted backend fact derives it today; wire it |
| **DERIVED** | no single field; computed client-side from persisted facts (formula given) |
| **NEW-BE** | needs a small, named backend addition before it can be honest |
| **NO-BE** | no backend counterpart and none planned in this pass → treatment given |
| **DEMO** | prototype scripting; **must not ship**, must not be simulated |
| **ACTION** | the binding is a Convex **action**, not a query — see §2.4 |

⚠ German copy uses the typographic pair `„ … “`. **Shipped app strings quoted from `src/` or
`convex/` are English and are quoted with ASCII `" … "`** — they are the strings a bilingual
dictionary must pair with the prototype's German, not paraphrases of it.

Treatment vocabulary for NO-BE elements (§9 assigns exactly one to each):

- **`nicht verbunden`** — render the control, disabled, with the label „Nicht verbunden“ and a one
  line explanation of what is missing. Use when the *presence* of the section is informative
  (it tells the user the boundary of the product). ⚠ `ProfilePage.test.tsx` pins **only** the
  billing/metering wording ("states honestly that billing and metering are unavailable"); the
  notifications paragraph is shipped copy with no test behind it (§5.5).
- **hide** — do not render at all. Use when rendering it would imply a capability we do not have.
- **build minimal backend later** — keep out of v1, listed in §10 with the exact function to add.

---

## 1. Settled product rules that constrain every binding

From `AGENTS.md` → *Settled constraints*. These override any 1:1 fidelity argument.

1. **Approve / YOLO is the product rule.** Every external message needs either (a) persisted exact
   approval of the final destination **and** content, or (b) an active, versioned, expiring
   standing mandate with daily limits — and even then only allowlisted, non-binding communication.
2. **Any binding commitment needs exact approval in every mode and channel.** Agreement, booking,
   contract, payment, deposit. Credentials, 2FA and CAPTCHAs stay human-only.
3. The only controlled-demo exception is the reviewed `roomscout-dev-v1` adapter on exactly
   `https://roomscout.dev` (ephemeral password + one numeric email verification code). It never
   follows verification links, solves a CAPTCHA, accepts terms, handles payment, or generalises.
4. **Matching is consent-based.** Never expose a private band profile or contact details without
   opt-in and introduction approval.
5. **Public repo.** No secrets, private profile data, raw conversations or contact info in code,
   comments, logs or docs.

Consequences that recur below and are not repeated each time:

- A stage may only appear when a **persisted row** justifies it. No timer may advance a stage.
- A status line may only describe work that has a persisted row. „Ich habe angefragt …“ requires an
  `actionRequests` row in `approved`/`queued`/`executing`/`executed`.
- Any button that would send, accept, book or pay must route through an exact-approval dialog with
  a content hash and an acknowledgement checkbox — never a single click.
- Any button that would log in must route to the Browserbase Live View run page, never to a
  simulated login sheet.

---

## 2. The one data layer

The prototype is a single component holding all state. The port is one authenticated shell holding
a small number of live queries and passing a derived view model down. Extract these hooks first;
every table in §4–§6 assumes them.

### 2.1 `useActiveNeed()` — replaces the rule duplicated in ScoutPage, MySearchPage, SearchControlSettings

```ts
const needs        = useQuery(api.savedNeeds.listMine, { limit: 10 });
const scoutContext = useQuery(api.scout.getMine, {});          // { threadId, mode, activeNeedId?, focusedSignalId? } | null

const need = scoutContext === undefined ? undefined
  : needs?.find(n => n._id === scoutContext?.activeNeedId && n.status !== "archived")
    ?? needs?.find(n => n.status !== "archived");

const threadId = need && scoutContext?.activeNeedId === need._id
  ? scoutContext.threadId : undefined;
```

- Bootstrap: when `needs` has loaded and contains no non-archived row, call
  `api.savedNeeds.getOrCreateDraft({})` **once** (guard with a ref; on failure clear the ref so the
  effect can retry). Its defaults are user-visible: `title: "My rehearsal-room search"`, `city: ""`.
  ⚠ Two facts about that mutation the effect must respect (`convex/savedNeeds.ts:140-166`):
  1. It **reuses any non-archived need**, including an `active` or `paused` one — it is not a
     "create a draft" call, it is "give me the current need". Calling it can therefore never
     produce a second need, but it can also never reset a paused search to `draft`.
  2. It returns `Id<"savedNeeds">`, **not the row**. The effect must not treat the return value as
     the need; the `savedNeeds.listMine` subscription re-fires and delivers the row a tick later.
     Render `loading`, not `welcome`, in that gap.
- When `scoutContext?.activeNeedId !== need._id`, call
  `api.scout.getOrCreateThread({ activeNeedId: need._id })` (same ref guard).
- ⚠ The empty `city` default is what disables „Scout losschicken“ client-side and makes
  `mandates.enableDefaultAutopilot` / `savedNeeds.setStatus("active")` throw `INCOMPLETE_NEED`.

### 2.2 Shell query inventory (subscribe once, at the authenticated shell)

| hook | call | args | drives |
|---|---|---|---|
| `useActiveNeed` | `savedNeeds.listMine` + `scout.getMine` | `{ limit: 10 }` / `{}` | need, threadId |
| `useScoutFacts` | — | `factsFromNeed(need)` (`src/features/scout/viewModel.ts`) | brief / fact list |
| `useScoutMessages` | `scout.listMessages` (paginated) | `{ threadId }` / `"skip"`, `initialNumItems: 60` | transcript, discovery |
| `useMatches` | `matches.listMine` | `{ savedNeedId, limit: 30 }` / `"skip"` | candidates |
| `useOpportunities` | `opportunities.listMine` | `{ savedNeedId, limit: 20 }` / `"skip"` | clarification |
| `useConversations` | `providerConversations.listMine` | `{ limit: 30 }`, then `.filter(r => r.savedNeedId === need._id)` | offer, following_up, complete |
| `useMandate` | `mandates.getActiveMine` | `{ savedNeedId }` / `"skip"` | autopilot badge, Handlungsspielraum |
| `useActions` | `externalActions.listMine` | `{ limit: 30 }` | release card, following_up, activity |
| `useSourceCoverage` | `searchSources.listForNeed` | `{ savedNeedId, limit: 100 }` | Quellen page, blocked-source |
| `usePortals` | `portalConnections.listMine` | `{}` | Zugänge, blocked-access |
| `useMailbox` | `mailboxes.getMine` | `{}` | Scout-Adresse |
| `useMemory` | `memory.listMine` | `{}` | Was dein Scout weiß |
| `useOutreach` | `outreach.listMine` | `{ limit: 50 }` | email approval cards (§4.4.1) — already subscribed by `ScoutPage.tsx:108` |
| `useNotifications` | `notifications.listMine` | **NEW-BE** §10.1 | activity list, toast |
| `useUser` | `users.current` | — | greeting, initials, operator gate |
| `useVoiceSession` | `VoiceSessionProvider` context | — | discovery voice stage |

⚠ Two hard, invisible server-side filters govern every `matches.length` / `opportunities.length`
test below and must be documented next to any empty state:

1. `matches.listMine({ savedNeedId })` returns **`[]` for any need whose status is not `"active"`**
   (`convex/matches.ts`). A draft or paused search shows zero matches regardless of the table.
2. `opportunities.listMine` **silently drops** stale `new` / `reviewing` / `saved` rows
   (`opportunityMatchIsCurrent`). The clarification stage can therefore vanish with no user action.
3. `providerConversations.listMine` **validates** its `limit` rather than clamping it: a non-integer
   or a value outside `1…50` throws `INVALID_LIMIT` (`convex/providerConversations.ts:359`). Every
   other list query in this plan clamps. Send a literal `30`.

Row-shape traps in the same inventory (all verified against the returns validators):

| query | trap |
|---|---|
| `providerConversations.listMine` | the id field is **`conversationId`**, not `_id`. `state` is `v.string()` in the validator; the underlying schema union is `waiting \| thinking \| needs_attention \| offer_ready \| closed` (`convex/schema.ts:1623`). |
| `scout.listMessages` | rows are `{ key, role, text, status, createdAt }` — the id is **`key`**, not `_id`; `role` includes **`"system"`**; `status` is a free-form agent status string. |
| `matches.listMine` | carries **`contactEligible: boolean`** (§4.7) and the full `signal` projection (§4.7). |
| `memory.listMine` | hard-capped at **100 facts** and **12 events** (`take(100)` / `take(12)`, `convex/memory.ts:485-502`). There is no pagination. |
| `mandates.getActiveMine` | returns the row for `status === "active"` only, but **does not filter `stoppedAt` or `expiresAt`** (§3.1, §5.2). |

So: **derive `paused` from `need.status`, never from an empty match list**, and never word an empty
match state as "we searched and found nothing" unless the need is `active`.

### 2.3 Server-side rate limits the UI must survive

`convex/rateLimits.ts` (fixed windows). The ones the new UI touches:
`scoutMessage` 10/min · `matchRefresh` 2/min · `contextImport` 3/h · `voiceSession` 3/h ·
`voiceTool` 30/min · `portalAuthSource` 3/day · `portalWriteUser` 10/day · `firecrawlInteractUser` 10/day.

`voiceTool` is charged by **both** `voice.executeTool` and `voice.getInstructions`, and the hook
re-fetches instructions on every scout-context change while connected — navigating between signals
during a live call burns the model's own budget.

⚠ `contextImport` **3/h is not the import dialog's private budget.** Four entry points charge the
same bucket (`convex/memory.ts:364`, `702`, `920`, `958`):

| entry point | kind | charged |
|---|---|---|
| `memory.parseContextImport` | ACTION | 1 |
| `memory.importFacts` | mutation | 1 |
| `memory.refreshMyEmbeddings` | ACTION | 1 |
| `memory.refreshMyContext` | ACTION | 1 |

One completed import (parse → import) therefore burns **2 of 3** tokens per hour, and the two
refresh buttons §5.3 recommends adding consume the same three. The UI must say so before the
second attempt fails, and must not offer „Semantischen Index aufbauen“ / „Arbeitskontext neu
aufbauen“ as free actions next to an import that just ran.

Every rate-limited control needs the copy
„Kurz durchatmen: Bitte versuche es in einer Minute noch einmal.“ (existing `readableError` string).

### 2.4 Which bindings are Convex **actions** (marked **ACTION** below)

An action cannot be subscribed to with `useQuery`. Every one of these needs an explicit trigger,
an in-flight state, a place to hold its result in React state, and — where the UI presents it as
"current" — a manual refresh affordance. A tile fed by an action is a **snapshot**, never live.

| function | file | note |
|---|---|---|
| `scout.sendMessage` | `convex/scout.ts:250` | `scoutMessage` 10/min |
| `matches.recomputeMine` | `convex/matches.ts` | `matchRefresh` 2/min |
| `mailboxes.ensureMine` | `convex/mailboxes.ts:596` | returns `{ status, emailAddress?, lastError? }` |
| `memory.parseContextImport` | `convex/memory.ts:952` | `contextImport` |
| `memory.refreshMyEmbeddings` | `convex/memory.ts:702` | `contextImport` |
| `memory.refreshMyContext` | `convex/memory.ts:920` | `contextImport` |
| `voice.executeTool` / `voice.getInstructions` | `convex/voice.ts` | `voiceTool` 30/min |
| `opsActions.providerReadiness` | `convex/opsActions.ts:44` | operator-gated; **§6.1 tiles need a refresh button** |
| `opsActions.runMonitorNow` | `convex/opsActions.ts:19` | operator-gated |
| `browserbasePortal.startAuthentication` | `convex/browserbasePortal.ts:611` | → Live View run |
| `browserbasePortal.startAgentRegistration` | `convex/browserbasePortal.ts:685` | controlled portal only |
| `browserbasePortal.getLiveView` | `convex/browserbasePortal.ts:957` | ephemeral URL, never persisted |
| `browserbasePortal.resumeAuthentication` | `convex/browserbasePortal.ts:1239` | explicit "signed in" tick |
| `browserbasePortal.stopRun` | `convex/browserbasePortal.ts:1318` | cancel an auth run |
| `browserbasePortal.disableConnection` | `convex/browserbasePortal.ts:1274` | destructive |
| `browserbasePortal.executeApprovedWrite` | `convex/browserbasePortal.ts:1888` | post-approval executor |
| `browserbasePortal.getApprovedWriteLiveView` | `convex/browserbasePortal.ts:1923` | `{ executionId }` → `{ url, expiresAt }` |
| `browserbasePortal.stopApprovedWrite` | `convex/browserbasePortal.ts:1951` | cancel a write run |
| `browserbasePortal.completeApprovedWriteHumanStep` | `convex/browserbasePortal.ts:1978` | `{ requestId, executionId, submitted }` |
| `firecrawlInteract.executeApproved` | `convex/firecrawlInteract.ts:334` | returns the Live View URLs |
| `firecrawlInteract.completeApprovedHumanStep` | `convex/firecrawlInteract.ts:380` | `{ requestId, executionId, submitted }` |

---

## 3. Scout stage derivation from backend state

### 3.1 The function

```ts
// src/features/scout/stage.ts
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type ScoutStage =
  | "loading"
  | "welcome" | "discovery" | "brief_review"
  | "scouting" | "waiting" | "clarification" | "following_up"
  | "candidates" | "offer" | "offer_review" | "complete"
  | "paused";
// NOTE: "dead_end" is deliberately absent — see §9.1.

type Need          = FunctionReturnType<typeof api.savedNeeds.listMine>[number];
type Match         = FunctionReturnType<typeof api.matches.listMine>[number];
type Opportunity   = FunctionReturnType<typeof api.opportunities.listMine>[number];
type Conversation  = FunctionReturnType<typeof api.providerConversations.listMine>[number];
type ActionRow     = FunctionReturnType<typeof api.externalActions.listMine>[number];
type Mandate       = NonNullable<FunctionReturnType<typeof api.mandates.getActiveMine>>;

export interface ScoutStageInput {
  need: Need | undefined | null;              // undefined = loading, null = draft not created yet
  scoutContext: { threadId: string } | undefined | null;
  messageCount: number | undefined;           // scout.listMessages page length
  facts: { key: string; label: string; value: string }[];  // factsFromNeed(need)
  matches: Match[] | undefined;
  opportunities: Opportunity[] | undefined;
  conversations: Conversation[] | undefined;  // already narrowed to this savedNeedId
  actions: ActionRow[] | undefined;           // externalActions.listMine, unfiltered
  mandate: Mandate | null | undefined;
  ui: {
    briefRequested: boolean;      // „Suchauftrag ansehen“ pressed, or a voice call just ended with facts
    acceptanceRequestId?: string; // „Angebot prüfen“/„Angebot annehmen“ opened the acceptance review
    voiceConnected: boolean;      // useVoiceSession().connected
  };
}

// convex/externalActions.ts:36-40 — the COMPLETE actionRequests.status enum (ten values):
//   drafted | awaiting_approval | approved | rejected | queued
//   executing | executed | failed | cancelled | expired
// Every one of them needs a user-visible outcome (§4.4.2). None may silently vanish.
const ALL_ACTION_STATUS = ["drafted", "awaiting_approval", "approved", "rejected", "queued",
                           "executing", "executed", "failed", "cancelled", "expired"] as const;

const NEEDS_SUBMIT    = new Set(["drafted"]);                                   // → externalActions.submit
const NEEDS_APPROVAL  = new Set(["awaiting_approval"]);                         // → the approval card
const IN_FLIGHT_REPLY = new Set(["queued", "approved", "executing"]);
const DISPATCHED      = new Set(["approved", "queued", "executing", "executed"]);
const TERMINAL_BAD    = new Set(["rejected", "failed", "cancelled", "expired"]); // → outcome copy, §4.4.2

export function deriveScoutStage(i: ScoutStageInput): ScoutStage {
  const { need, scoutContext, messageCount, facts, matches,
          opportunities, conversations, actions, mandate, ui } = i;

  // ── 0. loading ────────────────────────────────────────────────────────────
  // Any query the branches below read is still `undefined`, or the draft need
  // has not been created yet. Show the skeleton, never a stage.
  if (need === undefined || need === null || scoutContext === undefined) return "loading";

  // ── 1. complete — MUST be tested before `paused` ──────────────────────────
  // `externalActions.finishExecution` sets the need to `paused` and stops the
  // mandate when an acceptance is sent. Testing `paused` first makes `complete`
  // unreachable. It must also NOT depend on `offer.current`, because pausing
  // the need makes every offer non-current (convex/providerConversations.ts).
  const accepted = conversations?.find(
    (c) =>
      (c.acceptedOfferId !== undefined && c.acceptedAt !== undefined) ||
      c.acceptanceStatus === "executed",
  );
  if (accepted) return "complete";

  // ── 2. offer_review — also before `paused`, same reason ───────────────────
  // Local flag only: the acceptance request exists server-side
  // (offerAcceptance.prepare → getMine) but "is the user looking at it" is UI state.
  if (ui.acceptanceRequestId) return "offer_review";

  // ── 3. paused is authoritative for everything below ───────────────────────
  if (need.status === "paused") return "paused";

  // ── 4. draft need → the conversation half of the funnel ───────────────────
  if (need.status === "draft") {
    if (ui.briefRequested && facts.length > 0) return "brief_review";
    const started = (messageCount ?? 0) > 0 || facts.length > 0 || ui.voiceConnected;
    return started ? "discovery" : "welcome";
  }

  // need.status === "active" from here on.

  // ── 5. a current, ready offer outranks everything ─────────────────────────
  // `offer.current` is computed server-side and already requires the need to be
  // active and every revision to line up; `ready` is returned as `current && ready`.
  const liveOffer = conversations?.find((c) => c.offer && c.offer.current && c.offer.ready);
  if (liveOffer) return "offer";

  // ── 6. an open question addressed to the USER ─────────────────────────────
  // opportunity.uncertainties[] — not offer.blockers, which are questions for
  // the provider (convex/providerConversations.ts).
  const question = opportunities?.find(
    (o) => ["new", "reviewing", "contacted"].includes(o.status) && o.uncertainties.length > 0,
  );
  if (question) return "clarification";

  // ── 7. a provider turn is in flight (we replied, no assessed offer yet) ───
  const replyInFlight = conversations?.some(
    (c) => !c.offer && IN_FLIGHT_REPLY.has(c.replyStatus ?? ""),
  );
  const actionInFlight = actions?.some(
    (a) => a.savedNeedId === need._id && IN_FLIGHT_REPLY.has(a.status),
  );
  if (replyInFlight || actionInFlight) return "following_up";

  // ── 8. matches on the table ───────────────────────────────────────────────
  // `matches.listMine` already drops `dismissed` rows and stale rows, and returns
  // [] for a non-active need, so `length` is a truthful "currently on the table".
  const live = matches ?? [];
  if (live.length > 0) return "candidates";   // 1 match = the single-card variant

  // ── 9. nothing on the table: still looking vs. waiting for an answer ──────
  // This split is persisted, not a timer: it is "has anything been dispatched
  // for this need yet".
  const dispatched = actions?.some(
    (a) => a.savedNeedId === need._id && DISPATCHED.has(a.status),
  );
  if (dispatched) return "waiting";

  // ⚠ `status: "active"` alone is NOT "running". `externalActions.finishExecution` stamps
  // `stoppedAt` on the mandate when an acceptance is sent but LEAVES `status: "active"`
  // (convex/externalActions.ts:1124), so `mandates.getActiveMine` keeps returning it forever.
  // `authorizeFromMandate` refuses a stopped or expired mandate (convex/lib/mandateAuthorization.ts:113),
  // so a UI that claims "running" here would be claiming work the backend will not do.
  const autopilotRunning =
    mandate?.status === "active" &&
    mandate.stoppedAt === undefined &&
    mandate.expiresAt > Date.now() &&
    (mandate.mode === "outreach_autopilot" || mandate.mode === "negotiation_autopilot");
  return autopilotRunning ? "scouting" : "waiting";
}
```

### 3.2 Why the order is what it is

| # | Test | Why it must sit there |
|---|---|---|
| 0 | loading | `undefined` means "not yet known", `null`/`[]` means "known to be empty". Branching on `!x` collapses the two and flashes the wrong stage on every mount. |
| 1 | complete | On a sent acceptance `externalActions.finishExecution` (`convex/externalActions.ts:1116-1127`) sets the conversation `state: "closed"` + `acceptedOfferId`/`acceptedAt`, sets the need to `paused`, patches the mandate `{ stoppedAt: now }` — ⚠ **but leaves `mandate.status: "active"`** — and writes the notification "Offer acceptance sent". With `paused` first, `complete` is unreachable. Also: pausing makes every `offer.current` false, so `complete` must not read `offer.current`; and every autopilot derivation must test `stoppedAt`/`expiresAt`, never `status` alone. |
| 2 | offer_review | Same auto-pause hazard; also the user must not lose the open review by a background revision. |
| 3 | paused | Authoritative. Derived from `need.status`, never from an empty match list (§2.2). |
| 4 | draft | `savedNeeds.status === "draft"` is the only truthful "we are still talking" signal. |
| 5 | offer | Server already guarantees currency/readiness; nothing weaker should outrank it. |
| 6 | clarification | An unanswered question to the user blocks progress and must beat "in flight". |
| 7 | following_up | Only from persisted `replyStatus` / `actionRequests.status`, never from a timer. |
| 8 | candidates | Reached only when there is nothing more specific to show. |
| 9 | scouting / waiting | The last split; the only one with no dedicated field, so it is derived from "has anything been dispatched". |

### 3.3 Stage-independent overlays (they do **not** change `stage`)

The prototype models these as `waitingFor` and `pending`, which leave `stage` alone. Keep that.

```ts
export interface ScoutBlockers {
  noUsableSource: boolean;      // → „Quelle auswählen“
  portalReauth: PortalRow | null; // → „Zu den Zugängen“
  unsubmitted: ActionRow | null;  // status "drafted" → externalActions.submit (§4.4.0)
  release: ActionRow | null;      // → the approval card
  outcome: ActionRow | null;      // rejected/failed/cancelled/expired → §4.4.2
}

export function deriveBlockers(i: {
  coverage: FunctionReturnType<typeof api.searchSources.listForNeed> | undefined;
  portals: FunctionReturnType<typeof api.portalConnections.listMine> | undefined;
  actions: ActionRow[] | undefined;
  needId: string;
}): ScoutBlockers {
  const noUsableSource =
    i.coverage !== undefined &&
    (i.coverage.areaResolved === false ||
     i.coverage.sources.length === 0 ||
     i.coverage.sources.every((s) => s.preference === "exclude"));

  // `portalConnections.status` (convex/schema.ts:1350-1357) has SIX values:
  //   draft | needs_auth | active | paused | reauth_required | disabled
  // Only these two mean "the user must log in again":
  const portalReauth =
    i.portals?.find((p) => p.status === "needs_auth" || p.status === "reauth_required") ?? null;

  // ⚠ `drafted` is a real status. A request created by a Scout tool sits in `drafted` until
  // `externalActions.submit` is called; it produces NO approval card and the user has no way to
  // advance it. Surface it (§4.4.0) instead of dropping it.
  const unsubmitted =
    i.actions?.find((a) => a.savedNeedId === i.needId && a.status === "drafted") ?? null;

  const release =
    i.actions?.find(
      (a) => a.savedNeedId === i.needId &&
             a.status === "awaiting_approval" &&
             a.automationMode === "exact_once",
    ) ?? null;

  // rejected | failed | cancelled | expired — a send that ended badly must not disappear.
  const outcome =
    i.actions?.find((a) => a.savedNeedId === i.needId && TERMINAL_BAD.has(a.status)) ?? null;

  return { noUsableSource, portalReauth, unsubmitted, release, outcome };
}
```

Prototype ↔ real mapping:

| Prototype | Real source | Real CTA |
|---|---|---|
| `waitingFor === 'source'` | `searchSources.listForNeed` → `areaResolved:false` \| `sources:[]` \| all `exclude` | „Quelle auswählen“ → Settings → Quellen & Zugänge |
| `waitingFor === 'access'` | `portalConnections.listMine` row `needs_auth` \| `reauth_required` | „Zu den Zugängen“ → Settings → Quellen & Zugänge → the portal row → **`browserbasePortal.startAuthentication({ connectionId })` → navigate `/app/runs/:runId`** |
| `waitingFor === 'release'` / `pending` | `externalActions.listMine` row `status:"awaiting_approval"` **and** `automationMode:"exact_once"` | the exact-approval sheet (see §4.5) |
| (no prototype equivalent) | `externalActions.listMine` row `status:"drafted"` | „Anfrage abschicken“ → `externalActions.submit({ requestId })` (§4.4.0) |
| (no prototype equivalent) | `externalActions.listMine` row in `rejected \| failed \| cancelled \| expired` | the outcome card (§4.4.2) |

⚠ `automationMode` is the field that distinguishes "needs your exact approval" (`exact_once`) from
"already authorized by the standing mandate" (`standing_mandate`). `MusicianInboxPage` currently
hard-codes `authorization: { mode: "approve_once" }` and ignores it — **the port must read it**,
and the two `ActionApprovalSheet` / `ActionLifecyclePanel` tests pin the distinction.

### 3.4 Status line (`state.status`) — DERIVED, never scripted

The prototype's `STATUS[0..3]`, `FOLLOW_STATUS`, `ALT_STATUS` are scripted copy fired on timers.
Replace with a pure function over persisted rows. Every branch must name something that exists.

```ts
export function deriveStatusLine(i: {
  stage: ScoutStage; need: Need; mandate: Mandate | null;
  actions: ActionRow[]; conversations: Conversation[]; blockers: ScoutBlockers;
}): string | null {
  if (i.blockers.noUsableSource) return t("scout.status.noSource");
  if (i.blockers.portalReauth)   return t("scout.status.accessExpired");
  if (i.blockers.unsubmitted)    return t("scout.status.awaitingSubmit");   // §4.4.0, new string
  if (i.blockers.release)        return t("scout.status.awaitingRelease");
  if (i.blockers.outcome)        return t(`scout.status.outcome.${i.blockers.outcome.status}`); // §4.4.2

  switch (i.stage) {
    case "scouting":  return t("scout.status.searching", { city: i.need.city });
    case "waiting":   return t("scout.status.waitingReply");
    case "following_up": {
      const c = i.conversations.find(x => IN_FLIGHT_REPLY.has(x.replyStatus ?? ""));
      return c ? t("scout.status.followUp") : t("scout.status.searchAgain");
    }
    default: return null;
  }
}
```

Reused verbatim from the prototype dictionary (`SCOUT_STATE.md` §20.3), with `{city}` made a slot:

| key | string | usable as-is? |
|---|---|---|
| `scout.status.searching` | „Ich suche nach passenden Räumen in Stuttgart.“ | **needs `{city}`** — the literal city must become `need.city` |
| `scout.status.waitingReply` | „Jetzt warte ich auf eine Antwort.“ | yes |
| `scout.status.noSource` | „Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen.“ | yes |
| `scout.status.accessExpired` | „Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.“ | **needs `{domain}`** — must follow the connection, not a literal |
| `scout.status.awaitingRelease` | „Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst.“ | yes |
| `scout.status.awaitingSubmit` | *(new — a `drafted` row, §4.4.0)* | **new string** (§11 Q18) |
| `scout.status.outcome.rejected` \| `.failed` \| `.cancelled` \| `.expired` | *(new — §4.4.2, all four end in „Nichts wurde gesendet.“)* | **new strings** (§11 Q18) |
| `scout.status.candidateFound` | „Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details.“ | **DEMO** — names a scripted room |
| `scout.status.asked` | „Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist.“ | **DEMO** — names scripted content |
| `scout.status.followUp` | „Ich bestätige, dass Mittwoch für euch möglich ist, und lasse mir das Angebot geben.“ | **DEMO** — names a scripted day |

The three DEMO lines need generic replacements written by the maintainer (§11, Q3).

### 3.5 Voice / text mode — REAL, already built

The prototype's `mode: 'voice' | 'text'`, `micOn`, `scoutState` and the word-by-word reveal map onto
the existing realtime session, not onto a scripted engine.

| Prototype | Real |
|---|---|
| `startVoice()` | `voice.connect()` from `useVoiceSession()`; the session is started by `POST {convex.site}/api/realtime/session` (`convex/voice.ts::sessionHttp`), rate-limited `voiceSession` 3/h |
| `startText()` | open the composer; sends go to `scout.sendMessage({ threadId, message })` (action, `scoutMessage` 10/min, 1…4000 chars) |
| `micOn` / `toggleMic` | `voice.setMuted(next)` — toggles `track.enabled` on local audio tracks |
| `scoutState: speaking\|listening\|thinking\|idle` | `voice.status ∈ idle \| requesting_microphone \| connecting \| creating_session \| listening \| thinking \| speaking \| disconnected \| error` — map `speaking→speaking`, `listening→listening`, `thinking→thinking`, everything else `idle` |
| word-by-word reveal | the realtime `response.output_audio_transcript.delta` / `output_text.delta` stream already arrives incrementally — render it, do not re-implement `setInterval` |
| `transcript[]` | `voice.transcript` (last 24 items, `{ id, role, text, final }`) **plus** `scout.listMessages` for the persisted thread |
| `endConvo()` | `voice.disconnect()` → also calls `voice.endMine({ voiceSessionId })` |
| `switchToVoice` / `switchToText` | `voice.setModality("voice" \| "text")` |
| `capsule` flight animation | keep — it is a presentation of `factsFromNeed(need)` changing after `update_search_draft`; `ScoutFactList` already implements the FLIP contract |
| `flags.voice` gate | **NO-BE** — there is no feature-flag store (§9.4). The real gate is `OPENAI_API_KEY` missing → the session endpoint answers 503 |
| `Sched` pause/resume | **DEMO** — delete. There is no timeline to pause. „Suche pausieren“ is `savedNeeds.setStatus` |
| (no prototype equivalent) | **`volume`** — `status === "speaking" ? outputVolume : muted ? 0 : inputVolume`. This is the amplitude the prototype's `blobAnim` wants; do not drive the blob from a timer |
| (no prototype equivalent) | **`interrupt()`** — barge-in: sends `response.cancel` + `output_audio_buffer.clear` and sets `listening`. Wire it to a tap on the blob / a „Stopp“ affordance |
| (no prototype equivalent) | **`connectedAt`** (ms) and **`error?: string`** are both returned by the hook and both are needed: `connectedAt` for the elapsed-time readout and the cap below, `error` for the failure line |
| (no prototype equivalent) | **hard 15-minute cap.** `useRealtimeVoiceScout.ts:553-557` runs `setTimeout(disconnect, 15*60*1000 - (Date.now() - connectedAt))` unconditionally. The call **ends by itself**, with no server event and no user action |

⚠ **The 15-minute auto-disconnect needs its own copy and state.** The prototype has no concept of a
call that ends on its own. Required (DE + EN, §11 Q13):

- a remaining-time readout derived from `connectedAt` (not a second timer of your own),
- a warning state at ~1 minute left,
- an ended state after the cap fires that is **not** worded as an error and that keeps the facts:
  the persisted draft is unaffected, so „Gespräch beendet. Eure Wünsche bleiben als Entwurf
  gespeichert.“ + „Gespräch fortsetzen“ (`voice.connect()`) is the correct landing state.

**The realtime tool allowlist is enforced client-side and has seven names**
(`useRealtimeVoiceScout.ts:235-243`) — anything else is silently dropped:

`get_current_search` · `update_search_draft` · `remember_fact` · `recall_relevant_memory` ·
`get_focused_signal` · `create_outreach_draft` · `create_webform_draft`

⚠ **`create_webform_draft` during a live call can produce an approval card, or an autonomous send.**
It routes to `externalActions.createContactFormFromScout`, which under an active, unstopped mandate
returns `status: "approved"` / `"queued"` with `authorizedByAutopilot: true`
(`convex/externalActions.ts:232-385`). So a voice conversation can, mid-sentence, move a request all
the way to `approved`. The Scout surface must therefore keep the approval card and the outcome card
live **while the call is running**, and the §4.7 claim that the outreach path „is a request for a
draft, not a send“ holds only for `create_outreach_draft` and only outside a standing mandate.

⚠ `sendText()` returns `boolean` and returns `false` when the data channel is closed. Both
`RealtimeVoiceScout` and `ScoutConversation` rely on that to keep the draft in the input
(`ScoutConversation.test.tsx` pins it). Reproduce it.

Voice error vocabulary that replaces the German status line needs DE strings — the full list is in
`DATA_MAP.md` §3.10 (7 hook strings + 5 `safeVoiceError` + 3 `safeProviderError`). Provider text is
never surfaced; `safeProviderError` must stay.

---

## 4. Scout surface — per stage, section and control

### 4.0 Global chrome (`SCOUT_SCREENS.md` §2)

| Element | Binding | Backend | Loading | Empty | Error |
|---|---|---|---|---|---|
| Wordmark „roomscout“ | static | — | — | — | — |
| Scout badge `showScoutBadge` | `AUTOPILOT.includes(stage)` → `stage ∈ {scouting, waiting, following_up}` | **DERIVED** (§3.1) | hide while `stage === "loading"` | — | — |
| `badgeText` „Scout ist unterwegs“ / „Suche pausiert“ | `need.status === "paused"` | **REAL** `savedNeeds.status` | — | — | — |
| Pause button, `pauseLabel` „Suche pausieren“/„Suche fortsetzen“ | — | **REAL** `savedNeeds.setStatus({ needId, status: "paused" \| "active" })` | disable while in flight | — | `INCOMPLETE_NEED` on resume with empty city → §7.3 |
| Avatar `initials` | `users.current` → `displayName ?? username` | **REAL** | show a neutral circle while `undefined` | „Dein Konto“ fallback (existing shell string) | — |
| Menu „Einstellungen“ | opens the Settings dialog at `sources` | route/UI | — | — | — |
| Menu „Zurück zum Scout“ | closes the dialog | UI | — | — | — |
| Toast (`notify`) | **NEW-BE** — see §10.1 | prototype fires 5 toasts from script timers | — | — | — |
| Hint („Prototyp: …“) | **DEMO** — delete (§8) | — | — | — | — |
| Transcript sheet „Mitschrift“ | `scout.listMessages` ascending by `createdAt`. Rows are `{ key, role, text, status, createdAt }` — key on **`key`**, not `_id`. `role` has **three** values: `assistant → "Dein Scout"`, `user → "Du"`, **`system` → do not render as a speaker** (drop it, or render it as an unattributed note; the prototype has no third speaker) | **REAL** | „Mitschrift“ header + skeleton rows | see the two shipped empty bodies in §4.2 | inline retry |
| Message body rendering | **markdown-emphasis contract, pinned by `ScoutConversation.test.tsx`:** a Scout message renders `**bold**` as `<strong>` and escapes any other markup (`<script>…</script>` stays literal text); a **user** message keeps its asterisks literal. Reproduce both, in both languages | **REAL** | | | |
| Demo control bar | **DEMO** — do not build (§8) | — | — | — | — |

The `notify()` semantics — "only fires while the user is not on the Scout view" — become "only fires
while the Settings or Operator dialog is open". Toast copy must come from real events (§10.1), not
from stage transitions.

### 4.1 Stage `welcome`

| Element | Copy | Binding | Backend |
|---|---|---|---|
| Greeting | „Hey {name}.“ | `users.current.displayName ?? username` | **REAL** `users.current` |
| Headline | „Finden wir euren Proberaum.“ | static | — |
| Primary CTA | „Mit Scout sprechen“ | `voice.connect()` | **REAL** `POST /api/realtime/session` |
| Secondary CTA | „Lieber schreiben“ | open the composer | UI only |
| Footnote | „Du erzählst. Dein Scout kümmert sich.“ | static | — |

- **Loading**: while `need === undefined` show the blob + greeting skeleton, both CTAs disabled.
  Never show `welcome` before `getOrCreateDraft` resolved — a click on „Mit Scout sprechen“ without
  a scout context makes the session endpoint answer **409 „Start a Scout conversation first“**.
- ⚠ **`POST {convex.site}/api/realtime/session` is an HTTP action, not a Convex function.** Its
  failures are **plain-text HTTP responses**, so the §7.3 `ConvexError` code map never sees them and
  the voice-start failure path must be mapped separately (`convex/voice.ts:235-262, 300-327`):

  | status | body | treatment |
  |---|---|---|
  | 403 | `Origin not allowed` | deployment/config fault → generic §7.3 rule 3 copy, no retry button |
  | 415 | `Content-Type must be application/sdp` | client bug — must never reach a user; log and show rule 3 |
  | 401 | `Unauthenticated` / `Invalid authenticated identity` | re-auth: route to sign-in |
  | 409 | `Start a Scout conversation first` | the bootstrap has not finished → stay on the skeleton and retry once |
  | 400 | `Invalid SDP offer` | client/browser fault → rule 3 + „Erneut versuchen“ |
  | 503 | `Realtime voice is not configured` | `OPENAI_API_KEY` missing → hide the voice CTA entirely (§9.4), do not offer a retry |
  | 502 | `Realtime connection failed` | transient → „Erneut versuchen“ |
  | *(passthrough)* | OpenAI's own status with **up to 1000 chars of its body** | ⚠ **never render this body** — §7.3 rule 4 (`safeProviderError`) applies to HTTP too |
  | *(throw)* | `voiceSession` 3/h rate limit throws before any response | §7.3 rule 2 copy |
- **Error**: draft init failure → the existing pair „Dein Scout macht sich bereit …“ +
  „Erneut versuchen“ (pinned by `ScoutPage.test.tsx`: *draft-init failure shows a retry without
  starting voice or provider work*).
- ⚠ Keep the existing behaviour that draft entry is **voice-first** and the chat only appears after
  „Lieber schreiben“ — also pinned by `ScoutPage.test.tsx`.

### 4.2 Stage `discovery`

| Element | Binding | Backend | Notes |
|---|---|---|---|
| Blob + `blobAnim` | `voice.status` → `scoutState` (§3.5) | **REAL** | |
| `utterLabel` „Dein Scout“ / „Du“ | latest `voice.transcript` item's `role` | **REAL** | |
| `scoutStateText` „Ich höre zu“ / „Mikro aus“ / „Ich denke kurz nach“ | `voice.status` + `voice.muted` | **REAL** | |
| `utterText` / `utterHidden` | the streaming delta of the latest non-final transcript item | **REAL** | do not re-implement the reveal timer |
| Fact capsule + flight | a new/changed entry in `factsFromNeed(need)` after the model called `update_search_draft` | **REAL** (`voice.executeTool` → `internal.savedNeeds.updateFromScout`) | `ScoutFactList` already animates new / changed / moved rows |
| Mic control | `voice.setMuted` | **REAL** | |
| „Mitschrift“ | `transcriptOpen` (UI) over `scout.listMessages` | **REAL** | |
| „Gespräch beenden“ | `voice.disconnect()` | **REAL** | on end, if `facts.length > 0` set `ui.briefRequested = true` (this is `finishVoice()` today) |
| „Zum Schreiben wechseln“ | `voice.setModality("text")` | **REAL** | |
| Suggestion chip | **DEMO** — the four scripted user lines + „Ja, leg los.“ | — | replace with the three existing starters, shown only while the thread has no messages: "We need a permanent room for our band" / "We are open to sharing with a compatible band" / "Help me work out what matters before we search" (needs DE translations, §11 Q8) |
| Composer send | `scout.sendMessage({ threadId, message })` **action** | **REAL** | keep the draft on failure (`onSend` returning `false`) |
| `discoveryPlaceholder` | „Antwort an deinen Scout …“ / „Dein Scout spricht …“ | `voice.status === "speaking" \|\| sending` | **DERIVED** |
| „Gespräch beendet. Eure Wünsche bleiben als Entwurf gespeichert.“ | `voice.status ∈ {disconnected}` and `need.status === "draft"` | **DERIVED** | truthful: the need really is a persisted draft |
| „Gespräch fortsetzen“ | `voice.connect()` | **REAL** | |
| „Suchauftrag ansehen“ (`hasFacts`) | `factsFromNeed(need).length > 0` | **REAL** | sets `ui.briefRequested` |
| `matches(input, ref)` fuzzy matcher | **DEMO** — delete | — | the real Scout interprets free text; the „Prototyp: Freitext wird hier nicht interpretiert.“ hint must not be translated, it must be **removed** |

- **Loading**: `scout.listMessages` `status === "LoadingFirstPage"` → three skeleton bubbles.
- **Empty**: ⚠ the shipped app does **not** treat an empty transcript as `welcome`. `ScoutPage.tsx:174-197`
  synthesises a single Scout bubble, chosen by whether memory exists (both strings need DE, §11 Q8):
  - `memory.facts.length > 0` → "I have your saved music context. Tell me what kind of rehearsal
    situation you want now."
  - otherwise → "Tell me about your band and the room you need. I’ll turn the useful details into a
    search you can review." (note the typographic apostrophe `’`)

  Keep that behaviour: `welcome` is the stage before a thread exists; once the composer is open an
  empty transcript shows one of these two opening bubbles, not blank space.
- **Deep links already exist and must keep working** (`ScoutPage.tsx:145-171`): `?mode=` accepts
  `search_discovery | signal_advisor | outreach_drafting`, and `?signalId=` is **required** for the
  latter two. The page calls `scout.setFocus({ threadId, mode, activeNeedId, focusedSignalId })`
  from them on every change. `setFocus` throws `THREAD_NOT_FOUND`, `SIGNAL_NOT_FOUND` and
  `SIGNAL_REQUIRED` (a non-`search_discovery` mode with no signal) — all three belong in §7.3, and
  §11 Q11 must be answered without breaking this contract.
- **Error**: `scout.sendMessage` throw → keep the draft in the input, render the error under the
  composer via the §7.3 code map; rate limit → „Kurz durchatmen: …“. `sendMessage` throws
  `INVALID_MESSAGE` for an empty or >4000-character message (`convex/scout.ts:259-261`), so the
  composer must enforce 1…4000 client-side and show a counter past ~3800.

### 4.3 Stage `brief_review`

| Element | Binding | Backend |
|---|---|---|
| Headline „So suche ich für euch.“ | static | — |
| Fact card „Euer Suchauftrag“ | `factsFromNeed(need)` — order/labels pinned by `viewModel.test.ts` | **REAL** `savedNeeds` |
| Row values | `location · arrangement · budget · radius · schedule · requirements · sharing · music · instruments · connections · facet:*` | **REAL** |
| A facet below 0.75 confidence | value + „ · noch zu klären“ | **REAL** — pinned by `viewModel.test.ts` |
| **Every label and value `factsFromNeed` emits is an English string** | see the dictionary below | **REAL** — the single most-used copy block on the Scout surface |
| Edit (pencil) → inputs → „Übernehmen“ | `savedNeeds.update({ needId, ...changed })` | **REAL** |
| „Abbrechen“ | discard the local buffer | UI |
| **„Scout losschicken“** | **`mandates.enableDefaultAutopilot({ savedNeedId })`** | **REAL** |
| Caption „Ich suche und frage selbstständig an.“<br>„Eine verbindliche Zusage gibst nur du.“ | static, **legally load-bearing** | — |
| „Noch etwas ändern“ | enter edit mode | UI |
| „Zurück zum Gespräch“ | back to `discovery` (`ui.briefRequested = false`) | UI |
| Mobile sheet variant | same bindings | — |

**`factsFromNeed` copy dictionary** (`src/features/scout/viewModel.ts:28-115`) — a row only appears
when its field is set, so the fact card is a variable-length list, never a fixed grid. Every string
below is shipped English and needs a German counterpart; the German column is the prototype's own
wording where the prototype has one, otherwise **to be written** (§11 Q14).

| key | EN label | EN value template | note |
|---|---|---|---|
| `location` | `Location` | `[city, ...districts].filter(Boolean).join(" · ")` | omitted when both are empty |
| `arrangement` | `Arrangement` | `Permanent room` \| `Shared room` \| `Hourly room`, joined `" · "` | the three `arrangementLabels` |
| `budget` | `Budget` | `` `Up to €${maxBudgetEur} / month` `` | ⚠ literal `€`, literal `/ month` |
| `radius` | `Radius` | `` `${radiusKm} km` `` | |
| `schedule` | `Schedule` | `schedule.join(" · ")` | free text from the user |
| `requirements` | `Essential` | `requirements.join(" · ")` | ⚠ label is `Essential`, **not** "Requirements" |
| `sharing` | `Sharing` | `Open to a compatible band` \| `Not looking to share` | boolean `openToSharing` |
| `music` | `Music` | `genres.join(" · ")` | |
| `instruments` | `Instruments` | `instruments.join(" · ")` | |
| `connections` | `Connections` | `Open to band connections` \| `Room search only` | boolean `collaborationOpen` |
| `facet:{ns}:{key}` | `facet.key.replace(/[_-]/g, " ")` — **an unlocalisable, model-authored label** | array → `join(" · ")`; boolean → **„Ja“ / „Nein“**; else `String(value)`; then `+ " · noch zu klären"` when `confidence < 0.75` | ⚠ the facet renderer already mixes languages today: a German „Ja“/„Nein“ under an English machine-generated label. Decide one (§11 Q14) |

- **The primary button is `disabled={working || !need.city.trim()}`.** Keep it — an empty city is the
  `getOrCreateDraft` default and the server throws `INCOMPLETE_NEED`. Show the reason next to the
  disabled button rather than only disabling it.
- `enableDefaultAutopilot` in one call: requires a non-empty `city`; reuses a non-expired
  `negotiation_autopilot` mandate with `commitmentBoundary:"non_binding_outreach_only"`; otherwise
  takes up to 50 active `sourcePlatforms` minus the need's `exclude` preferences,
  10 contacts/day, 30 browser-min/day, `maxMonthlyPriceEur = need.maxBudgetEur`, 30-day expiry, both
  stop conditions on; supersedes the previous mandate; sets the need `active`; writes
  `auditEvents: mandate.default_autopilot_activated`; schedules `internal.matches.recomputeNeed`.
  It grants `[send_email, submit_webform, send_platform_dm, create_portal_account, publish_listing,
  propose_visit_time]` — **not** `share_contact_details`.
- ⚠ `ScoutPage.test.tsx` pins: *the persisted mandate starts only after reviewing the brief and
  confirming.* Do not start a mandate from the welcome or discovery stage.
- **Error**: two different codes, from two different paths — do not conflate them:
  - **`savedNeeds.update({ city: "" })`** (the fact editor on this card) runs `requiredText` and
    throws `ConvexError({ code: "INVALID_FIELD", field: "city" })` (`convex/savedNeeds.ts:46-52`).
    ⚠ **`INVALID_FIELD` carries a `field` payload** (`"title"` and `"city"` today) and the inline
    error must key off it to land on the right input. A code-only map cannot route it.
  - **`INCOMPLETE_NEED`** comes from `setNeedStatus` / `mandates.enableDefaultAutopilot`
    (`convex/lib/needLifecycle.ts:22`) — i.e. from „Scout losschicken“, not from an edit. §7.3 copy
    pointing at the missing city, with a shortcut into the city field; keep the card open.
  - `savedNeeds.update` also throws `NEED_NOT_FOUND` and `NEED_ARCHIVED`, and `INVALID_BUDGET` for a
    non-finite or negative `maxBudgetEur`.
- ⚠ `saveEdit` in the prototype is silent (no flash, no log, no `offerStale`). In the port,
  `savedNeeds.update` bumps `matchingRevision`, retires stale matches and re-triggers matching —
  which **is** the real "the offer must be re-checked" effect. Surface it (§4.8 stale banner).

### 4.4 Stages `scouting` / `waiting` / `following_up` (the autopilot screen)

| Element | Binding | Backend |
|---|---|---|
| Headline „Ich kümmere mich darum.“ | static | — |
| Status line | `deriveStatusLine()` (§3.4) | **DERIVED** |
| „Fortsetzen“ (when paused) | `savedNeeds.setStatus({ needId, status: "active" })` | **REAL** |
| Brief pill `compactBrief` | ⚠ prototype hard-codes „Stuttgart · “ — must become `` `${need.city} · ${budgetLabel}` `` | **REAL** |
| Brief panel rows | `factsFromNeed(need)` | **REAL** |
| Activity toggle + list | **NEW-BE** §10.1 | today: no query |
| Side-note composer „Möchtest du mir noch etwas sagen?“ | `scout.sendMessage({ threadId, message })` | **REAL** — the prototype's clear-and-hint behaviour is **DEMO**; the real Scout can act on it |
| Side-note mic button | `voice.connect()` | **REAL** |
| Footer „Du kannst die App schließen. Ich melde mich.“ | truthful only once a mandate is active **and** a notification path exists | see §9.5 |
| Blocked-source „Quelle auswählen“ | `blockers.noUsableSource` → open Settings → Quellen | **DERIVED** (§3.3) |
| Blocked-access row + „Zu den Zugängen“ | `blockers.portalReauth` → open Settings → Quellen & Zugänge | **DERIVED** (§3.3) |

#### 4.4.0 Before the card exists: `drafted` → `externalActions.submit`

⚠ **A request created by a Scout tool starts in `drafted`, and nothing in the prototype advances
it.** `externalActions.submit({ requestId })` (`convex/externalActions.ts:387-392`, mutation) is the
public function that moves it on. Without it the request is invisible: §3.3's `release` blocker only
matches `awaiting_approval`, so a `drafted` row produces no card and the user has no affordance.

It returns `{ status, authorizedByMandate, reasons: string[] }` and the **status it returns decides
the next screen**:

| returned `status` | meaning | UI |
|---|---|---|
| `awaiting_approval` | no standing mandate, or the mandate does not cover this | the approval card (§4.4.1) |
| `queued` | under a mandate, but Scout is re-checking the final message first | „Ich prüfe den Text noch einmal.“ — no card yet, no send |
| `approved` | authorized by the standing mandate, no exact approval needed | the autopilot card („Von deinem Handlungsspielraum gedeckt“), then the executor runs |
| `expired` | the search or conversation changed under it | the outcome card (§4.4.2) |

⚠ **`reasons[]` is user-facing copy authored on the server** (English; needs DE, §11 Q9). The four
strings it can return are:

- "The selected standing mandate is not valid for this search."
- "Autonomous demo communication is restricted to roomscout.dev."
- "Scout is checking the final message before authorization."
- "The search or provider conversation changed."
- *(plus)* the model's own `semantic.assessment.explanation` when the final-message check refuses
  autonomy — which is **model output** and falls under §7.3 rule 4 / §11 Q9 like every other
  server-authored string.

`submit` also throws `ACTION_NOT_FOUND`, `INVALID_ACTION_STATE` (not `drafted`) and
`ACCEPTANCE_REVIEW_REQUIRED` (an acceptance must go through §4.9, never through `submit`).

#### 4.4.1 The approval card (prototype `pending` / `waitingFor:'release'`)

This is the single most important binding on the surface. The prototype composes the message text
client-side from a template. **The port must not.**

The card already exists as `ActionApprovalSheet` (`src/components/actions/ActionApprovalSheet.tsx`)
and its copy is shipped English that must enter the dictionary:

| element | string | source |
|---|---|---|
| title (needs approval) | "This step needs you" | `ActionApprovalSheet.tsx:89` |
| title (mandate-covered) | "Handled by Autopilot" | same |
| description | `` `${kindLabels[kind]} · exact payload version ${contentVersion}` `` | `:84` |
| one-time banner | "**One-time approval:** nothing executes until you approve this exact destination and payload." | `:96` |
| mandate banner | "Covered by Autopilot" / "Outside the current Autopilot boundary" + `` `${mandateLabel} · version ${mandateVersion}` `` + " allows this non-binding action." / " does not cover this exact action, so your decision is required." | `:94` |
| effect row | "**What will happen:** " + `effect` | `:97` |
| `effect` values | "Execute the exact displayed external action once." · `` `${operation} the selected portal account.` `` (`portal_account_operation`) | `MusicianInboxPage.tsx:120` |
| `actingAs` values | `mailbox?.emailAddress ?? "Personal Scout mailbox"` (email) · "Connected portal identity" (everything else) | `MusicianInboxPage.tsx:119` |
| table rows | "Destination" · "Acting as" · "Action" · "Authorization" → "Autopilot v{n}" / "Your decision" | `:98` |
| payload section | "Exact payload" | `:99` |
| **acknowledgement** | "I approve this exact destination and payload for one execution." | `:102` |
| buttons | "Reject" · "Approve once" / "Saving…" · "Close" · "Pause mandate" / "Pausing…" | `:85-86` |
| hard boundary | "Autopilot never authorizes terms, contracts, bookings, payments, deposits, passwords, 2FA, or CAPTCHA." | `:104` |

⚠ **The prototype's card has no acknowledgement checkbox. Add it** — §1 rule 2 requires one for
every send, §4.9 has one for acceptance, and the shipped sheet already has it. It is cleared
whenever the sheet closes.

`kindLabels` (**7 entries**, keyed by the backend `requestedActionType`, `:16-24`):
`send_email` → "Send email" · `submit_webform` → "Submit web form" · `send_platform_dm` → "Send
platform message" · `create_portal_account` → "Create portal account" · `publish_listing` →
"Publish listing" · `share_contact_details` → "Share contact details" · `propose_visit_time` →
"Propose visit time".

| Prototype | Real |
|---|---|
| `pending.to` = „Anbieter · Raum in Stuttgart-West · roomscout.dev“ | the persisted `payload` destination: `recipientEmail` (`email_message`) · `targetUrl` (`contact_form`) · `recipients.join(", ") \|\| "Existing platform thread"` (`platform_message`) · `` `Portal connection ${connectionId}` `` (`portal_account_operation`) |
| `pending.text` = a client-built string | `payload.body` / `payload.fields[]` — **rendered from the persisted row, never re-composed** |
| Eyebrow „Freigabe nötig“ | `action.status === "awaiting_approval" && action.automationMode === "exact_once"` |
| „Anschreiben ist in deinem Handlungsspielraum deaktiviert. …“ | `mandateRequiresExactApproval(...)` from `src/features/agentOperations/mandatePolicy.ts` |
| **„Nachricht freigeben“** | **two different function families, chosen by which table the row lives in** — see the decision table below |
| „Handlungsspielraum ändern“ | open Settings → Handlungsspielraum |

**Which approval path, by row type** — ⚠ the two have *nothing* in common but the word "decide":

| row | decide | then |
|---|---|---|
| `actionRequests` (`externalActions.listMine`) — webform, platform message, portal operation, email action | `externalActions.decide({ requestId, decision: "approved" \| "rejected", expectedContentVersion, expectedContentHash, expectedPayload })` (`convex/externalActions.ts:508`) | the executor, below |
| `outreachDrafts` (`outreach.listMine`) — the email-draft path used by `ApprovalComposer` | `outreach.decide({ draftId, decision, expectedContentVersion, expectedContentHash, expectedRecipientEmail, expectedSubject, expectedBody })` (`convex/outreach.ts:324-336`) — ⚠ **no `requestId`, no `expectedPayload`; the three expected fields are the recipient, subject and body themselves** | `outreach.sendApproved({ draftId })` (`convex/outreach.ts:395`) — that is its **whole** argument list |

**After `externalActions.decide` — the executor, by `action.executor`** (five values). Both
executors are **ACTIONs**, both return an `executionId`, and the `executionId` is what every
post-approval control needs:

| `executor` | run | returns | Live View | human step |
|---|---|---|---|---|
| `firecrawl` | `firecrawlInteract.executeApproved({ requestId })` **ACTION** | `{ executionId, executionStatus, state, reasonCode, jobId?, liveViewUrl?, interactiveLiveViewUrl?, filled[], missing[], blockers[] }` | **`liveViewUrl` / `interactiveLiveViewUrl` are returned by this call and by nothing else** — hold them in React state for the life of the run | `firecrawlInteract.completeApprovedHumanStep({ requestId, executionId, submitted })` **ACTION** — stops the Firecrawl job, *then* records the outcome |
| `browserbase` | `browserbasePortal.executeApprovedWrite({ requestId })` **ACTION** | `writeResultValidator` (includes the execution id) | `browserbasePortal.getApprovedWriteLiveView({ executionId })` **ACTION** → `{ url, expiresAt }`, TTL ≤ 60 s per call; throws `WRITE_LIVE_VIEW_NOT_AVAILABLE` / `WRITE_LIVE_VIEW_EXPIRED` | `browserbasePortal.completeApprovedWriteHumanStep({ requestId, executionId, submitted })` **ACTION** — releases the provider session, *then* records the outcome |
| `agentmail` | the `outreach` path above (`decide` → `sendApproved`) | — | none | none |
| `manual` | no provider run | — | none | `externalActions.confirmHumanCompleted({ requestId, submitted })` **mutation** |
| `direct_api` | not reachable from this surface today | — | — | — |

⚠ **`externalActions.confirmHumanCompleted` is correct only for the `manual` executor.** It takes no
`executionId` and closes no provider session (`convex/externalActions.ts:576-596`). Calling it for a
`firecrawl` or `browserbase` run leaves the browser session open. Use the executor-specific
completion action above.

**A cancel affordance is required while a run is open**: `browserbasePortal.stopApprovedWrite({
executionId })` (**ACTION**) releases the session and finishes the execution as
`failed / USER_STOPPED_BROWSER_WRITE`. There is no Firecrawl equivalent; there,
`completeApprovedHumanStep({ submitted: false })` is the cancel.

Rules that must hold:

- The approval is **hash-pinned**. Send `expectedContentVersion` + `expectedContentHash` +
  `expectedPayload` from the row the user is looking at. ⚠ **The code is `ACTION_CONTENT_CHANGED`**
  (`convex/externalActions.ts:517`), *not* `MANDATE_CONTENT_CHANGED` — that one is only thrown by
  `mandates.activate` (§5.2). Show „Nichts wurde gesendet.“ and re-read; never silently re-approve.
  The `outreach` path's equivalent is `DRAFT_CONTENT_CHANGED`.
- ⚠ `executor` has **five** values (`firecrawl`, `browserbase`, `agentmail`, `direct_api`, `manual`).
  The inbox page today throws "This action does not have a supported provider executor." for three
  of them. The port must handle `agentmail` and `manual` rather than throw.
- `ActionLifecyclePanel.test.tsx` pins: *provider execution is never exposed before exact approval*;
  *Live View stays ephemeral*; *human completion is explicit*. Live-View URLs live in React state
  only and are never persisted or logged.

- **Loading**: `actions === undefined` → hide the card entirely, do not show a skeleton approval.
- **Empty**: no awaiting row → no card. This is the normal autopilot state.
- **Error**: `ACTION_CONTENT_CHANGED` → replace the card with „Die Nachricht hat sich geändert.
  Nichts wurde gesendet.“ + a re-read button; rate limit (`portalWriteUser` 10/day) → §7.3. The full
  approval error family is in §7.3.

#### 4.4.2 The outcome card — `rejected` · `failed` · `cancelled` · `expired`

⚠ **Nothing in the prototype covers the end of a request that did not succeed**, and §7.3 rule 1
forbids a send disappearing without a user-visible outcome. Five of the ten
`actionRequests.status` values had no treatment anywhere in this plan; here they are:

| status | reached by | copy (DE to be written, §11 Q3) |
|---|---|---|
| `drafted` | Scout tool created it, `submit` not called | §4.4.0 — an affordance, not an outcome |
| `rejected` | the user pressed „Ablehnen“ | „Nichts wurde gesendet.“ + „Neu vorbereiten“ |
| `cancelled` | `confirmHumanCompleted({ submitted: false })` → `error: "USER_DID_NOT_SUBMIT"` | „Du hast abgebrochen. Nichts wurde gesendet.“ |
| `failed` | executor failure; `request.error` is set (≤ 1000 chars) | „Es hat nicht geklappt. Nichts wurde gesendet.“ ⚠ **never render `request.error`** — §7.3 rule 4 |
| `expired` | `submit` found the context changed (`MESSAGE_CONTEXT_CHANGED`), or the review window elapsed | „Die Anfrage ist nicht mehr aktuell. Nichts wurde gesendet.“ + „Neu vorbereiten“ |
| `executed` | success | the following-up / activity line, §10.1 |

The card must survive a stage change: an outcome belongs to the request, not to the stage that
produced it. Render it until the user dismisses it.

### 4.5 Stage `clarification`

| Element | Binding | Backend |
|---|---|---|
| Headline „Eine kurze Rückfrage.“ | static | — |
| Eyebrow (prototype: „Raum in Stuttgart-West“) | the real source is **`signal.district`** (an optional field on `signalProjectionValidator`, `convex/signals.ts:12`) — `` `${signal.city}-${signal.district}` `` when `district` is set, else `signal.city`. Do **not** derive it from `signalTitle`. Hide the eyebrow when the opportunity has no `signalId` | **REAL** |
| Title fallback | `matches.find(m => m.signalId === opportunity.signalId)?.signalTitle` | **REAL** |
| Question | `opportunity.uncertainties[0]` | **REAL** |
| Detail line (prototype: „280 € inklusive Nebenkosten. …“) | `opportunity.reasons[0]` | **REAL** |
| „Ja, Mittwoch passt“ / „Nein, Donnerstag ist wichtig“ | **NO typed answer channel exists** — see below | ⚠ |
| Free-text composer | `scout.sendMessage({ threadId, message: \`About the current opportunity: ${question}\` + answer })` | **REAL** |
| „Sprechen“ | `voice.connect()` | **REAL** |
| Answer bubbles | `scout.listMessages` | **REAL** |

⚠ **A second, better source for this stage exists and §3.1 does not use it.**
`providerAssessment.nextAction` (`convex/lib/providerAssessment.ts:9`) is a persisted, model-produced
enum — `ask_provider | ask_musician | present_offer | decline | wait | stop` — and
**`nextAction === "ask_musician"` maps directly onto this stage.** It is a stronger signal than
"`uncertainties` is non-empty", because it is the model's own decision that the *user* is the one
who has to answer. Recommended: enter `clarification` when either an opportunity has unresolved
`uncertainties` **or** a current offer's `assessment.nextAction === "ask_musician"`, and use
`assessment.uncertainties[]` as the question text in the second case. See §11 Q15.

⚠ **`opportunity.uncertainties[]` is a `string[]`.** There is no structured question object, no
answer options and no answer endpoint. The prototype's two fixed Ja/Nein buttons cannot be derived.

Treatment (recommended): render the question and **one** composer. Offer quick-reply chips only if
they are generated from the question text by the Scout itself, never hard-coded. The opportunity's
uncertainties are cleared by the **backend re-assessment**, not by the client — so after sending,
show „Ich kläre das.“ and let the stage change when `opportunities.listMine` updates.

- **Loading**: `opportunities === undefined` → previous stage's skeleton, not an empty question card.
- **Empty**: no unresolved opportunity → the stage simply does not apply.
- ⚠ **Disappearing stage**: `opportunities.listMine` hides stale `new`/`reviewing`/`saved` rows, so
  the clarification card can vanish mid-read. Do not treat that as an error; fall through to the next
  stage and, if the user had typed something, keep the draft.
- ⚠ **The prototype offers no way out of a clarification, and §9.16 did not add one.** Two public
  mutations exist and belong on this card (`convex/opportunities.ts:64, 79`):
  - „Nicht weiterverfolgen“ → `opportunities.updateStatus({ opportunityId, status: "dismissed" })`.
    The `status` enum is `new | reviewing | saved | dismissed | contacted | converted | expired`.
  - „An mich übergeben“ → `opportunities.createHandoff({ opportunityId, channel: "platform" |
    "email" | "manual", summary })` → `Id<"handoffs">`. `summary` is trimmed, whitespace-collapsed
    and capped at 2000 chars; empty throws `INVALID_SUMMARY`.
- **Error**: `OPPORTUNITY_NO_LONGER_MATCHES` → „Diese Rückfrage ist nicht mehr aktuell.“ + re-read.
  ⚠ `updateStatus` throws it too, but **only** when moving to `new`/`reviewing`/`saved` — moving to
  `dismissed` always succeeds, so the dismiss path is always available (`convex/opportunities.ts:71`).
  `OPPORTUNITY_NOT_FOUND` covers both mutations.

### 4.6 Stage `dead_end` — **not derivable, do not build** (see §9.1)

The three compromise controls are worth keeping, relocated. As a permanently available
„Suchauftrag anpassen“ affordance on `waiting`:

| Prototype option | Real mutation |
|---|---|
| „Budget bis 400 €“ | `savedNeeds.update({ needId, maxBudgetEur })` — validated finite ≥ 0, else `INVALID_BUDGET` |
| „Umland einbeziehen“ | `savedNeeds.update({ needId, districts })` or `{ radiusKm }` |
| „Mittwoch doch erlauben“ | `savedNeeds.update({ needId, schedule })` |

All three already re-trigger matching (`refreshNeedMatching` bumps `matchingRevision`, retires stale
matches, schedules `internal.matches.recomputeNeed` when active). The scripted card copy
(„Der Anbieter kann Donnerstag nicht anbieten. …“) is **DEMO** and must be rewritten generically.

### 4.7 Stage `candidates`

| Element | Binding | Backend | Verdict |
|---|---|---|---|
| Headline „Drei Räume, die in Frage kommen.“ | must become a count from `matches.length` | **DERIVED** | copy needs `{n}` |
| Subline „Ich habe die Unterschiede nebeneinander gelegt. Ihr entscheidet, wo ich anfrage.“ | static | — | keep |
| Card name | `match.signalTitle` | **REAL** | |
| Card price | `match.signal.priceEur` + `pricePeriod` (`"hour" \| "month" \| "unknown"`) | **REAL** | when absent → omit the price line, do not print „—“ |
| `budgetText` „Im Budget“ / „Über eurem Budget ({n} €)“ | `signal.priceEur <= need.maxBudgetEur` | **DERIVED** | only when both exist |
| Time row | ⚠ no dedicated field — `signal.requirements[]` / `signal.summary` | **partial** | render only if present |
| Storage row (check / cross) | `signal.requirements[]` matched against `need.requirements[]` | **DERIVED** | or hide |
| Eyebrow / district | **`signal.district`** (optional) → `` `${signal.city}-${signal.district}` ``, else `signal.city` | **REAL** | the real source for the prototype's „Stuttgart-West“; never parse it out of `signalTitle` |
| „12 Min. mit der Stadtbahn“ | **NO-BE** — no travel-time field | | **hide** |
| „ca. 28 m²“ | **NO-BE** — no size field | | **hide** |
| „geteilt mit einer Band“ | ⚠ **REAL after all** — `signal.arrangement` is `permanent \| shared \| hourly \| unknown` (`convex/signals.ts:14-19`). `shared` **is** the co-tenant fact. Render it as the arrangement, never as a person count („mit einer Band“ implies a number the backend does not have); `unknown` → omit the row | **REAL** | corrects §9.2 |
| Honest caveats | **`signal.unknowns[]`** (`string[]`) — the listing's own declared gaps, distinct from `match.uncertainties[]` (the *matching* model's doubts). Render both, labelled differently | **REAL** | |
| Evidence breadth | **`signal.sourceCount`** (number) — how many independent sources back this listing; pairs with `verification` | **REAL** | |
| **Demo provenance** | **`signal.isDemo?: boolean`** | **REAL** | ⚠ **load-bearing.** This plan's thesis is "never show fabricated listing data". A demo-provenance signal must be **badged** („Kontrollierte Demo-Quelle“) wherever it appears — candidate card, offer, acceptance review, map — or filtered out. Silent rendering of an `isDemo` signal next to a real one is exactly the failure the rules forbid. §11 Q16 |
| Photo / „Foto folgt vom Anbieter“ | **NO-BE** — no image field on `signals` | | **hide the media cell entirely**; do not render a placeholder that implies a photo is coming |
| Scout note (prototype `c.note`) | `match.reasons[0]` | **REAL** | |
| Caveat line | `match.uncertainties.join(" · ")` | **REAL** | |
| „Mein Vorschlag“ badge | `matches[0]` after the server's own `score` ordering | **DERIVED** | never re-rank client-side by price |
| Verification / freshness chip | `signal.verification` (`observed \| verified \| conflicting`), `signal.status` (`published \| stale`), `lastSeenAt` | **REAL** | use `publicSignalToMarketSignal` |
| **„Diesen Raum anfragen“** | **gate on `match.contactEligible === true` first** (see below), then `scout.setFocus({ threadId, mode: "outreach_drafting", activeNeedId, focusedSignalId: match.signalId })` → `scout.sendMessage({ threadId, message: <the existing inquiry prompt> })` → the Scout's `createOutreachDraft` / `createWebformDraft` tool persists a draft → §4.4.0 / the approval sheet | **REAL** | a **request for a draft**, not a send — ⚠ except under a standing mandate, where `createWebformDraft` can come back `approved`/`queued` (§3.5) |
| `contactEligible === false` | **no CTA.** `matches.listMine` returns `contactEligible: boolean` on every row (`convex/matches.ts:651`) — it is the server-side answer to "may this listing be contacted at all". Render the card without the primary CTA and with the reason line „Für diesen Raum ist noch kein Kontaktweg geprüft.“ (DE final wording §11 Q3). Do **not** wire the CTA unconditionally and let it fail later | **REAL** | |
| „Keiner passt, weiter suchen“ | `matches.updateStatus({ matchId, status: "dismissed" })` for each shown match | **REAL** | `dismissed` always succeeds even on a stale match |
| Brief pill | `factsFromNeed(need)` | **REAL** | |
| Per-card „Dismiss“ | `matches.updateStatus({ matchId, status: "dismissed" })` | **REAL** | |
| Open detail | `Link` to `/signals/:signalId` **and** `matches.updateStatus({ matchId, status: "seen" })` | **REAL** | the `matchStatus` enum is `new \| seen \| saved \| dismissed \| contacted` (`convex/matches.ts:23-29`). ⚠ `seen`/`saved` throw `MATCH_NO_LONGER_CURRENT` on a stale match; `dismissed` never does |
| Detail page data | `signals.get({ signalId })` → **`{ signal, evidence[] } \| null`** — ⚠ the title is `.signal.title`, not `.title`. `evidence[]` is up to **12** rows of `{ _id, sourceName, sourceUrl, sourceTitle, excerpt, observedAt }` and is the real provenance surface for a listing: render it. `signals.requirePublic({ signalId })` returns the projection alone and **throws** instead of returning `null` | **REAL** | |
| „Aktualisieren“ | `matches.recomputeMine({ savedNeedId })` **action**, only while `need.status === "active"` | **REAL** | rate limit `matchRefresh` **2/min** |

- **Loading**: `matches === undefined` → 3 card skeletons (or `n` if a previous count is known).
- **Empty**: `matches === []` → this is `scouting`/`waiting`, not an empty candidates screen. Copy
  must never say "we found nothing" for a non-active need (§2.2).
- **Error**: `MATCH_NO_LONGER_CURRENT` → „Dieser Treffer ist nicht mehr aktuell.“ + remove the card;
  `matchRefresh` limit → §7.3.

### 4.8 Stage `offer`

| Element | Binding | Backend |
|---|---|---|
| Headline „Ein Raum, der zu euch passt.“ | static | — |
| Eyebrow „Angebot eingegangen“ | `conversation.offer.ready === true` (returned as `current && ready`) | **REAL** |
| Title „Euer {roomName}“ | ⚠ `signals.get({ signalId })` returns **`{ signal, evidence[] } \| null`**, so the path is **`.signal.title`**. Cheaper: `matches.listMine[].signalTitle`, already loaded | **REAL** |
| Lead paragraph | **`offer.assessment.summary`** (≤ 1500 chars) — the model's own one-paragraph read of the provider message. `ProviderOfferPanel` and `OfferAcceptanceDialog` both render it as the first thing on the card; the prototype has no equivalent and one must be added | **REAL** — server-authored English, §11 Q9 |
| Price + „/ Monat“ | `offer.assessment.monthlyPrice.totalEur` — ⚠ **nullable** (`v.union(v.number(), v.null())`) | **REAL** |
| Price row, exact shipped rendering | ⚠ the honest wording is **two independent facts on one line**, not a pair of alternatives (`ProviderOfferPanel.tsx:39`, `OfferAcceptanceDialog.tsx:114`): `` `${totalEur === null ? "Not confirmed" : `€${totalEur}`} · ${allRecurringCostsKnown ? "All recurring costs stated" : "Additional costs may be unresolved"}` ``. „inklusive Nebenkosten“ may only render for `allRecurringCostsKnown === true`; **„Weitere Kosten sind möglicherweise offen“ does not exist in the codebase** — the string to translate is "Additional costs may be unresolved", and "Not confirmed" / "All recurring costs stated" also need DE | **REAL** |
| Term rows (2 checks) | `offer.assessment.terms[]` → `{ key, label, value, evidence[] }` — ⚠ each term carries its **own** `evidence: { sourceId, quote }[]` (≤ 8). Render what exists, never a fixed list | **REAL** |
| Availability | `offer.assessment.availability.status` (`available \| unavailable \| conditional \| unknown`) + `availability.evidence[]` | **REAL** |
| Constraint verdicts | **`offer.assessment.constraints[]`** = `{ key, verdict: satisfied \| conflict \| conditional \| unknown, explanation, evidence[] }`, ≤ 60. This is the per-requirement check („Schlagzeug darf bleiben ✓“) the prototype fakes with two static ticks — it is real, and `verdict` is what drives the tick / cross / question mark | **REAL** |
| Open points | `offer.blockers[]` + `offer.assessment.uncertainties[]` (≤ 20, ≤ 700 chars each) | **REAL** |
| **Conflicts** | **`offer.assessment.contradictions[]`** = `{ explanation, evidence[] }`, ≤ 10 — the provider contradicting itself or the listing. This is the genuine "open points" surface the prototype gestures at and it was missing from this plan; render it as its own block, above `uncertainties` | **REAL** |
| Recommended next step | **`offer.assessment.nextAction`** = `ask_provider \| ask_musician \| present_offer \| decline \| wait \| stop`. `ask_musician` → §4.5; `present_offer` → this stage; `decline`/`stop` → do **not** auto-act, surface it as advice | **REAL** |
| Suggested reply | `offer.assessment.suggestedReply` = `{ subject, body } \| null`. ⚠ `ProviderOfferPanel` labels it by `conversation.replyStatus` with **seven** shipped strings that need DE: "Reply · sent" · "Reply · delivery being checked" · "Reply · checking final text" · "Reply · authorized, awaiting delivery" · "Reply · needs your review" · "Reply · failed; not confirmed sent" · "Suggested reply · not sent" | **REAL** |
| Media cell / photo | **NO-BE** → **hide** (§9.2) | |
| Stale banner „Nach deiner Änderung muss das Angebot erneut geprüft werden.“ + „Angaben ansehen“ | `offer.current === false` — the server then **prefixes** `blockers` with "The search, listing or provider conversation has changed. Reassessment is required." | **REAL** ⚠ far better than the prototype's `offerStale`, which was only reachable through the Settings fact editor |
| „Mit Scout sprechen“ / `offerTalk` | `voice.connect()` and let the Scout explain — **not** a canned `OFFER_TALK` string | **REAL** |
| **„Angebot prüfen“** | `offerAcceptance.prepare({ offerId, expectedOfferHash: offer.contentHash })` → store `requestId` in `ui.acceptanceRequestId` → stage becomes `offer_review` | **REAL** |
| Evidence quotes | `assessment.constraints[].evidence`, `availability.evidence`, `monthlyPrice.evidence` — validated server-side against the actual message text | **REAL** |
| Footnote „Vor einer Zusage schauen wir uns alle Konditionen an.“ | static, keep | — |
| Standing footer | keep the existing "An assessment is not a booking or acceptance. Any final commitment needs your exact approval." (DE translation needed) | — |

- ⚠ **The acceptance gate is much narrower than `platformThreadId`.** `ProviderOfferPanel`'s
  client-side test (`offer.current && offer.ready && conversation.platformThreadId &&
  !acceptancePending && !acceptanceSent`) is only a pre-filter. The authority is
  `resolveControlledPortal(ctx, conversation, signal, now)` (`convex/lib/providerPortal.ts:6-35`),
  which `prepare` **and** `approveAndSend` both run, and which additionally requires **all** of:
  1. the signal's platform `canonicalDomain === "roomscout.dev"` and its detail URL matching
     `https://roomscout.dev/listings/{id}`;
  2. an **active** `sourceAdapterBindings` row — executor `browserbase`, adapter `roomscout-dev-v1`
     v1, workflow `roomscout-dev.platform-message.v1`;
  3. an **approved** `sourceFlowPolicies` row — `decision: "allowed"`, `maxAutomationLevel:
     "approved_execute"`, robots + terms `allowed`, `nextReviewAt` in the future;
  4. an **active** `portalConnections` row owned by the user, `policyDecision: "allowed"`,
     `adapterKey: "roomscout-dev-v1"`.

  Missing thread → `CONTROLLED_PORTAL_THREAD_REQUIRED`; anything else missing → `resolveControlledPortal`
  returns `null` and `prepare` fails. `approveAndSend` re-checks the same four and throws
  `ACCEPTANCE_DESTINATION_CHANGED` if any drifted between review and send.

  ⚠ **A UI gated only on `platformThreadId` will offer a review that then fails at prepare time.**
  Either add a small `offerAcceptance.canPrepare({ offerId })` query (§10.8), or treat the button as
  optimistic and render the prepare failure in place („Für dieses Angebot ist kein geprüfter
  Kanal aktiv. Nichts wurde gesendet.“) instead of as a dialog that opens empty.
- **Loading**: `conversations === undefined` → previous stage.
- **Empty**: no offer / `offer === null` → `ProviderOfferPanel`'s existing states: "Your Scout is
  reviewing the provider's message against your search." or, when `conversation.errorCode` is set,
  "The provider update could not be assessed yet. No reply has been sent." (DE needed).
- **Error**: `OFFER_CHANGED` → „Das Angebot hat sich geändert. Nichts wurde gesendet.“ + re-read.
  The full acceptance error family (all missing from §7.3 before this revision) is
  `OFFER_NOT_FOUND` · `OFFER_NOT_READY` · `OFFER_CHANGED` · `OFFER_ACTION_CONFLICT` ·
  `CONTROLLED_PORTAL_THREAD_REQUIRED` · `ACCEPTANCE_NOT_REVIEWABLE` · `ACCEPTANCE_CONTENT_CHANGED` ·
  `ACCEPTANCE_CONTEXT_CHANGED` · `ACCEPTANCE_DESTINATION_CHANGED` · `ACCEPTANCE_EXPIRED` ·
  `ACCEPTANCE_APPROVAL_MISMATCH` · `ANOTHER_ACCEPTANCE_IN_PROGRESS` · `ACCEPTANCE_REVIEW_REQUIRED` ·
  `ACCEPTANCE_MESSAGE_TOO_LONG` · `ACCEPTANCE_RECEIPT_REQUIRED`. Every one of them is in the
  send/accept family and must say „Nichts wurde gesendet.“ (§7.3 rule 1).

### 4.9 Stage `offer_review`

The prototype's one-click „Angebot annehmen“ is **not portable**. Replace with the existing
hash-pinned flow. This is rule 1/2 of §1 and is non-negotiable.

| Element | Binding | Backend |
|---|---|---|
| Headline „Passt das für euch?“ | static | — |
| Eyebrow `reviewTitle` | signal title | **REAL** |
| Dialog title | "Review offer acceptance" | **REAL** `OfferAcceptanceDialog.tsx:98` |
| Dialog description | `` `Offer revision ${descriptor.offerRevision} · exact-once platform message` `` — while preparing: "Preparing an exact acceptance for review" | **REAL** `:89` |
| Section heading | "Offer being accepted" · row label "Monthly total" | **REAL** `:111, :114` |
| Lead paragraph | `descriptor.assessment.summary` | **REAL** `:112` |
| Price line | `descriptor.assessment.monthlyPrice` — same two-fact rendering as §4.8 (`"Not confirmed"` / `€{n}` · `"All recurring costs stated"` / `"Additional costs may be unresolved"`) | **REAL** `offerAcceptance.getMine({ requestId })` |
| Term grid | `descriptor.assessment.terms[]` | **REAL** |
| **„Absender“ / "Sending as"** | `descriptor.actingAs` — server-formatted as `payload.senderLabel ?? "Connected portal account"` (in practice `"RoomScout musician"`) | **REAL** `convex/offerAcceptance.ts:113` |
| **„Empfänger“ / "Destination"** | `descriptor.destination` — server-formatted as `` `roomscout.dev · ${recipients.join(", ")}` `` or `` `roomscout.dev · Existing provider thread` `` | **REAL** `convex/offerAcceptance.ts:112` |
| **„Betreff“ / "Subject"** | `descriptor.subject`, rendered as **"(No subject)"** when empty | **REAL** `:120` |
| **„Exakte Nachricht“ / "Exact message"** | `descriptor.body` | **REAL** `:121` |
| (hidden fields the flow needs) | `descriptor.offerHash`, `descriptor.contentVersion`, `descriptor.contentHash`, `descriptor.reviewContextHash`, `descriptor.offerId`, `descriptor.requestId` — all six go back into `approveAndSend` | **REAL** |
| „Geteilter Raum · 4 Personen“ | `factsFromNeed(need)` `arrangement` row | **DERIVED** |
| „Schlagzeug-Lagerung bestätigt“ · „Beginn: 1. Oktober 2026“ · „Keine Kaution“ · „Kündigungsfrist: ein Monat zum Monatsende“ | **DEMO / NO-BE** — render only if `assessment.terms` contains them; otherwise **hide the row** | |
| „Vollständige Bedingungen anzeigen“ | `descriptor.body` (the exact message) + the evidence quotes | **REAL** |
| „Demo-Bedingungen. Im echten Produkt wäre hier das vollständige Angebot des Anbieters einsehbar.“ | **DEMO** — delete | |
| **Acknowledgement checkbox** (not in the prototype — **must be added**) | "I reviewed these exact terms, sender, destination, subject, and message. RoomScout may send this acceptance once." (DE needed) | required |
| **„Angebot annehmen“** | `offerAcceptance.approveAndSend({ requestId, offerId, expectedOfferHash, expectedContentVersion, expectedContentHash, expectedContextHash, acknowledged: true })` | **REAL** |
| Disclaimer | replace „Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet.“ with the real, existing boundary sentence: "Controlled roomscout.dev platform message only. This does not sign an agreement, book a room, or make a payment." (DE needed) | |
| Buttons | "Cancel" · "Approve and send acceptance" / while working "Approving…" (DE needed) | **REAL** `:91-93` |
| „Noch eine Frage klären“ + composer | `scout.sendMessage({ threadId, message })`; the answer arrives via `scout.listMessages` | **REAL** |
| Canned Q&A pair („Was passiert nach der Zusage?“ / „Ich sage dem Anbieter verbindlich zu …“) | **DEMO** — delete both. The second sentence describes a binding commitment the product never performs automatically. | |

Gating rules, verbatim from `OfferAcceptanceDialog` (pinned by its test file):

```ts
const openedAt      = useState(() => Date.now())[0];   // frozen at mount
const expiredAtOpen = descriptor.expiresAt <= openedAt;
const alreadySent   = descriptor.status === "executed";
const pending       = ["approved", "executing"].includes(descriptor.status);
const failed        = descriptor.status === "failed";
const reviewable    = descriptor.current && descriptor.status === "awaiting_approval" && !expiredAtOpen;
// checkbox disabled unless `reviewable`; primary needs `acknowledged && reviewable && !working`
// acknowledgement is keyed to `${requestId}:${contentVersion}:${contentHash}:${reviewContextHash}`
// and CLEARED on THREE events, not one:
//   1. any of those four values changes (a background revision),
//   2. `approveAndSend` throws  (OfferAcceptanceDialog.tsx:81),
//   3. the dialog closes        (OfferAcceptanceDialog.tsx:61-64).
// The submit error is keyed to the same snapshot, so a stale error disappears with its snapshot.
```

⚠ **The review window is exactly 30 minutes.** `offerAcceptance.prepare` writes
`expiresAt: now + 30 * 60_000` on both the insert and the refresh path
(`convex/offerAcceptance.ts:60, 79`), and `approveAndSend` throws `ACCEPTANCE_EXPIRED` past it
(`:135`). `expiredAtOpen` is frozen at mount, so a dialog left open past the window shows the
expired copy without re-rendering. The port needs a **countdown** from `descriptor.expiresAt` and a
**re-prepare** affordance — calling `prepare` again on an expired `awaiting_approval` request
refreshes it in place with a new `contentVersion` (`:33-35, 50-66`), which is exactly the "start
again from the current offer" path the error copy asks for.

State messages — **twelve**, not seven (all existing, all need DE):

| trigger | string |
|---|---|
| `loading` | "Preparing the exact acceptance…" |
| `descriptor === null` | "This acceptance request is unavailable. Nothing was sent." |
| `!current` | "This review is stale because the offer, search, or conversation changed. Nothing was sent." |
| `expiredAtOpen` | "This approval request expired. Nothing was sent." |
| `status === "failed"` | "The acceptance failed and is not confirmed sent. This exact request cannot be approved again." |
| `status ∈ {approved, executing}` | "Acceptance approved. Delivery is still being checked; this does not yet confirm it was sent." |
| `status === "executed"` | "Acceptance sent." |
| throw containing `OFFER_CHANGED` / `ACCEPTANCE_CONTENT_CHANGED` | "The offer or acceptance message changed. Nothing was sent. Close this review and start again from the current offer." |
| throw containing `EXPIRED` | "This approval request expired. Nothing was sent." |
| any other `approveAndSend` throw | "The acceptance could not be approved. Nothing was sent." |
| any `prepare` throw | "The acceptance could not be prepared. Nothing was sent." |
| empty subject | "(No subject)" |

⚠ The dialog matches on the **substring** `"EXPIRED"` (`OfferAcceptanceDialog.tsx:43`), which is why
it appears to handle an `EXPIRED` code that does not exist — the real codes are `ACTION_EXPIRED` and
`ACCEPTANCE_EXPIRED`. The port's §7.3 map must key on the real codes; substring matching is a
fallback, not the contract.

⚠ **"approved" ≠ "sent".** `ProviderOfferPanel.test.tsx` pins *approved delivery ≠ confirmed sent*.
The copy must keep that distinction.

### 4.10 Stage `complete`

| Element | Binding | Backend |
|---|---|---|
| Headline „Euer nächster Proberaum steht bereit.“ | ⚠ overstates it — an acceptance is not a booking. Rewrite (§11 Q5). | |
| Subline „Demo abgeschlossen — es wurde keine echte Zusage versendet.“ | **DEMO** — delete. Replace with the real notification body: "Your approved confirmation was sent in the controlled portal. Your search is paused. No payment or contract signature was performed." (DE needed) | **REAL** |
| Summary pill `short · price · time` | `conversation.acceptedOfferId` → the accepted `offerRevision`'s assessment | **REAL** |
| „Demo erneut ansehen“ (`restart`) | **DEMO** — delete | |
| Replacement primary | „Suche fortsetzen“ → `savedNeeds.setStatus({ needId, status: "active" })` (the backend paused it) | **REAL** |
| Secondary | „Zu den Nachrichten“ → the inbox thread `conversation.platformThreadId` | **REAL** |

- ⚠ `complete` must **not** read `offer.current` — the auto-pause makes every offer non-current.
- The need is `paused` here. The paused banner must be suppressed on this stage (§3.2 row 1).
- ⚠ **The mandate is *not* revoked here.** `finishExecution` patches only `{ stoppedAt: now }`; the
  row keeps `status: "active"` and `mandates.getActiveMine` keeps returning it
  (`convex/externalActions.ts:1124`, `convex/mandates.ts:300-311`). So on this stage the Settings
  „Handlungsspielraum“ page and any autopilot badge must read `stoppedAt`/`expiresAt` (§3.1, §5.2),
  or they will keep claiming the autopilot is running after the search is over. The honest label
  once `stoppedAt` is set is „Autopilot gestoppt“, not „Autopilot aktiv“ and not „kein Auftrag“.

### 4.11 Stage `paused`

| Element | Binding | Backend |
|---|---|---|
| Title „Eure Suche macht eine Pause.“ | `need.status === "paused"` | **REAL** |
| Body „Euer Suchauftrag bleibt gespeichert. Macht weiter, wenn ihr bereit seid.“ | static | — |
| „Fortsetzen“ | `savedNeeds.setStatus({ needId, status: "active" })` | **REAL** |
| Brief pill / fact list | `factsFromNeed(need)` | **REAL** |
| Match list | **empty by definition** — `matches.listMine` returns `[]` for a non-active need. Say so: „Treffer werden erst wieder gesucht, wenn ihr fortsetzt.“ Do not say „Keine Treffer gefunden.“ | ⚠ |

---

## 5. Settings surface — per section

Shell: shadcn `sidebar-13` (Dialog + Sidebar + breadcrumb header + close). Seven pages. Sidebar
labels and the page `h1` differ — both strings must exist in the dictionary
(`SETTINGS_SCREENS.md` §0.2 `PAGES` vs. each section header).

**The section ids are fixed by the shipped router and must not be renamed.**
`SettingsSection = "sources" | "autonomy" | "knowledge" | "profile" | "notifications" | "usage" |
"privacy"` (`src/components/settings/SettingsFrame.tsx:13-20`). ⚠ The billing page's id is
**`usage`, not `billing`** — and `ProfilePage.tsx:163-172` silently falls back to `sources` for any
unrecognised id, so `/app/settings/billing` lands on Quellen with no error. Legacy `?tab=` values
map `connections → sources`, `memory → knowledge`.

**The shipped English half of the dictionary** (`SettingsFrame.tsx:22-70`) — §5 requires both the
sidebar label and the page `h1` to exist, so all of it belongs here:

| id | sidebar group | sidebar label | page `h1` | page lead |
|---|---|---|---|---|
| `sources` | "Scout" | "Sources & access" | "Sources & access" | "Manage the private identities and reviewed portal access RoomScout may use for you." |
| `autonomy` | "Scout" | "Autonomy" | "Autonomy" | "Review what your Scout may do, what still needs approval, and where it must stop." |
| `knowledge` | "Scout" | "What Scout knows" | "What your Scout knows" | "Inspect remembered facts and the working context used for your search." |
| `profile` | "Account" | "Profile" | "Your profile" | "The account identity attached to this private RoomScout workspace." |
| `notifications` | "Account" | "Notifications" | "Notifications" | "See which product events can currently reach you." |
| `usage` | "Account" | "Plan & usage" | "Plan & usage" | "Availability of billing and metered usage for this workspace." |
| `privacy` | "Account" | "Privacy" | "Privacy" | "Understand what is stored, what is not, and which services perform product work." |

⚠ The sidebar label and the `h1` differ for `knowledge` ("What Scout knows" vs. "What your Scout
knows") and `profile` ("Profile" vs. "Your profile"). Keep both.

Further shipped English headings that must be paired with the German (`ProfilePage.tsx:466-497`):
"In-app decisions stay visible" (notifications), "Billing is not available" (usage),
"Storage boundaries" (privacy), the CTA "Open inbox", and the privacy lead sentence "Reviewed memory
facts, searches, approvals, and event metadata may be persisted in Convex." which **precedes** the
§5.7 „Was nicht gespeichert wird“ sentence in the same paragraph.

The prototype's `settingsData` / `settingsActions` bridge disappears: each section subscribes to its
own queries. The `backReq` / `settingsDirty` handshake stays as pure UI state (only
Handlungsspielraum has a draft).

### 5.1 Quellen & Zugänge (`sources`)

| Prototype element | Binding | Backend |
|---|---|---|
| H1 „Wo darf dein Scout suchen?“ · lead „Quellen für eure Suche in {ort}.“ | `need.city` | **REAL** |
| Empty state „Lege zuerst einen Suchauftrag an.“ + „Zum Scout“ | `need === null \|\| need.status === "draft"` | **DERIVED** |
| Source rows | `searchSources.listForNeed({ savedNeedId, limit: 100 })` → `sources[]` `{ platformId, name, domain, platformStatus, supplyStatus?, demandStatus?, confidence, lastObservedAt?, preference }` | **REAL** |
| Row switch „{name} für diese Suche verwenden“ | `searchSources.setPreference({ savedNeedId, platformId, preference, reason? })` — ⚠ **four values, not two**, see below | **REAL** |
| `statusText` | see the **two** vocabularies below — the preference vocabulary and the connection vocabulary are different axes and the prototype conflates them | **DERIVED** |
| Status dot green/amber/grey | keyed on the **UI** status (`portalUiStatus`), never on the raw backend status: `connected` → `#4fbf7a`; `login_needed` / `reauth_required` → `#e0a13a`; `paused` / `not_connected` / `disabled` / excluded → grey | **DERIVED** |
| Warning „Aktuell ist keine nutzbare Quelle ausgewählt. …“ + „Quelle auswählen“ | `blockers.noUsableSource` (§3.3) | **DERIVED** |
| Expanded body „Portalprofil: {profile}“ | `portalConnections.listMine[].label` — only when it differs from `sourceName`/`platformName` | **REAL** |
| „Anzeigen lesen und Nachrichten austauschen“ | `scopes` = `["Read-only research" if allowReadOnlyRecon, "Inbox sync" if allowInboxPolling]` | **REAL** |
| „In dieser Demo nicht aktiv“ pill | **NO-BE** (no feature flag) — replace with the real reason: `platformStatus === "candidate" \| "reviewing"` → „In Prüfung“; `"restricted"` → „Nicht verfügbar“ (and the toggle can never be switched back on: `setPreference` throws `PLATFORM_NOT_AVAILABLE`) | **REAL** |
| „Verbindung verwalten“ / „Anmeldung öffnen“ | opens the connection sheet, parameterised **by source id** (⚠ the prototype hard-wires roomscout) | |
| Sheet „Zustand“ / „Letzter erfolgreicher Zugriff“ | `portalConnections.listMine[].status`, `lastSuccessAt` | **REAL** |
| Sheet „Verbindung pausieren“ | ⚠ **missing from this plan before now.** `portalConnections.pauseMine({ connectionId })` (mutation, `convex/portalConnections.ts:475-491`) sets `status: "paused"` and clears `nextPollAt`. It is the reversible, non-destructive stop and should be the **default** action; „Verbindung trennen“ is the destructive one | **REAL** |
| Sheet „Verbindung trennen“ | `browserbasePortal.disableConnection({ connectionId })` **ACTION**, behind a confirm dialog; existing copy: "RoomScout will stop using this portal and ask Browserbase to delete its persisted Context. This removes the reusable portal session; it does not delete the account on the third-party website." | **REAL** |
| Sheet run history / „Laufende Anmeldung“ | `portalConnections.listRunsMine({ connectionId })` (≤ 30, newest first) and `portalConnections.getRunMine({ runId })`; `portalConnections.getMine({ connectionId })` for a single row. „Lauf abbrechen“ → `browserbasePortal.stopRun({ runId })` **ACTION** | **REAL** |
| **Sheet „Demo-Anmeldesimulation“ + „Demo-Anmeldung abschließen“** | **DEMO — must not ship (§8.4).** Replace with `browserbasePortal.startAuthentication({ connectionId })` → `{ runId, status: "human_required" }` → `navigate('/app/runs/' + runId)` → Live View. For the controlled portal only, `startAgentRegistration({ connectionId })`. | **REAL** |
| „Passende Quellen automatisch auswählen“ | **NO-BE** — no auto-select preference field exists | §9.3 |
| „Weitere Quellen“ panel + search | `portalConnections.listConnectableSources({ limit: 50 })` minus rows already in `listMine` — ⚠ that query **silently filters** to sources with `automationReview === "approved"` **and** `accessMode === "authenticated"` (`convex/portalConnections.ts:205-227`), so it is never "all portals"; say so next to the search box | **REAL** |
| „Einbeziehen“ | `portalConnections.requestConnection({ sourceId, label })` → `Id<"portalConnections">`. ⚠ **This does not connect anything.** It inserts the row with `status: "draft"`, `policyDecision: "pending"`, `allowReadOnlyRecon: false`, `allowInboxPolling: false` (`convex/portalConnections.ts:254-291`). It becomes usable only after an **operator** runs `portalConnections.reviewConnection` — a `requireOperatorId` mutation the user cannot reach. So the row lands in `not_connected` and stays there. Required copy for that state: „Angefragt. Diese Quelle wird geprüft, bevor du dich anmelden kannst.“ + no login button. Do not present „Einbeziehen“ as if it enabled the source | **REAL** ⚠ |
| Row already present | `requestConnection` is idempotent per `(owner, source)` — it returns the existing connection id instead of inserting a second (`:266-268`); it throws `BROWSER_SOURCE_NOT_ELIGIBLE` for a source that is neither `public` nor `authenticated` | **REAL** |
| „Proberaumbörse Süd (Beispiel)“ hard-coded row | **DEMO** — delete | |
| Footnote „Demo-Quellen. Keine vollständige Liste aller Portale.“ | replace with the server's own disclosure: "Coverage describes reviewed public sources RoomScout knows about; it is not a claim that the whole market is indexed." (DE needed — ⚠ server-authored, see §11 Q9) | **REAL** |
| „Deine Scout-Adresse“ + „Kopieren“ | `mailboxes.getMine` → **`{ status, emailAddress?, lastError? } \| null`** (`convex/mailboxes.ts:151-168`). ⚠ **five** states, not two — `null` (no row yet), `provisioning`, `active`, **`failed`** (with `lastError`) and **`disabled`**. Create on demand with `mailboxes.ensureMine()` **ACTION**, which returns the same shape and can itself come back `failed`/`disabled` (`:596-618`) | **REAL** |
| Scout-Adresse states | `null` → „Wird bei der ersten Anfrage erstellt“ · `provisioning` → „Wird eingerichtet …“ · `active` → the address + „Kopieren“ · `failed` → „Die Scout-Adresse konnte nicht eingerichtet werden.“ + „Erneut versuchen“ (⚠ **never render `lastError`** — §7.3 rule 4) · `disabled` → „Diese Scout-Adresse ist deaktiviert.“ (no retry). All four German strings are new copy (§11 Q18) | **REAL** ⚠ |
| „Eine Quelle auszuschließen löscht keinen Portal-Account.“ | static, keep — it is true | — |

**Axis 1 — the source preference** (`convex/searchSources.ts:5-8, 60-63, 78-98`). ⚠ The enum has
**four** values and the default for a source the user has never touched is **`neutral`**, not
`include`:

| value | set by | today's actual effect |
|---|---|---|
| `include` | the user switching a row on | none beyond "not excluded" |
| `prefer` | nothing in the UI writes it | none |
| `neutral` | **the default** for any source with no stored preference row | none — the source **is** searched |
| `exclude` | the user switching a row off; also **forced** for `platform.status === "restricted"` | `mandates.enableDefaultAutopilot` removes it from `platformIds` (`convex/mandates.ts:217-219`) — the only place any preference is read |

So the honest model is **binary today**: `exclude` vs. everything-else. A two-state switch is
therefore correct, but the plan must say what it writes and what it reads:
- ON → `setPreference({ preference: "include" })`; OFF → `{ preference: "exclude" }`.
- Rendering: `preference === "exclude"` → off; **`include`, `prefer` and `neutral` all render on**.
  Do not render `neutral` as off — that would tell the user a source is excluded when it is searched.
- `prefer` has no UI and no effect; do not invent a third switch position for it (§11 Q17).
- `setPreference` also accepts an optional **`reason: string`** (trimmed, capped at 300 chars,
  stored on the preference row). Nothing reads it back today; wire it only if the UI asks "why?".

**Axis 2 — the connection status.** The backend `portalConnections.status` enum (`convex/schema.ts:1350-1357`)
has **six** values: `draft · needs_auth · active · paused · reauth_required · disabled`.
`portalUiStatus(status, policyDecision)` (`src/routes/musician/ProfilePage.tsx:55-71`) folds it plus
`policyDecision` into **six** UI states, and every one needs German:

| UI status | produced when | DE (prototype where it exists, otherwise to be written — §11 Q18) |
|---|---|---|
| `disabled` | `status === "disabled"` **or** `policyDecision === "prohibited"` | „Nicht verfügbar“ |
| `login_needed` | `status === "needs_auth"` | „Anmeldung nötig“ |
| `connected` | `status === "active"` | „Verbunden“ (prototype) |
| `reauth_required` | `status === "reauth_required"` | „Anmeldung erneut nötig“ (prototype) |
| `paused` | `status === "paused"` | „Pausiert“ |
| `not_connected` | everything else — i.e. **`draft`** | „Noch nicht verbunden“ |

The prototype supplies only „Nicht einbezogen“ (axis 1), „Verbunden“, „Anmeldung erneut nötig“ and
„Ohne Anmeldung“ (a public, connection-less source — axis 2's *absence*, not a value of it). The
other four are new copy. ⚠ §3.3 filters on the **raw backend** enum (`needs_auth` /
`reauth_required`) while the row renders the **UI** enum; keep the two straight.

- **Loading**: `searchSources.listForNeed === undefined` → "Loading source coverage…" /
  "Loading reviewed source coverage and your saved source preferences." (DE needed).
- **Empty**: `areaResolved === false` → the server's own string "No reviewed source coverage has been
  mapped to this city yet." Do **not** invent a source list from aggregate counts (pinned by
  `SearchSourcesPanel`'s empty state).
- **Error**: `PLATFORM_NOT_AVAILABLE` → „Diese Quelle ist derzeit nicht verfügbar.“ and leave the
  toggle off; every other code → §7.3.

### 5.2 Handlungsspielraum (`autonomy`)

Everything writes to a local `draft`; saving creates a **new immutable mandate version**.

| Prototype control | Mandate field | Backend |
|---|---|---|
| H1 „So arbeitet dein Scout“ · lead „Du bestimmst, wie selbstständig ich vorgehe.“ | — | — |
| Radio „Autopilot“ / „Suchen, anfragen und Details klären.“ | `mode: "negotiation_autopilot"` | **REAL** |
| Radio „Mit Rücksprache“ / „Nachrichten vor dem Versand prüfen.“ | `mode: "guided"` **and** `allowedActionTypes: []` | **REAL** |
| (no prototype control) | `mode: "research_autopilot"` — ⚠ **also requires `allowedActionTypes: []`**; the validator rejects a non-empty list for `guided` **and** `research_autopilot` alike (`convex/mandates.ts:140-142`) | **REAL** |
| (no prototype control) | `mode: "outreach_autopilot"` — a fourth mode that §3.1's `autopilotRunning` treats as running | **REAL** |
| Toggle „Anbieter anschreiben und nachfassen“ (`contact`) | `allowedActionTypes ⊇ [send_email, submit_webform, send_platform_dm]` | **REAL** |
| Toggle „Besichtigungstermine vorschlagen“ (`viewings`) | `allowedActionTypes ∋ propose_visit_time` | **REAL** |
| Toggle „Eigene Suchanzeige veröffentlichen“ (`publishAd`) | `allowedActionTypes ∋ publish_listing` | **REAL** |
| Toggle „Bandprofil, Verfügbarkeit und Scout-Adresse“ (`shareProfile`) | `allowedPersonalData ⊇ [band_name, reply_email, availability, budget, music_profile]` | **REAL** |
| Toggle „Private Telefonnummer und genaue Adresse“ (`sharePrivate`) | `allowedPersonalData ⊇ [phone, precise_location, member_first_names]` **and** `allowedActionTypes ∋ share_contact_details` | **REAL** ⚠ note `enableDefaultAutopilot` deliberately does **not** grant `share_contact_details` |
| Stepper „Neue Anbieter pro Tag“ | `maxContactsPerDay` — integer **0..50**, else `INVALID_CONTACT_LIMIT`. ⚠ prototype clamps at min 1; the server allows 0 | **REAL** |
| (no control) | `maxBrowserMinutesPerDay` — integer 0..240, else `INVALID_BROWSER_LIMIT`. Default 30 | **REAL** — consider exposing (§11 Q6) |
| „Weitere Grenzen“ → „Suchzeitraum: bis ihr den Suchauftrag beendet oder ein Angebot annehmt.“ | `expiresAt` — must be `> now` and `≤ now + 366 d`, else `INVALID_MANDATE_EXPIRY`. **The copy is wrong**: the mandate really does expire (default 30 days). Rewrite to name the date. | **REAL** ⚠ |
| „Geltende Stopps: Suche jederzeit im Hauptbereich pausierbar; verbindliche Zusagen nie automatisch.“ | `stopOnComplaint`, `stopWhenSuitableRoomConfirmed` (both sent `true` today) + `commitmentBoundary: "non_binding_outreach_only"` | **REAL** |
| „Budget: gehört zum Suchauftrag.“ + „Suchauftrag bearbeiten“ | `maxMonthlyPriceEur = need.maxBudgetEur` — finite 0..100000, else `INVALID_PRICE_LIMIT` | **REAL** |
| Lock card „Verbindliche Entscheidungen bleiben bei dir.“ / „Verträge, Buchungen und Zahlungen brauchen immer deine Freigabe.“ | static, **legally load-bearing**, keep verbatim | — |
| „Änderungen speichern“ | `mandates.createDraft({ savedNeedId, mode, platformIds, allowedActionTypes, allowedPersonalData, maxContactsPerDay, maxBrowserMinutesPerDay, maxMonthlyPriceEur?, expiresAt, stopOnComplaint, stopWhenSuitableRoomConfirmed })` → `{ mandateId, contentHash }` → `mandates.activate({ mandateId, expectedContentHash })` | **REAL** |
| „Abbrechen“ | drop the local draft | UI |
| „Änderungen verwerfen?“ dialog | UI only; keep `AlertDialog` with outside-click dismissal **disabled** | UI |
| (not in prototype — **add**) „Autopilot sofort stoppen“ | `mandates.killSwitch({ savedNeedId })` → number of stopped mandates | **REAL** |
| (not in prototype) revoke a single mandate | `mandates.revoke({ mandateId })` | **REAL** |

**The four modes and the two vocabularies.** ⚠ The frontend has its own `ScoutMandate` type whose
`mode` enum is `guided | research | outreach | negotiation` and whose `allowedActionTypes` uses
`propose_visit`. `MySearchPage.tsx:161, 167` **aliases** the backend row into it
(`research_autopilot → research`, `outreach_autopilot → outreach`, `negotiation_autopilot →
negotiation`, `propose_visit_time → propose_visit`) and hard-codes `persisted: true`
(`:174`) and `killSwitchEnabled: true` (`:172`). Decide once which vocabulary the port speaks; do
not mix them.

| backend (`convex/mandates.ts:8-13`) | frontend (`src/features/agentOperations/types.ts:20`) |
|---|---|
| `guided` | `guided` |
| `research_autopilot` | `research` |
| `outreach_autopilot` | `outreach` |
| `negotiation_autopilot` | `negotiation` |
| `propose_visit_time` (7 action types) | `propose_visit` (19 action types) |

**The on/off truth condition.** ⚠ `MandatePanel.tsx:84` reads

```ts
// FRONTEND VIEW-MODEL ONLY — three of these terms do not exist on the backend row.
autopilotOn = mandate.persisted && Boolean(mandate.version) && mandate.status === "active"
           && mandate.killSwitchEnabled && mandate.mode !== "guided" && mandate.mode !== "research";
```

`persisted` and `killSwitchEnabled` are literals set in `MySearchPage`, and `"research"` is the
aliased name. **Wired straight against `mandates.getActiveMine` this condition is always false.**
The equivalent over the real row — and the one the port must use — is:

```ts
// mandate: FunctionReturnType<typeof api.mandates.getActiveMine>  (null when none)
const autopilotOn =
  mandate !== null &&
  mandate.status === "active" &&        // getActiveMine already filters this, but keep it explicit
  mandate.version > 0 &&
  mandate.stoppedAt === undefined &&    // ⚠ set by finishExecution; status stays "active" (§4.10)
  mandate.expiresAt > Date.now() &&     // ⚠ canMandateAuthorize checks this; the doc used to omit it
  mandate.mode !== "guided" &&
  mandate.mode !== "research_autopilot";
```

That mirrors `canMandateAuthorize` (`src/features/agentOperations/mandatePolicy.ts:26-37`), which
additionally refuses per action: a hard-human action type, an action type not in
`allowedActionTypes`, and — for `research` — anything outside `browse_public | browse_connected |
read_messages | extract_facts`. `authorizeFromMandate` on the server refuses
`status !== "active" || stoppedAt !== undefined` (`convex/lib/mandateAuthorization.ts:113`).

- Never render „Autopilot aktiv“ from anything weaker. `mandatePolicy.test.ts` pins that draft,
  killed, unversioned and expired mandates are rejected.
- The "Always human" list must render `hardHumanActionTypes` (accept_terms, accept_contract,
  confirm_booking, make_payment, pay_deposit, enter_password, complete_2fa, solve_captcha) with the
  existing **19-entry** `actionLabels` dictionary (`MandatePanel.tsx:8-28`) — that list is the
  visible form of §1 rule 2. The 19 English labels, all needing DE: "Browse public sources" ·
  "Browse connected portals" · "Read connected messages" · "Extract and compare facts" · "Send
  email" · "Submit web form" · "Send platform message" · "Create a portal account" · "Publish a
  search listing" · "Share contact details" · "Propose a visit time" · "Accept terms" · "Accept or
  sign a contract" · "Confirm a booking" · "Make a payment" · "Pay a deposit" · "Enter a password" ·
  "Complete two-factor authentication" · "Solve a CAPTCHA". ⚠ Twelve of them (the four browse/read/
  extract types and the eight hard-human types) have **no backend `actionTypeValidator` counterpart**
  — the backend enum is only the seven configurable ones. They are display-only vocabulary; never
  send them to `mandates.createDraft`.
- **Loading**: `mandates.getActiveMine === undefined` → "Loading Scout mandate…" / "Loading the
  active version and authorization limits." (DE needed).
- **Empty** (`null`): show the editor pre-filled with the `enableDefaultAutopilot` defaults, marked
  as *not yet active*. ⚠ Do **not** repeat MySearchPage's synthetic-mandate trick of rendering a
  fully-populated unsaved object that looks persisted.
- **A persisted mandate already in `research_autopilot` or `outreach_autopilot`** has no prototype
  radio. Do not silently coerce it to „Autopilot“ (that would widen the user's own authorization) or
  to „Mit Rücksprache“ (that would misreport it). Render a fourth, read-only row naming the mode and
  a „Auf Autopilot umstellen“ / „Auf Mit Rücksprache umstellen“ action that goes through
  `createDraft` → `activate` like any other change. §11 Q19.
- **Error**: `MANDATE_CONTENT_CHANGED` → „Die Einstellungen haben sich geändert. Bitte prüfe sie
  erneut.“ and re-read before allowing another activate; `INVALID_*` codes → inline field errors
  (§7.3). Closing note: "Saving creates a new immutable mandate version. Existing provider gates
  re-check that version immediately before execution." (DE needed).

### 5.3 Was dein Scout weiß (`knowledge`)

| Prototype element | Binding | Backend |
|---|---|---|
| H1 „Was ich über euch weiß“ · lead „Korrigiere mich jederzeit. Ihr bestimmt, was ich mir merke.“ | — | — |
| Summary card | `memory.listMine().profile.summary` | **REAL** |
| ⚠ the rest of `profile` | the projection also carries `musicalIdentity`, `practicalContext`, `relationshipContext`, `hardConstraints[]`, `softPreferences[]`, `openQuestions[]`, `rebuiltAt`, `lastImportAt` (`convex/memory.ts:432-443`) — none of them were bound anywhere in this plan. **`hardConstraints[]` and `openQuestions[]` are literally the content of a „Was ich über euch weiß“ screen** and must be rendered: hard constraints as a non-editable „Das steht fest“ list, open questions as „Das ist noch offen“ with a „Beantworten“ chip that opens the Scout composer. `musicalIdentity` / `practicalContext` / `relationshipContext` are three further prose paragraphs beside `summary`; `rebuiltAt` / `lastImportAt` date the card | **REAL** |
| Summary edit (pencil) | jump to the first editable row | UI |
| Derived fact rows („Aus dem Gespräch · Teil eures Suchauftrags“) | `factsFromNeed(need)` | **REAL** |
| Stored knowledge rows | `memory.listMine().facts[]` `{ _id, subject, subjectKind, predicate, value, objectName?, category, confidence, source, verification, sensitivity, embeddingState, lastConfirmedAt }` | **REAL** |
| Tabs „Eure Band“ / „Alltag & Wege“ / „Ausstattung“ | **DERIVED** from `fact.category` (13 values) — mapping below | ⚠ |
| Row origin line | `source` (`conversation \| context_import \| user_edit \| agentmail \| observed`) + `verification` + `Math.round(confidence*100)}%` | **REAL** |
| „Noch zu bestätigen“ pill | `verification === "inferred"` | **DERIVED** |
| „Stimmt“ | **NEW-BE** §10.2 — no mutation sets `verification: "user_confirmed"` today | ⚠ |
| „Nicht wichtig“ / „Nicht mehr verwenden“ | `memory.deleteFact({ factId })` — a **soft** delete (`status: "deleted"`) that writes a `memoryEvents` row and rebuilds the context | **REAL** |
| Undo bar „„{text}“ wird nicht mehr verwendet.“ + „Rückgängig“ | **NEW-BE** §10.2 — `memory.restoreFact({ factId })`; trivial because the delete is soft | ⚠ |
| Row edit → „Speichern“ (derived row, has `factId`) | `savedNeeds.update({ needId, <field> })` | **REAL** |
| Row edit → „Speichern“ (memory row) | **NEW-BE** §10.2 — no `memory.updateFact` exists. Interim: delete + `memory.importFacts` with a single candidate | ⚠ |
| Hint „Diese Angabe ist Teil eures Suchauftrags und wird dort ebenfalls aktualisiert.“ | true for derived rows | **REAL** |
| „Herkunft ansehen“ | `source` + `verification` + „Verwendet für: …“ | **REAL** — note the prototype's line has no dismissal path; add one |
| „Änderungsverlauf“ | `memory.listMine().events[]` `{ _id, eventType, summary, occurredAt }` — the one persisted per-user event stream. ⚠ **only the last 12 exist** (`take(12)`, `convex/memory.ts:499-501`) and there is no pagination or `before` cursor. Label it „Letzte Änderungen“, not „Verlauf“, and do not render a „Mehr laden“ that cannot load more | **REAL** |
| „Kontext importieren“ | `memory.parseContextImport({ text })` → `{ summary, facts: FactCandidate[] }`; then `memory.importFacts({ batchId: crypto.randomUUID(), facts: selected })` → `{ imported, duplicateBatch }` | **REAL** |
| Import step 1 prompt | `MUSIC_CONTEXT_IMPORT_PROMPT` in `src/features/memory/contextImportPrompt.ts` — ⚠ **not** the prototype's `IMPORT_PROMPT` | **REAL** |
| Import step 2 „Beispiel einsetzen“ + `EXAMPLE` | **DEMO** — delete; the real analyzer accepts any text | |
| Import step 3 candidate list | `FactCandidate` `{ subject, subjectKind, predicate, value, objectName?, objectKind?, category, confidence, sensitivity, relevance }` | **REAL** |
| Sensitive candidates start unchecked | `sensitivity === "sensitive"` | **REAL** |
| Conflict line „Widerspricht „…“ im aktuellen Suchauftrag. …“ | compare the candidate against `factsFromNeed(need)` | **DERIVED** |
| „Angaben prüfen“ disabled rule | ⚠ **both ends.** `memory.parseContextImport` does **not** return early — it **throws** `ConvexError({ code: "INVALID_CONTEXT_IMPORT" })` for `text.trim().length < 20` **or** `> 50_000` (`convex/memory.ts:964-967`). Disable below 20 characters, hard-cap the textarea at 50 000, and show a live counter past ~45 000 | **REAL** |
| „Übernehmen“ (step 3) disabled rule | `memory.importFacts` throws `INVALID_IMPORT_SIZE` for `facts.length === 0` or `> 40` (`convex/memory.ts:369-371`). The analyzer itself already caps its output at 40 candidates, so the reachable rule is **at least one selected**. Both codes belong in §7.3 | **REAL** |
| Import budget warning | ⚠ parse + import = **2 of 3** `contextImport` tokens per hour (§2.3). Say so before the second import, not after the throw | **REAL** |
| Hint „Bitte keine Zugangsdaten oder sensiblen Informationen einfügen. Der Text wird nach dem Import nicht gespeichert.“ | true — raw text is never stored | **REAL**, keep |
| „Gespeicherte Informationen verwalten“ | navigate to Datenschutz | UI |
| (not in prototype — **add**) „Semantischen Index aufbauen“ | `memory.refreshMyEmbeddings()` → `{ processed, configured }`; `configured:false` → "Set OPENAI_API_KEY in this Convex deployment first." | **REAL** |
| (not in prototype — **add**) „Arbeitskontext neu aufbauen“ | `memory.refreshMyContext()` → `{ rebuiltVersion? }`, shown while `profile.contextVersion < profile.factVersion` | **REAL** |

**Category → tab mapping** (13 backend categories, 3 prototype tabs — the gap must be closed
deliberately):

| tab | `fact.category` |
|---|---|
| „Eure Band“ | `identity`, `music`, `goal`, `relationship`, `collaboration`, `room_need` |
| „Alltag & Wege“ | `location`, `mobility`, `schedule` |
| „Ausstattung“ | `equipment` |
| **„Weiteres“** (new 4th tab, recommended) | `preference`, `constraint`, `other` |

Folding `preference` / `constraint` / `other` into „Eure Band“ would mislabel them; a fourth tab is
the honest option. See §11 Q7.

- ⚠ **`memory.listMine` is capped at 100 active facts** (`take(100)`, `convex/memory.ts:492`).
  Above that the list is silently truncated and there is no pagination and no total count. Two
  consequences: the fact list needs the caveat „Die 100 zuletzt geänderten Angaben“, and **§5.7 must
  not print `facts.length` as a total** (see there).
- **Loading**: `memory.listMine === undefined` → skeleton rows; the working-context card shows a
  spinner + „Lernt“ while `profile.contextVersion < profile.factVersion`.
- **Empty**: no facts → "Your Scout is ready to learn" / "Tell the Scout about your project, or
  import context from an assistant that already knows your music life." (DE needed).
- **Error**: `contextImport` rate limit (3/h) → §7.3; the import dialog already strips the
  `ConvexError:` prefix — keep that but route through the §7.3 code map instead.

### 5.4 Profil (`profile`)

| Prototype element | Binding | Backend |
|---|---|---|
| H1 „Dein Profil“ · lead „Wie soll dein Scout euch ansprechen?“ | — | — |
| Initials avatar | recomputed from the live (possibly unsaved) name draft | UI |
| „Anzeigename“ field | `users.current.displayName ?? username` | **REAL** (read) |
| **„Speichern“** | **NEW-BE** §10.3 — nothing in the app ever writes `displayName` | ⚠ |
| „Name gespeichert. Ansprache und Initialen sind aktualisiert.“ | after the new mutation | |
| „Demo-Login“ row + „Designprototyp“ badge | **DEMO** — replace with the real identity: username, role (`musician \| operator`), and „Abmelden“ (`useAuthActions().signOut()`) | **REAL** |
| Footnote „Externe Portal-Accounts und deine Scout-Adresse werden bei einer Namensänderung nicht umbenannt.“ | true, keep | — |

Until §10.3 lands: render the field **read-only** with the treatment **`nicht verbunden`** on the
save button („Umbenennen ist noch nicht verbunden“), rather than a button that does nothing.

### 5.5 Benachrichtigungen (`notifications`) — **NO-BE**

| Prototype element | Reality |
|---|---|
| Toggles `decision` / `offer` / `digest` | no preference store exists anywhere |
| Kanal „In der App“ / „Scout-Adresse (simuliert)“ | no delivery channel other than in-app exists |
| „Gespeichert“ toast | would be a lie |
| Footnote „Präferenzen werden lokal gespeichert. …“ | describes a demo, not the product |

⚠ There is a real distinction here that must survive the port: the **`notifications` table exists**
(`convex/schema.ts:947-963`, indexed `by_owner_and_created_at` / `by_owner_and_read_at`). Its
`kind` union has **four** values — `new_match | mail_reply | outreach_failed | system` — and the row
is `{ ownerId, kind, title, body, signalMatchId?, mailThreadId?, readAt?, createdAt }`. §10.1's
query needs the union and the UI needs it for grouping.

It is written on **nine** `ctx.db.insert("notifications", …)` sites — externalActions ×2, inbox ×3,
matches ×1, messageSafety ×1, outreach ×1, providerConversations ×1 — two of which emit a
**conditional** title, giving eleven distinct titles:

| kind | title | body | site |
|---|---|---|---|
| `new_match` | "RoomScout found a new match" | `match.reasons.slice(0,2).join(" · ")` | `matches.ts:320` |
| `mail_reply` | "A room contact replied" | the subject, ≤ 240 | `inbox.ts:187` |
| `system` | "Portal verification email received" **or** "New Scout mailbox message" | the subject, ≤ 240 | `inbox.ts:277` (conditional on `kind === "portal_verification"`) |
| `outreach_failed` | "Outreach delivery failed" | the error, or `` `AgentMail reported ${status}.` `` | `inbox.ts:511` |
| `outreach_failed` | "Outreach could not be sent" | the error, ≤ 500 | `outreach.ts:592` |
| `system` | "A room offer is ready to review" **or** "Your Scout has assessed a provider update" | `assessment.summary`, ≤ 240 | `providerConversations.ts:271` (conditional on `readiness.ready`) |
| `system` | "Portal action is waiting" | — | `externalActions.ts` |
| `system` | "Offer acceptance sent" | "Your approved confirmation was sent in the controlled portal. Your search is paused. No payment or contract signature was performed." | `externalActions.ts:1126` |
| `system` | "Scout needs your review" | "The final-message check could not complete. Nothing was sent." | `messageSafety.ts` |

⚠ Several **bodies are provider- or model-authored** (a mail subject, an AgentMail status string, an
`assessment.summary`, an outreach error). §7.3 rule 4 applies: an error body must not be rendered
verbatim. Bodies that are safe to show are the subject lines and `match.reasons`.

What is missing is **a read query and any delivery channel other than in-app** (§10.1).

**Treatment: show with „nicht verbunden“.** Render the section with the toggles **disabled** and the
existing, test-pinned honest paragraph (DE translation needed):

> "Matches, replies, approvals, and required handoffs appear in RoomScout as they arrive.
> User-configurable email, push, and browser notification preferences are not available yet;
> RoomScout will not claim permission or delivery it has not implemented."

plus the existing CTA "Open inbox" → `/app/inbox` („Zu den Nachrichten“).

⚠ **Correction: the notifications paragraph is not test-pinned.** `ProfilePage.test.tsx:133-190`
has exactly five tests — deep-linked section, "states honestly that billing and metering are
unavailable", path-based navigation, memory-deletion confirmation, legacy query links. Only the
**billing** wording is pinned. The notifications paragraph is shipped copy that this port should
keep on its merits (it is the honest statement §1 requires), but no test protects it, so if the port
changes it, nothing will fail. Add a test if it matters.

### 5.6 Tarif & Nutzung (`usage`) — **NO-BE**

⚠ The section id is **`usage`**. There is no `billing` id; `/app/settings/billing` falls through to
`sources` (`ProfilePage.tsx:163-172`).

| Prototype element | Reality |
|---|---|
| „Demo-Zugang“ / „Tarife ansehen“ | no plan, no pricing |
| „Aktivität im September“ — 3 stat cells | no metering ledger; the month is hard-coded |
| „Zahlungsdaten“ / „Rechnungsadresse“ / „Rechnungen“ | no billing system |

**Treatment: show with „nicht verbunden“.** One card, the heading "Billing is not available" and
the existing paragraph — this one **is** pinned by `ProfilePage.test.tsx` ("states honestly that
billing and metering are unavailable") (DE needed):

> "This workspace has no connected billing system, purchasable plan, or user-facing metering ledger.
> No prices, quotas, or usage totals are shown because RoomScout cannot currently verify them."

Do **not** render the three stat cells with derived numbers — `usage.searches` / `usage.contacted`
would be a metering claim we cannot verify. If an activity summary is wanted, put it on the
Datenschutz page as "what is stored", not here as "what is billed".

### 5.7 Datenschutz (`privacy`)

| Prototype row | Binding | Backend |
|---|---|---|
| „Gespeicherte Angaben“ + „{n} Angaben über eure Band und Suche“ | ⚠ **not `memory.listMine().facts.length`.** That array is `take(100)`-capped (`convex/memory.ts:492`), so for any user with more than 100 facts it silently reads „100 Angaben“ — a false count on the one page whose entire job is telling the user what is stored. Either (a) word it without a number („Deine gespeicherten Angaben“ + „Ansehen“), or (b) add `memory.countMine()` (§10.9). Until one of those, **(a)** | **NEW-BE** ⚠ |
| „Gespeicherte Angaben ansehen“ | navigate to `knowledge` | UI |
| „Gesprächsverlauf“ / „Mitschrift eurer Gespräche mit dem Scout, in der App einsehbar“ | `scout.listMessages` + `voiceSessions` transcripts | **REAL** |
| „Portalzugänge“ + „{n} verbundener Portalzugang, simuliert“ | `portalConnections.listMine.filter(p => p.status === "active").length`; **drop „simuliert“**. This one is safe to count: `listMine` is not capped for a realistic number of connections | **REAL** |
| „Portalzugänge verwalten“ | navigate to `sources` | UI |
| „Export“ / „Demo-Daten exportieren“ | **NO-BE** — no export endpoint | §9.7 |
| „Konto löschen“ | **NO-BE** — no deletion path | §9.7 |
| „Beteiligte Dienstleister“ | true and already worded in the app: "Convex stores application state. Firecrawl performs public-web discovery and monitoring. AgentMail handles approved email. Browserbase provides isolated portal contexts. OpenAI performs text reasoning, embeddings, and the approved realtime voice flow." | **REAL** — keep, in both languages |
| (add) „Was nicht gespeichert wird“ | existing string: "Raw context imports are analyzed but not stored. Raw voice audio, passwords, 2FA values, CAPTCHA answers, cookies, and ephemeral Live View URLs are not stored." | **REAL** — legally load-bearing |

---

## 6. Operator surface — per page

The operator cockpit already exists (`/ops/*`, `RequireAuth` + `RequireOperator`; every `api.ops.*`
function re-checks operator status server-side). The prototype's Operator is a **redesign of that
cockpit**, not a new system. Six prototype pages onto real queries:

### 6.1 Betrieb im Blick (`overview`)

| Prototype element | Binding | Backend |
|---|---|---|
| H1 „Betrieb im Blick“ · lead „Provider, Quellen und wartende Aufgaben.“ | — | — |
| Attention banner „1 Aufgabe braucht Aufmerksamkeit“ + „Ansehen“ | **DERIVED** from `ops.overview().metrics` — `detailFailures + unhealthySources + awaitingApproval`; the count must be real, not the literal `1`. ⚠ **but see the `boundedSample` caveat below — it is a lower bound, not a total** | **REAL** |
| ⚠ `ops.overview()` also returns **`boundedSample: number`** | every one of the nine metrics is computed from `take(MAX_COUNT_SAMPLE)` with `MAX_COUNT_SAMPLE = 200` (`convex/ops.ts:29, 73-88`). So `publishedSignals`, `staleSignals`, `detailBacklog`, `detailFailures`, `awaitingApproval`, `repliedThreads`, `unhealthySources`, `activeVoiceSessions`, `activeMailboxes` are **lower bounds capped at 200**, not exact counts. Rendering `200` as a total is the same class of unverifiable claim §1 rule 5 and §8 forbid. Render `n === boundedSample` as **„200+“** and put „Stichprobe: max. {boundedSample}“ on the card | **REAL** ⚠ |
| Sidebar / nav badges | `ops.navCounts()` → `{ signalReview, outreach, inbox }` (`convex/ops.ts:265-302`) — ⚠ also bounded, each from a `take(100)`. Same „100+“ rule | **REAL** |
| Calm banner „Keine Aufgabe braucht Aufmerksamkeit. Beispielstörung über die Demo-Steuerung laden.“ | keep the first sentence; **delete the second** (DEMO) | |
| Integration tiles — **six**, not four | `opsActions.providerReadiness({})` **ACTION** → `{ overallStatus: "configured" \| "incomplete", configuredProviders, serverProviderCount, firecrawl{…}, agentmail{…}, browserbase{…}, mapbox{…}, openaiDirect{…}, frontendMapbox{…} }` (`convex/opsActions.ts:44-140`). ⚠ It is an **action**, so it cannot be a live `useQuery` subscription: fetch once on mount, hold in state, and give the card an explicit „Aktualisieren“ button with a „Stand: {time}“ line. §6.4's "five expandable rows" was wrong for the same reason — it is the same six blocks | **REAL** ⚠ |
| Tile status word („Bereit“ / „Konfiguriert“ / „Prüfen“) | `providerStatus ∈ configured \| incomplete \| disabled \| client_only` → „Konfiguriert“ / „Unvollständig“ / „Deaktiviert“ / „Nur Client“ | **REAL** ⚠ presence-of-env only, never a live health check — the prototype's own note „Eine konfigurierte Integration ist kein Nachweis für einen erfolgreichen Live-Test.“ is exactly right and must be kept for **every** tile, not only Firecrawl |
| Tile „Convex AI Gateway“ | ⚠ **no `providerReadiness` entry**. Derive from the deployment itself (the gateway is in-process) or **hide** the tile. §11 Q10 | **NO-BE** |
| Tile „OpenAI direkt“ static row | `providerReadiness.openaiDirect` (`apiKeyConfigured`, `realtimeOriginsConfigured`, `realtimeOriginsValid`, `productionOriginConfigured`) | **REAL** — make it a normal tile |
| Task table (`t1` „Neue Anzeigen prüfen“, `t2` „Portal-Nachrichten lesen“, `t3` „Anfrage vorbereiten“) | **DEMO** — a three-row script. Replace with `ops.listSignalQueue({ state, limit: 50 })` (`all\|failed\|queued\|fetching\|processed\|none`) and `ops.overview().activity` | **REAL** |
| „Betriebsregeln“: „Parallele Browser-Sessions 2“ / „Erneute Versuche Mit zunehmendem Abstand“ | **NO-BE** — hard-coded. Real values live in `convex/rateLimits.ts` (`portalSessionGlobal` 20/day, `portalWriteUser` 10/day, …) and the workpool config. Render the **rate-limit table** instead, or hide | §9.6 |
| „Illustrative Betriebsregeln, keine echten Worker-Pools.“ | **DEMO** — must go either way | |
| Feature-Flags mirror | **NO-BE** §9.4 | |

### 6.2 Quellen (`sources`)

| Prototype element | Binding | Backend |
|---|---|---|
| H1 „Quellen“ · lead „Technische Anbindung der Demo-Quellen, unabhängig von Nutzerpräferenzen.“ | drop „Demo-“ | — |
| Rows: Quelle · Region · Anbindung · Letzter Demo-Check | `ops.listSources({ limit: 40 })` | **REAL** |
| „Angebunden · Demo-Zugang“ / „Angebunden · Zugang braucht Anmeldung“ | portal connection status | **REAL** |
| „Nicht aktiv (Flag aus)“ | **NO-BE** (no flag) — replace with `source.active === false` / `policyDecision !== "allowed"` | **REAL** |
| „Heute · Demo-Lauf“ / „Heute, {h}:{mm}“ | `lastObservedAt` / `lastSuccessAt` via `Intl.DateTimeFormat` — ⚠ the prototype's `now()` hard-codes the German word „Heute“ and an unpadded hour; use a locale formatter | **REAL** |
| (add) review actions | `sourceRegistry.reviewSource({ sourceId, decision, policyNotes })`, `setSourceActive({ sourceId, active })`, `seedReviewSources({})`, `syncMonitors({})`, `continueBacklog({})`, `retrySourceEntry({ sourceEntryId })`, `opsActions.runMonitorNow({ sourceTargetId })` | **REAL** |
| Footnote | keep the coverage caveat, drop „Demo-Lauf ist auf roomscout.dev begrenzt“ unless it is still true | |

### 6.3 Aufträge (`tasks`)

| Prototype element | Binding | Backend |
|---|---|---|
| Filter chips „Alle“ / „Braucht Aufmerksamkeit“ | client filter over the rows | UI |
| Table | `ops.listOutreach({ status?, limit: 50 })` — masked recipient/sender, content-hash prefix, delivery status. **Read-only; operators cannot approve.** | **REAL** |
| (add) inbox routing | `ops.listInboxRouting({ limit })` (`convex/ops.ts:640`) → mail threads with `ownerName`, masked `subject` and delivery `status` — the routing half of the same picture, never mentioned before now | **REAL** |
| „Diagnose“ button on an expired row | open the diagnose sheet on that row | UI |
| Empty „Keine Aufgabe braucht Aufmerksamkeit.“ | when the filtered list is empty | — |
| ⚠ empty detail stripe bug (`t2` detailText `''` while expired) | do not port; render the detail row only when there is text | |

### 6.4 Integrationen (`integrations`)

| Prototype element | Binding | Backend |
|---|---|---|
| **Six** expandable rows | `opsActions.providerReadiness({})` **ACTION** — one row per provider block: `firecrawl`, `agentmail`, `browserbase`, `mapbox`, `openaiDirect`, `frontendMapbox`. ⚠ §6.1 and §6.4 previously disagreed (four vs. five); six is the number in the returns validator. Same snapshot/refresh rule as §6.1 | **REAL** |
| Summary line | `` `${configuredProviders} / ${serverProviderCount}` `` + `overallStatus` (`configured` / `incomplete`) — ⚠ `serverProviderCount` counts the **server-side** providers only, so it is not 6; do not compute the denominator yourself | **REAL** |
| „Konfiguration: Konfiguriert“ | `<provider>.status` + the individual `*Configured` booleans | **REAL** |
| „Letzter Demo-Test: Erfolgreich (Demo)“ | **NO-BE** — `providerReadiness` performs **presence checks only** (`credentialPresenceOnly: true` on browserbase). Replace with the honest label „Nur Konfigurationsprüfung, kein Live-Test“ | ⚠ |
| Note lines | `reasons: string[]` from each provider block | **REAL** |
| Browserbase incident variant | `portalConnections.listMine` rows in `needs_auth` / `reauth_required` | **REAL** |

### 6.5 Feature-Flags (`flags`) — **NO-BE**

There is **no feature-flag table, module, or env-driven flag registry** in `convex/`. The prototype's
two flags (`voice`, `publicSearch`) have real analogues that are *not* toggles:

- `voice` ← `OPENAI_API_KEY` presence (the realtime endpoint answers **503** without it), plus
  `realtimeOriginsConfigured`. Read-only.
- `publicSearch` ← `sourcePlatforms.status` / `sources.active` per source, already editable on
  §6.2 via `sourceRegistry.setSourceActive`.

**Treatment: hide the page.** Rendering global on/off switches that write nothing would be the
single most misleading element in the port. If a flag surface is wanted later, §10.5.

### 6.6 Diagnose (`diag`)

| Prototype element | Binding | Backend |
|---|---|---|
| H1 „Diagnose“ · lead „Verständliche Ereignisse aus den lokalen Demo-Daten.“ | drop „lokalen Demo-“ | — |
| No-incident card | `ops.listAudit({ limit: 60 })` returns no failure rows | **REAL** |
| Event timeline (5 hard-coded rows with `09:41` / `09:42`) | **DEMO** — replace with `ops.listAudit({ limit: 60 })` → `[{ id, kind: "approval"\|"action"\|"provider"\|"voice", title, detail, status, at }]` and `portalConnections.listRunsMine({ connectionId })` | **REAL** |
| Sheet key/values „Vorgang“ / „Portal“ / „Zustand“ | the selected audit row + its connection | **REAL** |
| „Ursache“ / „Auswirkung“ / „Nächster Schritt“ | `detail` + `lastErrorCode` + the policy decision | **REAL** |
| **„Anmeldung als erneuert simulieren“** | **DEMO — must not ship (§8.4).** The real repair is `browserbasePortal.startAuthentication({ connectionId })` → Live View, performed **by the account owner**, not by an operator. An operator has no path to another user's credentials and must not appear to. | ⚠ |
| „Zugang erneuert. Die wartende Aufgabe wurde einmalig fortgesetzt.“ | after the owner completes the run, the orchestrator resumes on its own | **REAL** |
| ⚠ sheet has no entry point once resolved | fix: render the trigger whenever there is an incident row, resolved or not | |

---

## 7. Loading / empty / error contract

### 7.1 Loading

- `undefined` = loading, `null` / `[]` = known-empty. Never collapse the two.
- Every stage renders a **stage-shaped skeleton**, not a spinner: the blob anchor at the right size,
  the headline as a shimmer block, and card outlines. The blob must not jump — `syncBlob()` reads
  `[data-blob-anchor]`, so the skeleton must include the anchor.
- `usePaginatedQuery` exposes `status ∈ LoadingFirstPage | CanLoadMore | LoadingMore | Exhausted` —
  use `LoadingFirstPage` for the transcript skeleton, not `results.length === 0`.
- Never show `welcome` before `getOrCreateDraft` has resolved (§4.1).
- Actions in flight disable their own control and show the existing „…“-suffixed label
  („Scout startet …“, „Speichern …“), never a global overlay.

### 7.2 Empty

| Surface | Condition | Copy rule |
|---|---|---|
| Matches | `[]` **and** `need.status === "active"` | „Noch kein passender Raum. Ich suche weiter.“ |
| Matches | `[]` **and** `need.status !== "active"` | „Treffer werden erst wieder gesucht, wenn ihr fortsetzt.“ — never "nothing found" |
| Opportunities | `[]` | no clarification stage; not an empty state |
| Conversations | `[]` | no offer stage; not an empty state |
| Source coverage | `areaResolved === false` | the server string "No reviewed source coverage has been mapped to this city yet." — do not invent a list |
| Memory facts | `[]` | "Your Scout is ready to learn" + the import CTA |
| Transcript | `[]` | „Noch keine Äußerungen.“ |
| Activity | `[]` (once §10.1 lands) | „Noch keine Ereignisse.“ — **not** a fabricated timeline |
| Actions | a row in `drafted` | **not empty** — §4.4.0: „Anfrage abschicken“. A `drafted` row that renders nothing is the same bug as an empty state that lies |
| Actions | a row in `rejected` / `failed` / `cancelled` / `expired` | **not empty** — §4.4.2 outcome card, always with „Nichts wurde gesendet.“ |
| Operator metrics | `n === boundedSample` (200) or `100` for `navCounts` | render „{n}+“, never „{n}“ — §6.1 |

### 7.3 Errors — replace `error.message` with a code map

⚠ Today only `ScoutPage` humanises errors; every other screen renders the raw `ConvexError` payload,
so codes like `INCOMPLETE_NEED` and `MANDATE_CONTENT_CHANGED` are shown to the user verbatim. The
port must ship one `errorCopy(code, lang)` map. Codes seen on these paths:

⚠ **`EXPIRED` is not a code.** No `code: "EXPIRED"` exists anywhere in `convex/`; the real codes are
`ACTION_EXPIRED` and `ACCEPTANCE_EXPIRED`. It only *looks* correct because
`OfferAcceptanceDialog.tsx:43` matches on the **substring** `"EXPIRED"`. Substring matching is a
fallback; the map keys on real codes.

**Search / need / match**
`INCOMPLETE_NEED` · `NEED_NOT_FOUND` · `NEED_ARCHIVED` · `NEED_REQUIRED` ·
`INVALID_FIELD` *(⚠ carries a `field` payload — `"title"` \| `"city"` — the inline error must route
on it, §4.3)* · `INVALID_BUDGET` · `INVALID_LIMIT` ·
`MATCH_NOT_FOUND` · `MATCH_NO_LONGER_CURRENT` ·
`PLATFORM_NOT_AVAILABLE` · `PLATFORM_NOT_FOUND` ·
`OPPORTUNITY_NOT_FOUND` · `OPPORTUNITY_NO_LONGER_MATCHES` · `INVALID_SUMMARY` · `HANDOFF_NOT_FOUND`

**Scout thread / voice**
`THREAD_NOT_FOUND` · `SIGNAL_NOT_FOUND` · `SIGNAL_REQUIRED` · `INVALID_MESSAGE` ·
`SCOUT_CONTEXT_REQUIRED` · `NEED_AND_SIGNAL_REQUIRED` · `INVALID_TOOL_ARGUMENTS` ·
`INVALID_TRANSCRIPT` · `VOICE_SESSION_NOT_FOUND` · `VOICE_SESSION_NOT_ACTIVE`
*(the realtime session endpoint's failures are **HTTP**, not codes — §4.1)*

**Mandate**
`MANDATE_NOT_FOUND` · `MANDATE_CONTENT_CHANGED` *(⚠ `mandates.activate` only)* ·
`MANDATE_CHANGED` · `MANDATE_NO_LONGER_AUTHORIZES` · `MANDATE_SNAPSHOT_MISSING` ·
`INVALID_MANDATE_STATE` · `INVALID_MANDATE_EXPIRY` · `INVALID_CONTACT_LIMIT` ·
`INVALID_BROWSER_LIMIT` · `INVALID_PRICE_LIMIT` ·
`MODE_CANNOT_AUTHORIZE_EXTERNAL_ACTIONS` · `MANDATE_COMMITMENT_BOUNDARY_REQUIRED`

**Approval / execution — the whole family, previously missing** (`convex/externalActions.ts`)
`ACTION_NOT_FOUND` · `INVALID_ACTION_STATE` · `ACTION_CONTENT_CHANGED` *(⚠ **this** is what
`externalActions.decide` throws, not `MANDATE_CONTENT_CHANGED`)* · `ACTION_PAYLOAD_MISMATCH` ·
`ACTION_NOT_APPROVED` · `ACTION_NOT_EXECUTABLE` · `ACTION_NOT_EXECUTING` · `ACTION_EXPIRED` ·
`ACTION_SEARCH_CHANGED` · `ACTION_SIGNAL_CHANGED` · `ACTION_FIELD_TOO_LARGE` ·
`ACTION_PAYLOAD_TOO_LARGE` · `INVALID_ACTION_DESTINATION` · `INVALID_ACTION_FIELDS` ·
`INVALID_ACTION_FIELD_NAME` · `INVALID_ACTION_TYPE` · `EXECUTION_NOT_FOUND` ·
`EXECUTION_NOT_CLAIMED` · `EXECUTION_DOMAIN_CHANGED` · `EXECUTION_POLICY_CHANGED` ·
`ALREADY_DECIDED` · `APPROVAL_MISMATCH` · `APPROVAL_REQUIRED` · `EXTERNAL_APPROVAL_REQUIRED` ·
`HUMAN_EXECUTION_NOT_CONFIRMABLE` · `INTERACTION_NOT_FOUND`

**Email-draft approval** (`convex/outreach.ts` — a different table, a different signature)
`DRAFT_NOT_FOUND` · `DRAFT_CONTENT_CHANGED` · `DRAFT_LOCKED` · `INVALID_DRAFT_STATE` ·
`INVALID_RECIPIENT` · `INVALID_SUBJECT` · `INVALID_BODY`

**Offer acceptance** (`convex/offerAcceptance.ts`)
`OFFER_NOT_FOUND` · `OFFER_NOT_READY` · `OFFER_CHANGED` · `OFFER_ACTION_CONFLICT` ·
`CONTROLLED_PORTAL_THREAD_REQUIRED` · `ACCEPTANCE_NOT_REVIEWABLE` · `ACCEPTANCE_CONTENT_CHANGED` ·
`ACCEPTANCE_CONTEXT_CHANGED` · `ACCEPTANCE_DESTINATION_CHANGED` · `ACCEPTANCE_EXPIRED` ·
`ACCEPTANCE_APPROVAL_MISMATCH` · `ACCEPTANCE_REVIEW_REQUIRED` · `ANOTHER_ACCEPTANCE_IN_PROGRESS` ·
`ACCEPTANCE_MESSAGE_TOO_LONG` · `ACCEPTANCE_RECEIPT_REQUIRED`

**Portal / Live View**
`CONNECTION_NOT_FOUND` · `CONNECTION_NOT_ACTIVE` · `PORTAL_CONNECTION_NOT_ACTIVE` ·
`PORTAL_CONNECTION_NOT_READY` · `PORTAL_CONNECTION_REQUIRED` · `PORTAL_REAUTH_REQUIRED` ·
`PORTAL_POLICY_REQUIRED` · `PORTAL_CIRCUIT_OPEN` · `BROWSER_SOURCE_NOT_ELIGIBLE` ·
`BROWSER_SESSION_BUSY` · `BROWSER_CONCURRENCY_LIMIT` · `BROWSERBASE_NOT_CONFIGURED` ·
`LIVE_VIEW_NOT_AVAILABLE` · `WRITE_LIVE_VIEW_NOT_AVAILABLE` · `WRITE_LIVE_VIEW_EXPIRED` ·
`WRITE_SESSION_NOT_FOUND` · `RUN_NOT_FOUND` · `AUTH_RUN_NOT_RESUMABLE` · `AUTH_SESSION_ENDED` ·
`CONTROLLED_DEMO_ONLY` · `SOURCE_REVIEW_REQUIRED`

**Memory**
`MEMORY_FACT_NOT_FOUND` · `MEMORY_FACT_LIMIT` · `INVALID_MEMORY_FIELD` ·
`INVALID_CONTEXT_IMPORT` *(text < 20 or > 50 000 chars)* · `INVALID_IMPORT_SIZE` *(0 or > 40 facts)* ·
`SENSITIVE_INFERENCE_FORBIDDEN`

**Always present**
`UNAUTHENTICATED` *(every `requireUserId` / `requireActionUserId`; route to sign-in, never show a
form error)* · `FORBIDDEN` *(operator gates and cross-owner access)* · `USER_NOT_FOUND`

**Operator-only**
`FIRECRAWL_NOT_CONFIGURED` · `FIRECRAWL_MONITORS_DISABLED` · `ACTIVE_MONITOR_NOT_FOUND` ·
`SOURCE_NOT_FOUND` · `SOURCE_TARGET_NOT_FOUND` · `SOURCE_ENTRY_NOT_FOUND` · `SOURCE_ENTRY_NOT_FAILED`

Rules:

1. **Anything in the send / accept family must say „Nichts wurde gesendet.“** — the whole
   approval/execution family, the whole acceptance family, the whole email-draft family,
   `ACTION_EXPIRED`, `ACCEPTANCE_EXPIRED`, and every failed executor call. It also covers the
   **terminal statuses** `rejected` / `failed` / `cancelled` / `expired` (§4.4.2), which are not
   errors at all but still need the sentence.
2. A rate-limit throw (`/rate.?limit|too many/i`) → „Kurz durchatmen: Bitte versuche es in einer
   Minute noch einmal.“ (existing string).
3. Unknown code → the existing generic „Der Scout konnte diesen Schritt gerade nicht abschließen.
   Bitte versuche es erneut. Dein Suchauftrag bleibt gespeichert.“
4. Provider and model text is **never** surfaced (`safeVoiceError` / `safeProviderError` already
   enforce this for voice; apply the same rule everywhere). Concretely: `request.error`,
   `mailbox.lastError`, `connection.lastErrorCode`, an AgentMail status string, and the ≤ 1000-char
   OpenAI body the realtime endpoint passes through are all **log-only**.
6. **HTTP failures need their own map.** The realtime session endpoint is an `httpAction` and
   returns plain text, so no `ConvexError` code exists for it — see §4.1's table. Any future
   `httpAction` the UI calls needs the same treatment.
5. Errors render inline, next to the control that failed. No global toast for a form error.

---

## 8. Purely demo-simulated — **must not be faked**

Exhaustive list. Each entry names the prototype construct, why it must go, and what replaces it.

### 8.1 The whole scripted timeline

| Construct | Why | Replacement |
|---|---|---|
| `SCRIPT` (8 steps), `runStep`, `showUtterance`, `afterUtterance`, `processFacts` | a fixed conversation with fixed facts | the real realtime session + `scout.sendMessage`; facts arrive from `update_search_draft` |
| `class Sched`, `speed`, `pause/resume/skip` | there is no timeline to schedule | delete; „Suche pausieren“ is `savedNeeds.setStatus` |
| `enter(stage)` auto-timers (`discovery` 500 ms, `scouting` 0/4000/8000 ms, `waiting` 7000 ms, `following_up` 5000 ms) | fabricates progress | stages come from `deriveScoutStage()` over live queries |
| `STATUS[0..3]`, `FOLLOW_STATUS`, `ALT_STATUS` fired on timers | claims work that has no row | `deriveStatusLine()` (§3.4) |
| `contactAndWait()`, `arriveReply()` | **simulates sending a message and receiving a portal reply** | never; a reply exists only as an `inbox` / `platformInbox` row |
| `ACT` / `ACT2` activity entries pushed on timers | fabricated audit trail | `notifications.listMine` (§10.1) + real row transitions |
| `FINAL_FACTS`, `KNOW0`, `SOURCES0`, `RULES0`, `CANDS`, `OFFER0` | fixtures | live queries |
| `notify()` on stage transitions | fabricated notifications | real `notifications` rows (§10.1) |

### 8.2 Fabricated content

| Construct | Why |
|---|---|
| The three `CANDS` rooms with photos, „ca. 28 m²“, „12 Min. mit der Stadtbahn“, „geteilt mit einer Band“ | **no backend fields exist** for photo, size, travel time or co-tenant count. Rendering them would be inventing listing data. |
| `assets/proberaum.png` as an offer/review photo fallback | shows a photo for a listing that has none |
| „Foto folgt vom Anbieter“ placeholder | implies a photo is expected |
| The clarification question „Donnerstag ist leider belegt. Wäre Mittwoch ab 19 Uhr auch möglich?“ and its detail „280 € inklusive Nebenkosten. …“ | a scripted provider utterance |
| The six review terms („Beginn: 1. Oktober 2026“, „Keine Kaution“, …) | fabricated contract terms |
| `scout.review.terms.body` (the full-terms paragraph) | a fabricated contract |
| The canned Q&A („Ich sage dem Anbieter verbindlich zu …“) | describes a binding commitment the product never performs automatically |
| The Settings `EXAMPLE` import text and its five derived candidates | a fabricated analysis result |
| Operator `tasks` (`t1`/`t2`/`t3`) and the five `09:41`/`09:42` incident events | fabricated ops data |
| Operator „Betriebsregeln“ (`2` parallel sessions, „Mit zunehmendem Abstand“) | fabricated infrastructure claims |
| Settings `usage` (`searches: 1`, `contacted: 1`) | fabricated metering |

### 8.3 Prototype scaffolding

The demo control bar (`demoOpen`, `toggleDemoPause`, `demoNext`, `onChapter`, `speedLabel`,
`toggleMobile`, „Beispielstörung laden“, „Steuerung ausblenden“), the phone-frame preview
(`stL/stT/stW/stH/stTf/stR/stB`), the chapter select, `restart()` / „Demo erneut ansehen“,
the footer „Designprototyp · Beispieldaten“, the Settings „Designprototyp“ badge and „Demo-Login“
row, and all eight `scout.hint.*` „Prototyp: …“ strings.

⚠ The hint strings are a special case: they exist because the demo cannot interpret free text. The
real Scout can. They must be **removed**, not translated. Translating „Prototyp: Freitext wird hier
nicht interpretiert.“ into the shipped app would be a regression, not a port.

### 8.4 Simulated authorisation and simulated sending — the hard prohibitions

These four are direct violations of §1 and must be called out to any builder:

1. **Settings → „Demo-Anmeldesimulation“ / „Demo-Anmeldung abschließen“**
   (`setAccess('roomscout','connected')`). It fakes a portal login. The real path is
   `browserbasePortal.startAuthentication({ connectionId })` → `/app/runs/:runId` → Live View, where
   **the human** enters credentials, solves any CAPTCHA and confirms with an explicit "signed in"
   tick (`resumeAuthentication`). `PortalAuthenticationGuide.test.tsx` pins *credentials stay in Live
   View; explicit "signed in" confirmation required.*
2. **Operator → „Anmeldung als erneuert simulieren“** (`renewLogin`). Same fake, worse: it puts it in
   an operator's hands. An operator has no path to another user's credentials and must not appear to.
3. **`acceptOffer` as a single click.** Replace with `offerAcceptance.prepare → getMine →
   approveAndSend`, hash-pinned, with the acknowledgement checkbox and the "Nothing was sent."
   error family (§4.9).
4. **`releaseMessage` → `contactAndWait()` composing the message client-side.** The approved content
   must be the persisted `payload`, decided with `expectedContentVersion` + `expectedContentHash` +
   `expectedPayload` (§4.4.1).

Also in this family: the „In dieser Demo wird nichts versendet.“ disclaimers. Do **not** keep the
disclaimer while sending for real, and do **not** keep the button while not sending. Pick one.

### 8.5 Prototype defects that must not be reproduced

From `SCOUT_STATE.md` §19.1 and the Settings/Operator docs — decided here:

| # | Defect | Decision |
|---|---|---|
| 1 | `backToConvo` sets `stepIndex = SCRIPT.length` → four `SCRIPT[8]` TypeErrors | moot; there is no `SCRIPT` |
| 2 | `compactBrief` hard-codes „Stuttgart · “ | **fix** — bind `need.city` |
| 3 | `summary()`'s `replace(/ & Umgebung/)` never fires | moot |
| 4 | `offerTitle`'s no-op `.replace` | moot |
| 5 | activity identity compared by object reference | moot; rows have `_id` |
| 6 | `keepSearching`/`keepWaiting` park the demo with no timer | moot |
| 9 | `Sched.paused` survives every stage change | moot |
| 10 | `arriveReply` swallows a reply while blocked | moot |
| — | Settings: the connection sheet is hard-wired to `roomscout` | **fix** — parameterise by source id, restore focus to the actual trigger |
| — | Settings: „Weitere Quellen“ duplicates the main list | **fix** — filter out already-listed sources |
| — | Settings: the more-list flash lands on the wrong row | **fix** |
| — | Settings: `originId` has no dismissal path | **fix** — add a close control |
| — | Settings: standalone mode throws on every action | **fix** — a genuine no-op bag |
| — | Operator: `openTask` never reset → empty detail stripe | **fix** — render the detail row only when there is text |
| — | Operator: active nav item loses its highlight on hover | **fix** — follow shadcn `SidebarMenuButton isActive` |
| — | Operator: the diagnose sheet has no entry point once resolved | **fix** — keep the trigger while an incident row exists |
| — | Everywhere: no focus trap, no background `inert`, no focus restore in any overlay | **fix** — adopt Radix `Dialog`/`AlertDialog`/`Sheet`; keep outside-click dismissal **off** on the discard dialog only |

---

## 9. Prototype elements with no backend counterpart — treatment

One row per element, one treatment each.

| # | Element | Surface | Treatment | Note |
|---|---|---|---|---|
| 9.1 | **Stage `dead_end`** + „Da komme ich gerade nicht weiter.“ + the scripted body | Scout | **hide** (do not derive) | Nothing computes "this city is exhausted". A time-plus-zero-matches heuristic would be a claim we cannot support, and `matches.listMine` returns `[]` for a non-active need anyway. **Keep the three compromise controls**, relocated to `waiting` as a permanent „Suchauftrag anpassen“ affordance wired to `savedNeeds.update` (§4.6). |
| 9.2 | Candidate/offer **photo**, „ca. 28 m²“, travel time, „Foto folgt vom Anbieter“ | Scout | **hide** (drop the media cell) | No fields on `signals`. ⚠ **Correction:** the *co-tenant* fact is **not** in this list — `signal.arrangement` (`permanent \| shared \| hourly \| unknown`) is real and `shared` is exactly it (§4.7). Render the arrangement; hide only the invented person count. |
| 9.2b | Provenance of a listing | Scout | **render, do not hide** | `signal.unknowns[]`, `signal.sourceCount`, `signal.verification`, `signal.status`, `signal.district` and `signals.get().evidence[]` are all real and all previously unbound. `signal.isDemo` must be **badged or filtered**, never rendered silently (§4.7, §11 Q16). |
| 9.3 | „Passende Quellen automatisch auswählen“ switch | Settings → Quellen | **build minimal backend later** (§10.4) | Today `enableDefaultAutopilot` already auto-selects platforms minus explicit excludes — i.e. the behaviour exists but there is no stored preference to turn it off. Render it **`nicht verbunden`** (disabled, with „Quellen werden automatisch gewählt; einzelne Quellen könnt ihr unten ausschließen.“) until the field exists. |
| 9.4 | **Feature-Flags page**, the overview mirror, `flags.voice`, `flags.publicSearch`, „In dieser Demo nicht aktiv“ | Operator + Settings | **hide** the page and the mirror; replace the pill with the real platform status | No flag store exists. Real analogues are env presence (voice) and `sources.active` (public search), both already surfaced elsewhere. |
| 9.5 | „Du kannst die App schließen. Ich melde mich.“ | Scout autopilot | **hide until §10.1 lands** | It promises out-of-app notification. Until a delivery channel exists, this is a false claim. After §10.1 (in-app feed) it may return as „Ihr könnt die App schließen. Ich sammle alles hier.“ |
| 9.6 | „Betriebsregeln“ (`Parallele Browser-Sessions 2`, `Erneute Versuche Mit zunehmendem Abstand`) | Operator overview | **hide**, or replace with the real `convex/rateLimits.ts` table | The numbers are invented. |
| 9.7 | „Export“ / „Demo-Daten exportieren“ and „Konto löschen“ | Settings → Datenschutz | **`nicht verbunden`** (render the rows, disabled, with the reason) | GDPR-adjacent affordances are informative even when unimplemented; a silent omission is worse. Add to §10 as future work. |
| 9.8 | „Stimmt“ (confirm an assumed fact), the undo bar, editing a memory fact | Settings → Wissen | **build minimal backend later** (§10.2) | All three are small additions on an existing soft-delete model. |
| 9.9 | Profil „Speichern“ (display name) | Settings → Profil | **build minimal backend later** (§10.3); until then read-only + `nicht verbunden` on the button | Nothing writes `displayName`. |
| 9.10 | **Benachrichtigungen** — three toggles + the Kanal control | Settings | **`nicht verbunden`** — disabled controls + the existing honest paragraph | ⚠ **Not** test-pinned (`ProfilePage.test.tsx` has five tests and none covers this paragraph); keep it on its merits and add a test if it matters. The table exists (`kind: new_match \| mail_reply \| outreach_failed \| system`, nine write sites, eleven titles — §5.5) but no preferences and no delivery channel do. |
| 9.11 | **Tarif & Nutzung** (`usage` — ⚠ **not** `billing`) — plan, three stat cells, payment rows, invoices | Settings | **`nicht verbunden`** — one card, heading "Billing is not available" + the existing paragraph | This one **is** pinned by `ProfilePage.test.tsx` ("states honestly that billing and metering are unavailable"). A deep link to `/app/settings/billing` silently lands on Quellen. |
| 9.12 | Operator „Letzter Demo-Test: Erfolgreich (Demo)“ per integration | Operator | **relabel** to „Nur Konfigurationsprüfung, kein Live-Test“ | `providerReadiness` is presence-of-env only (`credentialPresenceOnly` on browserbase). |
| 9.13 | Operator tile „Convex AI Gateway“ | Operator | **hide** or derive from the deployment | No `providerReadiness` entry. §11 Q10. |
| 9.14 | Operator incident timeline with fixed `09:41`/`09:42` timestamps | Operator | **replace** with `ops.listAudit` | |
| 9.15 | Knowledge tabs „Eure Band“ / „Alltag & Wege“ / „Ausstattung“ | Settings | **build the mapping** (§5.3) + a 4th tab „Weiteres“ | 13 backend categories vs. 3 tabs. |
| 9.16 | Clarification Ja/Nein buttons | Scout | **hide** the fixed pair; keep the composer | `uncertainties` is `string[]`; no typed answer channel. §10.6 if a structured one is wanted. ⚠ But the card still needs a **way out**: `opportunities.updateStatus({ status: "dismissed" })` and `opportunities.createHandoff({ channel, summary })` both exist and are wired in §4.5. `assessment.nextAction === "ask_musician"` is a second, stronger entry signal (§11 Q15). |
| 9.17 | Scout activity list („Suchauftrag gestartet“, „Raum gefunden“, …) | Scout | **build minimal backend later** (§10.1); until then **hide the disclosure** | Fabricating a timeline from `updatedAt` fields is exactly the "simulated progress" the rules forbid. |
| 9.18 | Scout toast (`notify`, 5 strings) | Scout | ties to §10.1; until then **hide** | |
| 9.19 | „Scout-Adresse (simuliert)“ as a notification channel | Settings | **hide** | The AgentMail address is real, but it is not a notification channel. |
| 9.20 | Settings „Änderungsverlauf“ entries generated by the prototype host (`Angabe korrigiert: …` etc.) | Settings | **partially real** — use `memory.listMine().events` (`eventType`, `summary`, `occurredAt`); events for `savedNeeds` edits are **not** in that stream | `savedNeeds` changes write `auditEvents`, which is operator-only. §11 Q4. |

---

## 10. Minimal backend additions, in priority order

Each is a small, named addition — not a new subsystem.

### 10.1 `api.notifications.listMine` + `markRead` — **highest value**

The `notifications` table already exists and is written on **nine** `db.insert` sites producing
**eleven** distinct titles (§5.5). Adding a read query unblocks the Scout activity list, the toast,
and the honest version of „Du kannst die App schließen.“ `kindValidator` below is the existing
schema union: `v.union(v.literal("new_match"), v.literal("mail_reply"), v.literal("outreach_failed"),
v.literal("system"))`.

```ts
// convex/notifications.ts
export const listMine = query({
  args: { limit: v.optional(v.number()), unreadOnly: v.optional(v.boolean()) },
  returns: v.array(v.object({ _id: v.id("notifications"), kind: kindValidator,
    title: v.string(), body: v.string(), signalMatchId: v.optional(v.id("signalMatches")),
    mailThreadId: v.optional(v.id("mailThreads")), readAt: v.optional(v.number()),
    createdAt: v.number() })),
  handler: /* requireUserId + by_owner_and_created_at, clamp limit 1..50 */,
});
export const markRead = mutation({ args: { notificationId: v.id("notifications") }, ... });
```

⚠ The nine write paths produce **English** titles/bodies (server-authored), and several bodies are
provider- or model-authored (a mail subject, an AgentMail status string, an `assessment.summary`, an
outreach error). Either translate the titles server-side or render them as-is with a language label
(§11 Q9); bodies that are error text must not be rendered at all (§7.3 rule 4).

Optionally, a combined `api.activity.listMine({ savedNeedId, limit })` over `notifications` +
`signalMatches.updatedAt` + `actionRequests.status` transitions + `providerConversations.state`
transitions would give the prototype's activity list exactly. ⚠ If it is built, note that
`providerConversations.state` is a five-value union (`waiting | thinking | needs_attention |
offer_ready | closed`, `convex/schema.ts:1623`) exposed as `v.string()` by `listMine`, and that
`actionRequests.status` has ten values (§3.1). Start with `notifications.listMine`.

### 10.2 Memory: `confirmFact`, `restoreFact`, `updateFact`

```ts
export const confirmFact  = mutation({ args: { factId }, /* verification: "user_confirmed", lastConfirmedAt */ });
export const restoreFact  = mutation({ args: { factId }, /* status: "deleted" → "active" */ });
export const updateFact   = mutation({ args: { factId, value }, /* + source: "user_edit", memoryEvents row */ });
```

All three are trivial: `deleteFact` is already a soft delete (`status: "deleted"`) that writes a
`memoryEvents` row and calls `bumpAndScheduleContext`. Mirror it.

### 10.3 `api.users.updateDisplayName`

```ts
export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  handler: /* requireUserId, trim, 1..80 chars, patch */,
});
```

Unblocks Settings → Profil. Must **not** touch `username` (auth identity) or `role`.

### 10.4 `savedNeeds.facets` for the auto-source preference

No schema change needed: `savedNeeds.facets` is the documented open extension point
(`{ namespace, key, value, confidence }`). Store `{ namespace: "sources", key: "auto_select",
value: true, confidence: 1 }` and read it in `enableDefaultAutopilot`. Unblocks §9.3.

### 10.5 A flag registry (only if the Operator flags page is wanted)

A tiny `operatorFlags` table `{ key, value, updatedBy, updatedAt }` with an operator-only query and
mutation. **Not recommended for this pass** — the two prototype flags have real analogues that are
already editable elsewhere (§6.5).

### 10.6 A typed clarification (only if Ja/Nein buttons are wanted)

Extend the opportunity assessment to emit
`uncertainties: { id, question, options?: { id, label }[] }[]` and add
`opportunities.answerUncertainty({ opportunityId, uncertaintyId, answer })`. **Not recommended for
this pass** — free text through `scout.sendMessage` already works and the model handles it.

### 10.7 Data export / account deletion

`api.privacy.exportMine()` (action returning a signed download of the user's own rows) and
`api.privacy.requestDeletion()`. Both are real product obligations but out of scope here; §9.7 keeps
the affordances visible as „nicht verbunden“ until then.

### 10.8 `offerAcceptance.canPrepare` — a read-only mirror of the acceptance gate

`ProviderOfferPanel` gates „Angebot prüfen“ on `offer.current && offer.ready && platformThreadId`,
but `prepare` runs `resolveControlledPortal`, which also demands an active connection, an approved
`sourceFlowPolicies` row and an active adapter binding (§4.8). A query that returns the same verdict
lets the UI hide the button instead of opening a dialog that fails:

```ts
export const canPrepare = query({
  args: { offerId: v.id("offerRevisions") },
  returns: v.object({ ok: v.boolean(), reason: v.optional(v.string()) }), // reason ∈ the §4.8 codes
  handler: /* requireUserId → currentAcceptableOffer → resolveControlledPortal, no writes */,
});
```

### 10.9 `memory.countMine` — an honest fact total

`memory.listMine` is `take(100)`-capped, so §5.7's „{n} Angaben“ cannot be truthful above 100. A
one-line counter (or a maintained `memoryProfiles.factCount`) fixes it; until then §5.7 drops the
number.

---

## 11. Open questions for the maintainer

1. **`scouting` vs. `waiting` split.** §3.1 derives it from "has any `actionRequests` row for this
   need been dispatched". Is that the split you want, or should `scouting` simply be dropped and
   `waiting` cover both? (Dropping it removes one stage and one status line and loses nothing
   persisted.)

2. **`dead_end`.** §9.1 recommends not deriving it and relocating the three compromise controls onto
   `waiting`. Confirm — or specify what "exhausted" means concretely (e.g. *mandate active for ≥ N
   days, zero non-dismissed matches at the current `matchingRevision`, ≥ M opportunities ended
   `dismissed`/`expired`*), in which case it becomes a derivable stage and I can write it.

3. **Three status lines name scripted content** — `scout.status.candidateFound`
   („Ein Raum in Stuttgart-West könnte passen. …“), `scout.status.asked` („Ich habe angefragt, ob euer
   Schlagzeug im Raum bleiben kann und Donnerstag frei ist.“) and `scout.status.followUp`
   („Ich bestätige, dass Mittwoch für euch möglich ist, …“). They need generic replacements with
   slots. Do you want to write them, or should I propose DE/EN pairs?

4. **Change log scope.** Settings → „Änderungsverlauf“ shows fact edits. `memory.listMine().events`
   covers memory changes only; `savedNeeds` edits write `auditEvents`, which is operator-only. Should
   the change log (a) show memory events only, (b) get a user-visible need-edit event stream, or
   (c) be dropped?

5. **`complete` headline.** „Euer nächster Proberaum steht bereit.“ overstates a sent acceptance —
   the backend's own wording is "No payment or contract signature was performed." Preferred
   replacement? (Suggestion: „Eure Zusage ist raus.“ + the backend's sentence as the subline.)

6. **`maxBrowserMinutesPerDay`** has no control in the prototype (default 30, server range 0..240).
   Expose it under „Weitere Grenzen“, or leave it at the default and document it?

7. **Knowledge tabs.** 13 backend categories, 3 prototype tabs. §5.3 proposes a 4th tab „Weiteres“
   for `preference` / `constraint` / `other`. Accept, or a different grouping?

8. **The three English starter prompts** ("We need a permanent room for our band" / "We are open to
   sharing with a compatible band" / "Help me work out what matters before we search") replace the
   scripted suggestion chips. Do you want DE translations of these, or new German starters written
   from scratch?

9. **Server-authored strings cannot be translated client-side**: the two `searchSources` disclosures,
   the provider-conversation blocker prefix ("The search, listing or provider conversation has
   changed. Reassessment is required."), all `notifications` titles/bodies, and
   `assessment.summary` / `blockers` / `uncertainties` (model output). Translate them server-side,
   or show them as-is with a language label?

10. **Operator „Convex AI Gateway“ tile.** `providerReadiness` has no entry for it (the gateway is
    in-process). Hide the tile, or add a `convexGateway` block to `deriveProviderReadiness`?

11. **Settings ↔ Operator as dialogs.** Both are specified as shadcn `sidebar-13` dialogs over the
    Scout surface, but the app today has real routes and **three** URL contracts that already work
    and that `ProfilePage.test.tsx` pins two of:
    - `/app/settings/:section` with `section ∈ sources | autonomy | knowledge | profile |
      notifications | usage | privacy` (unknown → `sources`);
    - legacy `?section=` and `?tab=connections|memory`;
    - **`/app/scout?mode=…&signalId=…`**, which `ScoutPage.tsx:145-171` turns into `scout.setFocus`
      (`signalId` is mandatory for `signal_advisor` / `outreach_drafting`).

    Should the dialogs be URL-addressable (`/app/scout?settings=sources`) so all three keep working,
    or do the routes stay and the dialog is an additional entry point?

12. **Prototype band identity.** „Herzbuben“, `herzbuben@scout.example` and the initials `HB` are
    fixtures. Confirm they are replaced everywhere by `users.current` and `mailboxes.getMine`
    (including the `initials` special case, which the prototype hard-codes).

13. **The 15-minute voice cap.** `useRealtimeVoiceScout` disconnects unconditionally 15 minutes
    after `connectedAt` (§3.5). The prototype has no copy for a call that ends by itself. Do you
    want a visible countdown from the start, a warning only in the last minute, or a silent end that
    lands on „Gespräch beendet. Eure Wünsche bleiben als Entwurf gespeichert.“?

14. **`factsFromNeed` is English, the fact card is German.** Ten labels and nine value templates
    (§4.3) plus the facet renderer, which today emits a **model-authored English label** with a
    German „Ja“/„Nein“ value. Three options: (a) translate the ten fixed labels/values client-side
    and leave facet labels as they come; (b) additionally ask the Scout to write facet labels in the
    active language; (c) render facet labels verbatim with a language marker. Which?

15. **`nextAction` as the clarification trigger.** `providerAssessment.nextAction === "ask_musician"`
    is a persisted, model-made decision that the *user* must answer, and it is strictly better than
    "`opportunity.uncertainties` is non-empty". Fold it into §3.1 step 6, or keep `uncertainties` as
    the only trigger?

16. **`signal.isDemo`.** Demo-provenance signals are indistinguishable from real ones in every list
    today. Badge them („Kontrollierte Demo-Quelle“), filter them out of the musician surface
    entirely, or make it an operator-only visibility toggle?

17. **Source preference: two switch positions or four?** The backend enum is
    `include | prefer | neutral | exclude`, the default is `neutral`, and **only `exclude` changes
    behaviour** (§5.1). Ship the honest two-state switch (`include` / `exclude`, with `neutral` and
    `prefer` rendering as on), or is `prefer` meant to gain an effect — in which case it needs one
    in `enableDefaultAutopilot` first?

18. **New German strings this revision requires.** Beyond §11 Q3's three status lines: the four
    unnamed `portalUiStatus` states („Nicht verfügbar“ / „Anmeldung nötig“ / „Pausiert“ /
    „Noch nicht verbunden“), the pending-connection state after „Einbeziehen“, the five mailbox
    states, the five §4.4.2 outcome strings, and the `contactEligible === false` reason. Write them
    yourself, or shall I propose DE/EN pairs with the rest of Q3?

19. **A mandate already in `research_autopilot` / `outreach_autopilot`.** The prototype has two
    radios for four backend modes (§5.2). Render a read-only third state naming the actual mode with
    an explicit "switch to…" action, or collapse the two extra modes into „Autopilot“ (widening) /
    „Mit Rücksprache“ (misreporting)? Neither collapse is honest, hence the third state.
