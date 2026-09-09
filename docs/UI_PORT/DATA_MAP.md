# DATA_MAP — the current app's data layer

Scope: everything a builder needs to wire the NEW (prototype-derived) UI to the EXISTING Convex
backend without reading the old React code. Every function name, argument object and return shape
below was read from the repo on branch `ui-port` (working tree, uncommitted changes included).

Paths are absolute. Convex modules live in `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/convex/`,
frontend in `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/`.

Revision pass: every claim below has been re-checked against the working tree, corrections are marked ⚠,
and §8 adds the DE/EN copy inventory the port needs. Where a screen's rendered copy matters for the
rebuild it is now quoted verbatim rather than summarised.

---

## 0. Conventions and plumbing

### 0.1 Client wiring

`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/main.tsx` — the whole file:

```tsx
import "@fontsource-variable/geist";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import "./styles/app.css";
import "./styles/design-system.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root application mount.");

createRoot(root).render(<StrictMode><AppProviders><AppRouter /></AppProviders></StrictMode>);
```

The three side-effect imports are the app's **entire styling entry point** and matter for the port:
`@fontsource-variable/geist` is the app font; `src/styles/app.css` + `src/styles/design-system.css`
carry the design tokens and the whole `rs-*` / `btn` / `btn-p|btn-s|btn-g|btn-sm` / `lcard` / `pill` /
`mono` / `chip` / `flabel` / `input` / `ack` / `hint` / `type` / `fchip` class vocabulary that every
component quoted in this document uses. The app mounts on `#root` and throws
`"Missing #root application mount."` when that element is absent.

`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/app/providers.tsx`

- `new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)` — throws at module load if `VITE_CONVEX_URL`
  is missing (`"VITE_CONVEX_URL is required. Run \`npx convex dev\` first."`).
- `<ConvexAuthProvider client={convex} api={{ refreshSession: api.auth.refreshSession, signOut: api.auth.signOut }} ambientSignIns={[]}>`
- Auth package is `@convex-dev/auth` (v2-style: `setupCore` + `setupUsernamePassword` in `convex/auth.ts`).

### 0.2 Query conventions used everywhere

- `useQuery(fn, args | "skip")` — `"skip"` while a dependency (e.g. the active need) is not yet known.
- Loading is `=== undefined`; "exists but empty / not found" is `null` or `[]`. Almost every screen
  branches on `x === undefined` for its skeleton and on `!x` for its empty state.
- `usePaginatedQuery(fn, args, { initialNumItems })` is used for `api.scout.listMessages` (60),
  `api.sourceIntelligence.listPlatforms` (50 on OpsOverviewPage / 30 inside SourceIntelligencePanel),
  `api.sourceIntelligence.listCandidates` (50 / 30), `api.sourceProbes.listRuns` (20),
  `api.sourcePolicies.listForPlatform` (**25**, used twice — approved and draft policies),
  `api.sourceAdapters.listForPlatform` (20, used three times — listing / contact / auth adapters).
- Ownership: every `*Mine` function calls `requireUserId(ctx)` (`convex/integrations/authz.ts`) and filters
  by `ownerId`. There is **no** client-side ownership filtering to reimplement anywhere — including the
  two places noted below, which are owner-scoped server-side (`providerConversations.listMine` and
  `externalActions.listMine` both call `requireUserId` and query by `ownerId`). What React adds there is
  a **narrowing** filter, not a security filter: ScoutPage keeps only `row.savedNeedId === need._id`,
  MusicianInboxPage keeps only `requestedActionType === "submit_webform" && payload.kind === "contact_form"`.
- Errors are `ConvexError({ code: "..." })`. **Only ScoutPage humanises them** (`readableError`, §1.6).
  Every other screen renders `caught instanceof Error ? caught.message : <English fallback>`, i.e. the raw
  ConvexError payload — codes like `INCOMPLETE_NEED`, `MANDATE_CONTENT_CHANGED`, `PLATFORM_NOT_AVAILABLE`,
  `MATCH_NO_LONGER_CURRENT`, `OPPORTUNITY_NO_LONGER_MATCHES` — is shown to the user verbatim. The
  fallbacks are listed per screen in §1.7–§1.10 and collected in §8.4. **The port must add a code →
  copy map** (DE/EN) instead of reusing `error.message`.

### 0.3 Server-side rate limits the UI must be able to survive

`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/convex/rateLimits.ts` (fixed windows):

Complete list (every key in the file, none omitted):

| key | rate |
|---|---|
| `scoutMessage` | 10 / minute |
| `matchRefresh` | 2 / minute |
| `contextImport` | 3 / hour |
| `voiceSession` | 3 / hour |
| `voiceTool` | 30 / minute |
| `agentMailUser` | 10 / day |
| `agentMailGlobal` | 50 / day |
| `portalReconUser` | 3 / hour |
| `portalReconSource` | 5 / day |
| `portalAuthSource` | 3 / day |
| `portalInboxSource` | 2 / hour |
| `portalWriteUser` | 10 / day |
| `portalWriteSource` | 20 / day |
| `portalSessionGlobal` | 20 / day |
| `sourceDiscoveryOperator` | 10 / day |
| `firecrawlInteractUser` | 10 / day |
| `evaluationGatewayUser` | 60 / minute |
| `evaluationGatewayGlobal` | 120 / minute |

`voiceTool` is charged by **both** `api.voice.executeTool` **and** `api.voice.getInstructions`
(`convex/voice.ts:406-412`). That matters for the port: `useRealtimeVoiceScout` calls `getInstructions()`
on connect **and again on every scout-context change while connected** (§3.10), so navigating between
signals during a live call burns the same 30/min bucket the model's own tool calls use.

`ScoutPage.readableError()` special-cases rate limits:
„Kurz durchatmen: Bitte versuche es in einer Minute noch einmal."

---

## 1. Per route / surface

Router: `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/app/router.tsx`

| path | element | guard |
|---|---|---|
| `/` | `LandingPage` | public |
| `/explore` | `ExplorePage` | public |
| `/signals/:signalId` | `SignalDetailPage` | public |
| `/map` | `MapPage` | public |
| `/sign-in`, `/sign-up` | `AuthRoute` | public |
| `/app/scout` | `ScoutPage` | `RequireAuth` + `VoiceSessionProvider` |
| `/app/explore` | `AppExplorePage` | idem |
| `/app/map` | `MapPage workspace` | idem |
| `/app/search` | `MySearchPage` | idem |
| `/app/inbox` | `MusicianInboxPage` | idem |
| `/app/profile` | `ProfilePage` | idem |
| `/app/settings/:section?` | `ProfilePage` | idem |
| `/app/runs/:runId` | `BrowserRunPage` | idem |
| `/ops`, `/ops/signals`, `/ops/sources`, `/ops/outreach`, `/ops/inbox`, `/ops/audit` | Ops pages | `RequireAuth` + `RequireOperator` |
| `*` | `<Navigate to="/" replace />` | — |

The whole `/app/*` subtree is wrapped **once** in `<VoiceSessionProvider>` so a voice call survives
navigation between Scout, search, inbox, settings and map (see §2.11).

---

### 1.1 `/` — LandingPage

`src/routes/public/LandingPage.tsx`, `src/components/landing/*`

**No Convex calls at all.** Everything is local state + `src/components/landing/landingStoryModel.ts`
(a scripted demo of the Scout conversation). Only `Link`s into `/app/scout`, `/sign-up`, `/explore`.
Nothing to wire — the new landing can stay data-free.

---

### 1.2 `/explore` (public) and `/app/explore` (authenticated) — ExplorePage

`src/routes/public/ExplorePage.tsx`. One component `ExploreContent({ authenticated })`, exported twice:
`ExplorePage` (with `<PublicHeader/>`) and `AppExplorePage` (inside `<WorkspaceShell mode="musician">`).

| call | kind | args | feeds |
|---|---|---|---|
| `api.signals.list` | query | `{ city: location.trim() \|\| undefined, side: side === "all" ? undefined : side, limit: 50 }` | the signal grid; `signals?.length` is the "N indexed signals" meta |
| `api.savedNeeds.create` | mutation | `{ title: \`Rehearsal-room search in ${city}\`, city, districts: [], arrangement: [...], schedule: [...], requirements: [...], maxBudgetEur }` | "Save this search" gate → then `navigate("/app/search")` |

**Defaults and filter semantics** (a 1:1 port must reproduce these exactly):

- Initial city = `?city=` from the URL, **falling back to the hard-coded `"Stuttgart"`**. `side` starts
  `"all"`, `sort` starts `"relevant"`, no chips selected, and `referenceTime` is frozen at mount
  (`useState(() => Date.now())`).
- Local filter chips (client-side only, over the fetched array), in render order:
  `Fixed monthly`, `Hourly`, `≤ €250/month`, `Evenings`, `Storage`, `Fresh this week`.
  - `Fixed monthly` keeps `arrangement === "permanent"` **or** `"shared"` (not just permanent).
  - `Hourly` keeps `arrangement === "hourly"`.
  - `≤ €250/month` requires `pricePeriod === "month" && priceEur !== undefined && priceEur <= 250`.
  - `Evenings` = `requirements.some(v => /evening|abend/i.test(v))`.
  - `Storage` = `requirements.some(v => /storage|lager/i.test(v))`.
  - `Fresh this week` = `referenceTime - lastSeenAt <= 7 * 86_400_000`.
- Sort: `relevant` = verified first, then `lastSeenAt` desc; `newest` = `lastSeenAt` desc.
- Rows are mapped through `publicSignalToMarketSignal()` (§3.9).
- The save mutation derives its arguments from the chips:
  `Fixed monthly` → `arrangement: ["permanent","shared"]`, `Hourly` → `["hourly"]` (both chips
  concatenate), `Evenings` → `schedule: ["Evenings"]`, `Storage` → `requirements: ["Storage"]`,
  `≤ €250/month` → `maxBudgetEur: 250`; `districts: []` always. On success it closes the gate and
  `navigate("/app/search")`.
- Unauthenticated save gate shows sign-up/sign-in links instead of the mutation.

**Copy** (all English today):
title "Market explorer"; meta `Live index` + `<n> indexed signals`; location input placeholder "City"
with sr-only label "Location"; side segmented control (`aria-label="Signal side"`) "All" / "Supply" /
"Demand"; sort select (`aria-label="Sort signals"`) "Most relevant" / "Newest"; "Save this search";
result count `<n> signals in <city | "all indexed locations">` + "Public, provenance-linked observations";
loading `"Loading signals…"` / "RoomScout is loading the current public index."; empty
`"No matching signals yet"` / "No indexed signal currently matches this location and filter combination.
Try removing a filter or searching another city."
Save gate dialog: title "Review before saving" (authenticated) / "Save it to your account" (anonymous);
body "The current city and supported filters will become an editable draft search. Your Scout can refine
it with you before activation." / "Sign in so RoomScout can preserve this search and alert you. Browsing
remains public."; buttons "Not now", "Save draft search" / "Saving…", "Create account", "Sign in".
Guards/errors: "Add a city before saving this search." and the fallback "The search could not be saved."

---

### 1.3 `/signals/:signalId` — SignalDetailPage

`src/routes/public/SignalDetailPage.tsx`

| call | kind | args | feeds |
|---|---|---|---|
| `api.signals.get` | query | `{ signalId }` or `"skip"` | whole page |

Return: `{ signal: <signal projection>, evidence: [<evidence projection>] } | null`.
Server-side (`convex/signals.ts:147-185`) the query returns **at most 12 evidence rows**, each
`{ _id, sourceName (fallback "Unknown source"), sourceUrl, sourceTitle, excerpt, observedAt }`, and it
returns `null` for any signal whose status is neither `published` nor `stale`.
`detail.evidence[0]` provides `sourceName`, `excerpt`, `sourceUrl` ("Open source" link).
The signal itself is rendered through `publicSignalToMarketSignal(detail.signal, primaryEvidence?.sourceName)` (§3.9).

**Layout** (top to bottom): back link → `SignalBadge` → `<h1>` + `Freshness` → `location · arrangement`
→ two columns. Left column: "Known facts" card (facts table + `signal.summary`), "Unknown or unclear"
card, "Freshness" section (a three-row timeline). Right column: "Fit — sign in for yours" card,
"Provenance" card, the action row, the footnote.

**Copy** (all English):
"Back to explorer"; "Known facts"; "Unknown or unclear" (empty: "No unresolved fields were recorded
during normalization."); "Freshness" with rows First observed / Last checked / Index status
("Possibly stale" when `status === "stale"`, else "Published"), both timestamps via `formatMessageTime`;
"Fit — sign in for yours" + "Create or activate a saved search to see structured match reasons and
uncertainties for this signal."; "Provenance" with rows Source (`primaryEvidence.sourceName` ??
`<n> indexed source(s)`), "Evidence records" (`detail.evidence.length`), Verification
(`verification.replace("_"," ")`), then the excerpt and an "Open source" external link, or
"No public evidence excerpt is attached to this record yet."; CTA **"Ask Room Scout about this"**
→ `/app/scout?mode=signal_advisor&signalId=<id>` (this is how the Scout gets focused on a signal);
"Save"; footnote "Exact recipient and message approval is required before any inquiry is sent."
Save gate dialog: "Continue with your Scout" / "Sign in so RoomScout can keep your search, Scout thread,
saved signal, and approvals together." / "Not now" / "Create account" / "Sign in" (the sign-in link
carries `?returnTo=/signals/<id>`).
States: loading `"Loading signal…"` / "RoomScout is loading the current record and its provenance.";
not found `"Signal not found"` / "This signal is not public, no longer available, or the link is invalid."

---

### 1.4 `/map` and `/app/map` — MapPage

`src/routes/MapPage.tsx`; `MarketGlobe` is lazy-loaded (`src/components/map/MarketGlobe.tsx`, Mapbox).

| call | kind | args | feeds |
|---|---|---|---|
| `api.map.listAreas` | query | `{}` | city dropdown + area bubbles when no city selected |
| `api.map.listPins` | query | `{ city, side?, freshOnly, verifiedOnly, limit: 250 }` or `"skip"` when no city | per-signal pins |

`listAreas` → `[{ city, latitude, longitude, supplyCount, demandCount, verifiedCount, freshCount, lastSignalAt? }]`
— the server reads **at most 100 `marketAreas` rows**, unfiltered and unordered.
`listPins` → `[{ signalId, side, title, city, district?, latitude, longitude, precision, status, verification, arrangement, lastSeenAt, sourceUrl?, isDemo? }]`

Server semantics the UI must not misdescribe (`convex/map.ts:297-325`):

- `listPins` also accepts **`arrangement?: "permanent"|"shared"|"hourly"|"unknown"`**, which MapPage
  never passes — it is available for the port.
- **`freshOnly` is not a time window.** It restricts the query to `status: "published"` (dropping
  `stale`); without it both statuses are read. `verifiedOnly` requires `verification === "verified"`.
- `limit` is clamped to 1..300 (default 200); MapPage sends 250. Pins with no `latitude`/`longitude`
  are skipped entirely, so a signal without coordinates simply never appears.

**MapPage does NOT use `publicSignalToMarketSignal`.** It has its own local `freshnessLabel(lastSeenAt, stale)`:
`"Possibly stale"` when stale, else `"Checked within the hour"` (<1 h), `` `Checked ${hours} h ago` ``
(<24 h), `` `Checked ${Math.floor(hours/24)} d ago` ``. Area bubbles use `"No freshness data"` when
`lastSignalAt` is absent.

View mapping into `MapMarketSignal`:

- pin → `{ id: signalId, isDemo, title, coordinates: [longitude, latitude], side,
  locationLabel: [district, city].filter(Boolean).join(", "), source: sourceUrl ? "Public source" : "Indexed source",
  freshnessLabel, summary: `${verification} · ${arrangement} · ${precision === "exact" ? "published exact location" : `approximate ${precision.replace("_"," ")} location`}` }`
- area → `{ id: `area-${city}`, title: `${city} market area`, side: supplyCount >= demandCount ? "supply" : "demand",
  locationLabel: city, source: "RoomScout market index",
  summary: `${supplyCount} supply · ${demandCount} demand · ${verifiedCount} verified` }`

**Copy**: header title "RoomScout coverage map", eyebrow "Observed public coverage", meta
`<n> positioned signals` (city chosen) / `<n> positioned markets`; city select `aria-label="Market city"`
with the first option **"All market areas"** (value `""`); side segmented control "All"/"Supply"/"Demand";
two toggle chips "Fresh only" and "Verified only"; loading "Loading the live market index…"; empty
"No geocoded signals match these filters yet. Signals remain usable even when a location cannot be
positioned."; lazy-map fallback "Loading the interactive map…".
`MarketGlobe` props: `autoRotate={!city}`, `initialCenter={city && mapSignals[0] ? mapSignals[0].coordinates : undefined}`,
`initialZoom={city ? 9 : undefined}`, `signals={mapSignals}`.
`MapPage({ workspace })` renders inside `WorkspaceShell mode="musician"` when `workspace`, else
`<PublicHeader/><main>…`.

---

### 1.5 `/sign-in`, `/sign-up` — AuthRoute + AuthPage

`src/app/AuthRoute.tsx`, `src/routes/public/AuthPage.tsx`, `src/app/returnTo.ts`, `src/features/auth/errors.ts`

- `useSignInWithPassword(api.auth.signInWithPassword)` and `useSignUpWithPassword(api.auth.signUpWithPassword)`
  from `@convex-dev/auth/providers/password/react`; both return `{ signIn|signUp, pending }`.
- Credentials shape `AuthCredentials` = `{ username, password }` (username/password provider, **not** email).
- Result `{ success, userError }`; `authErrorMessage(userError)` maps to copy; `MIN_PASSWORD_LENGTH` /
  `MAX_PASSWORD_LENGTH` exported from `src/features/auth/errors.ts` and used by the form.
- On success: `navigate(safeReturnTo(searchParams.get("returnTo")), { replace: true })`.
  `safeReturnTo` accepts only values starting with a single `/` and **defaults to `"/app/scout"`**
  (`src/app/returnTo.ts`; test: `src/app/returnTo.test.ts`).
- `<Authenticated>` on this route immediately redirects to `returnTo`.

**Form behaviour** (`src/routes/public/AuthPage.tsx`): `MIN_PASSWORD_LENGTH = 10`,
`MAX_PASSWORD_LENGTH = 100`. The mode is inferred from the pathname
(`location.pathname.endsWith("sign-up") ? "signUp" : "signIn"`, overridable by the `initialMode` prop),
and the in-card toggle switches mode **without changing the URL**. Client-side pre-checks run before
`onAuthenticate` and set their own `notice`:

| condition | notice |
|---|---|
| `!username.trim()` | "Enter a username." |
| `[...password].length < 10` | "Use at least 10 characters." |
| `[...password].length > 100` | "Use no more than 100 characters." |
| sign-up and `password !== confirmation` | "The passwords do not match." |
| no `onAuthenticate` prop | "Authentication is not connected in this presentation-only route yet." |

`error ?? notice` is rendered in one `aria-live="polite"` line.

**Copy**: card eyebrow „Dein persönlicher RoomScout"; headline „Euer nächster Raum beginnt hier."
(sign-up) / „Schön, dass du wieder da bist." (sign-in); sub „Ein Gespräch. Ein Suchauftrag. Dein Scout
bleibt dran." / „Deine Suche und eure Gespräche warten auf dich."; context line "Your current search can
continue after authentication."; fields "Username" (placeholder "e.g. vierteltakt"), "Password" (toggle
labels "Show password"/"Hide password", hint "10–100 characters. No spaces at the beginning or end."),
"Confirm password" (sign-up only); submit "Please wait…" / "Create account" / "Sign in"; swap line
"Already have an account? " + button "Sign in", or "New here? " + button "Create an account";
footer link "Continue browsing without an account" → `/explore`.

**`authErrorMessage`** (`src/features/auth/errors.ts`) — all 14 branches, verbatim:

| `userError.error` | message |
|---|---|
| `PASSWORD_TOO_SHORT` | `Use at least ${minimumLength ?? 10} characters.` |
| `PASSWORD_TOO_LONG` | `Use no more than ${maximumLength ?? 100} characters.` |
| `PASSWORD_HAS_SURROUNDING_WHITESPACE` | "Remove spaces from the beginning or end of the password." |
| `PASSWORD_TOO_COMMON` | "Choose a less common password." |
| `USERNAME_TOO_SHORT` | `Use at least ${minimumLength ?? 1} character for the username.` |
| `USERNAME_HAS_SURROUNDING_WHITESPACE` | "Remove spaces from the beginning or end of the username." |
| `USERNAME_HAS_INVALID_CHARACTERS` | "The username contains unsupported or invisible characters." |
| `USERNAME_TAKEN` | "That username is already in use." |
| `USER_NOT_FOUND` | "No account exists for that username." |
| `INVALID_CREDENTIALS` | "The username or password is incorrect." |
| `RATE_LIMITED` | `Too many attempts. Try again in ${seconds} second(s).` — `seconds = max(1, ceil(retryAfterMs ?? 1000 / 1000))`, singular/plural switched |
| `INVALID_PASSWORD` | "Choose a valid password." |
| `INVALID_USERNAME` | "Choose a valid username." |
| `OTHER_ERROR` | "An unexpected authentication error occurred. Please try again." |
| *(default)* | "Authentication failed. Please try again." |

---

### 1.6 `/app/scout` — ScoutPage (the main surface)

`src/routes/musician/ScoutPage.tsx` (749 lines) — the screen the prototype replaces.

**Queries**

| call | args | feeds |
|---|---|---|
| `api.users.current` | — | greeting `Hey ${displayName ?? username ?? "there"}.` |
| `api.savedNeeds.listMine` | `{ limit: 10 }` | need resolution (below) |
| `api.scout.getMine` | `{}` | `{ threadId, mode, activeNeedId?, focusedSignalId? } \| null` |
| `api.memory.listMine` | `{}` | only `memory.facts.length` here — picks one of two intro sentences |
| `api.scout.listMessages` (paginated) | `{ threadId }` / `"skip"`, `initialNumItems: 60` | chat transcript |
| `api.matches.listMine` | `{ savedNeedId, limit: 30 }` / `"skip"` | result cards, activity counters |
| `api.opportunities.listMine` | `{ savedNeedId, limit: 20 }` / `"skip"` | "attention" question, open-opportunity count |
| `api.providerConversations.listMine` | `{ limit: 30 }` then **client-filtered** `row.savedNeedId === need._id` | `ProviderOfferPanel` cards |
| `api.outreach.listMine` | `{ limit: 50 }` | finds the draft matching `signalId + savedNeedId` for `ApprovalComposer` |
| `api.mandates.getActiveMine` | `{ savedNeedId }` / `"skip"` | `isAutopilot` = mode is `outreach_autopilot` or `negotiation_autopilot` |

**Mutations / actions**

| call | kind | args | trigger |
|---|---|---|---|
| `api.savedNeeds.getOrCreateDraft` | mutation | `{}` | effect, when `needs` has no non-archived row (guarded by `initDraftRef`) |
| `api.scout.getOrCreateThread` | mutation | `{ activeNeedId }` | effect, when `scoutContext.activeNeedId !== need._id`, guarded by `initThreadForRef` (holds the need id; reset to `undefined` on failure so the effect can retry) |
| `api.scout.setFocus` | mutation | `{ threadId, mode, activeNeedId, focusedSignalId? }` | URL `?mode=search_discovery` / `?mode=signal_advisor&signalId=` / `?mode=outreach_drafting&signalId=`; also before an inquiry |
| `api.scout.sendMessage` | **action** | `{ threadId, message }` | chat send; also the pre-written inquiry prompt |
| `api.mandates.enableDefaultAutopilot` | mutation | `{ savedNeedId }` | „Scout losschicken" in the brief-review card |
| `api.savedNeeds.setStatus` | mutation | `{ needId, status: "paused" \| "active" }` | Pausieren / Fortsetzen |
| `api.matches.updateStatus` | mutation | `{ matchId, status: "dismissed" }` | Dismiss on a result card |
| `api.matches.recomputeMine` | **action** | `{ savedNeedId }` | „Aktualisieren" (only shown while `need.status === "active"`) |

**Need resolution rule (reused verbatim on 3 screens)**

```ts
const need = scoutContext === undefined ? undefined
  : needs?.find(n => n._id === scoutContext?.activeNeedId && n.status !== "archived")
    ?? needs?.find(n => n.status !== "archived");
const threadId = need && scoutContext?.activeNeedId === need._id ? scoutContext.threadId : undefined;
```

Same code in `MySearchPage.tsx` and `SearchControlSettings.tsx`. **Extract this into one hook for the port.**

**Local UI state machine** (this, not the derived mode, is what the prototype's stage model must map onto):

```ts
const [sending, setSending]   = useState(false);          // a scout.sendMessage action is in flight
const [working, setWorking]   = useState(false);          // run(): any other mutation/action in flight
const [error, setError]       = useState("");             // readableError() output, rendered per branch
const [voiceOpen, setVoiceOpen] = useState(() => voice.connected); // a LIVE CALL re-opens the voice stage on mount
const [textOpen, setTextOpen] = useState(false);
const [reviewOpen, setReviewOpen] = useState(false);      // brief-review card
const [contextImportOpen, setContextImportOpen] = useState(false);
const [draftSignal, setDraftSignal] = useState<MarketSignal>();  // opens ApprovalComposer when a draft exists

function openVoice()  { setVoiceOpen(true); if (!voice.connected) void voice.connect(); }
function finishVoice() { setVoiceOpen(false); setReviewOpen(facts.length > 0); }
```

`finishVoice` is passed as `RealtimeVoiceScout.onEnd`: **ending a voice call automatically opens the
brief-review card whenever any fact exists.** That is the main path into `brief_review` — §4's "the user
asked to review" (the „Suchauftrag ansehen" button) is only the secondary one.
`voiceOpen` hides the topline header and both non-voice branches; the voice stage is rendered as
`<RealtimeVoiceScout facts={facts} onEnd={finishVoice} />`.

The `SavedSearch` object handed to `ApprovalComposer` is built **locally** here —
`{ id: need._id, title: need.title, status: draft|paused|active, fields: factsFromNeed(need).map(f => ({ label, value, source: "you" })) }`
— i.e. ScoutPage does **not** use `savedNeedToSearch`, so the same card is worded differently on
`/app/search` (§3.9). The signal object handed to the same dialog comes from ScoutPage's own
`marketSignal(match, now)` mapper, also documented in §3.9.

**Render caps** (hard-coded, easy to miss):
`providerConversations.filter(r => r.offer).slice(0, 2)` offer panels; `matches?.slice(0, 6)` result
cards; `attention.uncertainties.slice(0, 2)` question buttons. The brief-review primary button is
`disabled={working || !need.city.trim()}` — an empty city (the `getOrCreateDraft` default, §3.1)
disables „Scout losschicken" before the server would throw `INCOMPLETE_NEED`.

**Derived UI mode** — `getScoutWorkspaceMode(need, matches, opportunities)` (§3.2), then:

```ts
const mode = baseMode === "waiting" && providerConversations.some(r => r.offer) ? "results" : baseMode;
```

Note `matches` is `undefined` while loading **and `[]` for any need that is not `status:"active"`**
(§3.5) — so a paused or draft need can never reach `"results"` through matches.

**Inquiry flow** (`prepareOutreach(match)`):
1. build a `MarketSignal` view object from the match,
2. `setScoutFocus({ threadId, mode: "outreach_drafting", activeNeedId, focusedSignalId: match.signal._id })`,
3. `sendScoutMessage({ threadId, message: "Handle the next appropriate inquiry about “<title>”. Use only the active persisted mandate for eligible non-binding outreach. Any commitment or human-only step must come back to me." })`,
4. the Scout agent's `createOutreachDraft` / `createWebformDraft` tool persists a draft,
5. ScoutPage finds it in `api.outreach.listMine` and opens `<ApprovalComposer draftId=… />`.

**Error copy** (verbatim, `readableError`):
- rate limit (`/rate.?limit|too many/i` on the message) → „Kurz durchatmen: Bitte versuche es in einer Minute noch einmal."
- otherwise → „Der Scout konnte diesen Schritt gerade nicht abschließen. Bitte versuche es erneut. Dein Suchauftrag bleibt gespeichert."
- no need yet → „Dein Scout macht sich bereit …" + „Erneut versuchen"

**Full screen copy** — this is the largest German surface in the app and the one the prototype replaces.
Verbatim, in render order.

*Topline* (hidden while `voiceOpen`): status „Wir lernen euch kennen" (`discovery`) / „Suche pausiert"
(`paused`) / „Autopilot aktiv" (`isAutopilot`) / „Begleitete Suche"; link „Einstellungen" → `/app/settings`.

*Discovery branch* (`mode === "discovery" && !voiceOpen`):
greeting `Hey ${name}.` — `name = displayName ?? username ?? "there"` — or „Aus unserem Gespräch"
while `reviewOpen`; title „Euer Proberaum beginnt mit einem Gespräch." / „So suche ich für euch."
(`reviewOpen`); subtitle „Erzählt mir, was euch wichtig ist. Ich kümmere mich um die Suche.";
entry buttons „Mit Scout sprechen" and „Lieber schreiben"; after facts exist „Suchauftrag ansehen";
always „Musik-Kontext aus ChatGPT oder Claude mitbringen".
Review card: „Scout losschicken" / „Scout startet …" while `working`; hint „Ich suche und frage im Rahmen
eures Auftrags selbstständig an. Eine verbindliche Zusage gebt nur ihr."; „Noch etwas ändern"
(clears `reviewOpen`, sets `textOpen`).
English leftovers in this branch: the three `starters` — "We need a permanent room for our band",
"We are open to sharing with a compatible band", "Help me work out what matters before we search"
(passed only while `paginatedMessages.results.length === 0`) — and the synthetic intro message,
"I have your saved music context. Tell me what kind of rehearsal situation you want now."
(when `memory.facts.length`) else "Tell me about your band and the room you need. I’ll turn the useful
details into a search you can review." (note the typographic apostrophe).

*Workspace branch* (`mode !== "discovery" && !voiceOpen`):
title „Eure Suche macht eine Pause." (`paused`) / „Eine kurze Rückfrage an euch." (`attention`) /
„Diese Räume könnten passen." (`results`) / „Ich kümmere mich darum." (`waiting`);
body „Euer Suchauftrag bleibt gespeichert. Macht weiter, wenn ihr bereit seid." /
`` `Ich behalte passende Räume in ${need.city || "eurer Gegend"} im Blick. Ihr könnt die App schließen.` `` /
„Hier findet ihr die aktuellen Treffer und Antworten zu eurem Suchauftrag." /
„Ein Detail ist noch offen. Sagt mir, was für euch passt."
Attention card (English): label "Open question", `<h2>{attention.uncertainties[0]}</h2>`, body
`attention.reasons[0] ?? "Scout needs your preference before proceeding."`, then **up to two buttons all
labelled "Discuss this with Scout"** (one per uncertainty — the labels are identical, only the sent
message differs: `About the current opportunity: ${question}`).
Result cards (English): meta `signal.verification` + `<n> source(s)`, `<h2>{signal.title}</h2>`,
`[district, city].join(", ")`, `€<priceEur> / <pricePeriod>`, first two `match.reasons`,
`signal.summary`, buttons "Ask Scout to inquire" and "Dismiss".
Waiting/paused (English): "Your search is paused. Resume it to refresh your matches." /
`` `No current matches for ${need.city || "this search"} yet.` ``; `<details>` summary "What Scout is
doing" with "Subscribed to live matches for this search", "Reading the current index…" /
`<n> current matches`, "Checking opportunities…" / `<n> open opportunities` (opportunities excluding
`dismissed`/`expired`).
Footer controls: „Mit Scout sprechen"; „Chat schließen" / „Nachricht schreiben"; „Aktualisieren"
(only while `need.status === "active"`); „Pausieren" / „Fortsetzen".
Not-ready state: „Dein Scout macht sich bereit …" and „Erneut versuchen" (see above).

---

### 1.7 `/app/search` — MySearchPage

`src/routes/musician/MySearchPage.tsx`. Tabs via `?tab=overview|sources|activity`.

| call | kind | args | feeds |
|---|---|---|---|
| `api.savedNeeds.listMine` | query | `{ limit: 10 }` | need resolution |
| `api.scout.getMine` | query | `{}` | need resolution |
| `api.matches.listMine` | query | `{ savedNeedId, limit: 30 }` | match cards + activity stream |
| `api.signals.list` | query | `{ city: need.city, limit: 50 }` / `"skip"` | source-tab counters (`indexedSignalCount`, max `sourceCount` = "evidence sources") |
| `api.searchSources.listForNeed` | query | `{ savedNeedId, limit: 100 }` | `SearchSourcesPanel` coverage rows + `disclosure` string |
| `api.mandates.getActiveMine` | query | `{ savedNeedId }` | `MandatePanel` |
| `api.savedNeeds.setStatus` | mutation | `{ needId, status }` | Pause/Resume |
| `api.matches.updateStatus` | mutation | `{ matchId, status: "saved"\|"dismissed"\|"seen" }` | card buttons |
| `api.searchSources.setPreference` | mutation | `{ savedNeedId, platformId, preference: "include"\|"exclude" }` | source toggles |
| `api.mandates.createDraft` → `api.mandates.activate` | mutations | see §3.4 | `MandatePanel.onSave` |
| `api.mandates.enableDefaultAutopilot` | mutation | `{ savedNeedId }` | `onStatusChange("active")` |
| `api.mandates.revoke` | mutation | `{ mandateId }` | `onStatusChange("paused")` |
| `api.mandates.killSwitch` | mutation | `{ savedNeedId }` | `onStatusChange("killed")` |

`api.searchSources.listForNeed` return shape (`convex/searchSources.ts:19-96`):

```
{ city: string,
  areaResolved: boolean,
  sources: [{ platformId, name, domain, platformStatus, supplyStatus?, demandStatus?,
              confidence, lastObservedAt?, preference }],
  disclosure: string }
```

- When the need's `city` does not resolve to a `geoAreas` row (`countryCode:"DE"`, normalized name) the
  query returns `{ city, areaResolved: false, sources: [], disclosure: "No reviewed source coverage has
  been mapped to this city yet." }`. Otherwise `disclosure` is the fixed string **"Coverage describes
  reviewed public sources RoomScout knows about; it is not a claim that the whole market is indexed."**
- `preference` is a **four**-value union `include | prefer | neutral | exclude` (default `neutral`), not
  the two values `setPreference` is called with. Platforms whose `status === "restricted"` are forced to
  `"exclude"` server-side, and `setPreference` throws `PLATFORM_NOT_AVAILABLE` for them — **the toggle
  can never be switched back on**. `setPreference` also accepts an optional `reason` (trimmed, 300 chars).
- `limit` is clamped 1..100 (default 50) and applied to each of the three underlying `take()`s; rows are
  sorted by `confidence` desc.

Coverage-row mapping (`sourceCoverage.sources[i]` → `SearchSourceCoverage`):
`side` = `supply && demand ? "both" : supply ? "supply" : "demand"` — **note the fallback: a row with
neither status is labelled `"demand"`**, which mislabels a coverage row with no observed side;
`status` = `platformStatus === "active" ? (supply/demand status is "verified"|"probed" ? "watching" : "partial") : (platformStatus is "candidate"|"reviewing" ? "under_review" : "unavailable")`;
`access` is hard-coded `"public"`; `included = preference !== "exclude"`;
`lastCheckedLabel = new Date(lastObservedAt).toLocaleString()` (omitted when absent);
note = `` `${[supplyStatus, demandStatus].filter(Boolean).join(" + ") || <fallback>} · ${Math.round(confidence*100)}% confidence` ``.
**The fallback differs per screen**: MySearchPage emits `"Coverage status unavailable"`,
SearchControlSettings emits `"Coverage unavailable"` — a divergence the port must resolve.
SearchControlSettings additionally appends a second sentence to the server disclosure:
`<disclosure> Signal totals are a bounded sample of up to 50 city results; evidence sources is the largest
source count attached to one result, not a market-wide total.` (and falls back to "Coverage is based on
reviewed sources." when `coverage` is missing).

**Synthetic draft mandate.** When `getActiveMine` returns `null`, MySearchPage does **not** hide
`MandatePanel` — it feeds it a fully-populated unsaved mandate:

```ts
{ mode: "negotiation", status: "draft", goal: need.title,
  sourceAllowlist: coverageSources.filter(s => s.included).map(s => s.domain),
  platformAllowlist: coverageSources.filter(s => s.included).map(s => s.id),
  allowedActionTypes: ["send_email","submit_webform","send_platform_dm",
                       "create_portal_account","publish_listing","propose_visit"],
  dataScopes: ["band_name","reply_email","availability","budget","music_profile"],
  dailyContactLimit: 10, dailyBrowserMinutes: 30,
  maxMonthlyPriceEur: need.maxBudgetEur,
  expiresAt: defaultMandateExpiry,          // useState(() => Date.now() + 30 d) — frozen at mount
  killSwitchEnabled: true,
  stopConditions: ["Search is paused", "A login or human-only step is required",
                   "A suitable room reaches agreement handoff"],
  persisted: false }
```

For a **persisted** mandate the same object is built from `activeMandate`, with
`status: "active"`, `killSwitchEnabled: true` (hard-coded),
`allowedActionTypes` mapped `propose_visit_time → propose_visit`, and
`stopConditions: [stopOnComplaint ? "A complaint is received" : "Complaint stop disabled",
stopWhenSuitableRoomConfirmed ? "A suitable room is confirmed" : "Confirmation stop disabled"]`.
`SearchControlSettings` (settings → autonomy) builds the identical objects with **one different string**:
`"A human-only step is required"` (without "A login or"). Resolve this in the port.

**Overview tab rendering** (English throughout):

- `PageHeader title="My search"`, meta = `Convex live query` pill + a Pause/Resume button
  (hidden while `need.status === "draft"`): "Updating…" while working, else "Resume" / "Pause".
- Tab bar (`role="tablist"`) renders the **lowercase tab ids** `overview | sources | activity`, with
  `` ` · ${indexedSignals.length}` `` appended to `sources` once the signal list has loaded.
- Left column: `SearchProfileCard` (fields from `savedNeedToSearch`, §3.9), a "Edit with Scout" link to
  `/app/scout?mode=search_discovery`, `MandatePanel`, and a static "Updates" card with the rows
  Channel / "In-app notifications", Cadence / "As matches and replies arrive", Decision point /
  "Agreements, bookings, or money".
- Right column: a "Current matches" card with `<n> live` and the sentence "Matches use structured
  constraints plus semantic compatibility. Unknown facts remain visible as uncertainty.", then the match
  cards.
- Match card: header `` `${match.signalSide} · ${match.status}` `` + `match.signalCity`;
  `<h2>` linking to `/signals/:signalId`; a `<ul>` of `match.reasons`;
  `Still unclear: <uncertainties joined " · ">`; footer `` `${Math.round(match.score * 100)}% match` ``
  + "Room signal" (`need_supply`) / "Potential band connection" (`demand_demand`);
  actions "Open detail" (a `Link` to `/signals/:id` that **also fires `updateStatus(matchId,"seen")`**),
  "Save" (`saved`), "Dismiss" (`dismissed`).
- Activity tab is **synthesised client-side** — header "Search activity" / "Persisted search + match
  events"; first row `Search updated — <need.title>` with the status pill, then one row per match,
  `New match` (status `new`) / `Match updated` — `<signalTitle>`, pill `<score>%`, timestamps via
  `Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short" })`. There is no dedicated
  activity/event feed query for the musician (see §7 gaps). **Because `matches.listMine` returns `[]`
  for a paused or draft need (§3.5), this tab collapses to the single "Search updated" row whenever the
  search is not active.**
- Loading / empty states: "Loading your search…" / "RoomScout is loading your saved criteria and current
  matches."; "No saved search yet" / "Talk to your Scout to turn your rehearsal-room needs into an
  editable search." + button "Start with your Scout"; "Search is still a draft" / "Finish and activate
  the draft with your Scout before RoomScout starts matching it."; "No matches yet" / "No indexed signal
  currently clears this search's match threshold. RoomScout will update this page when the index
  changes."; "Loading Scout mandate…" / "Loading the active version and authorization limits.";
  "Loading source coverage…" / "Loading reviewed source coverage and your saved source preferences."
- Error fallbacks rendered raw (see §0.2): "The search status could not be changed.", "The match could
  not be updated.", "The source preference could not be saved.", "The mandate could not be updated.",
  "The mandate could not be saved and activated." (`saveMandate` also re-throws so `MandatePanel` keeps
  the dialog open).

---

### 1.8 `/app/inbox` — MusicianInboxPage

`src/routes/musician/MusicianInboxPage.tsx`. Three panes: threads | conversation | context.

**Queries**

| call | args | feeds |
|---|---|---|
| `api.communications.listThreadsMine` | `{ limit: 50 }` | unified email + platform thread list |
| `api.mailboxes.getMine` | `{}` | "Scout mailbox" card (`emailAddress`, `status`) |
| `api.providerConversations.listMine` | `{ limit: 50 }` | context pane `ProviderOfferPanel` for the selected thread |
| `api.opportunities.listMine` | `{ limit: 20 }` | "Opportunities" handoff list |
| `api.externalActions.listMine` | `{ limit: 30 }` | web-form pseudo-threads + "External action ledger" |
| `api.inbox.listMailboxMessagesMine` | `{ limit: 10 }` | `MailboxVerificationPanel` (portal verification mails) |
| `api.inbox.getThreadMine` | `{ threadId, limit: 100 }` / `"skip"` | email conversation |
| `api.platformInbox.getThreadMine` | `{ threadId, messageLimit: 100 }` / `"skip"` | platform-DM conversation |

**Mutations / actions**

| call | kind | args |
|---|---|---|
| `api.opportunities.createHandoff` | mutation | `{ opportunityId, channel: "manual", summary }` |
| `api.opportunities.updateStatus` | mutation | `{ opportunityId, status: "converted" }` |
| `api.externalActions.decide` | mutation | `{ requestId, decision, expectedContentVersion, expectedContentHash, expectedPayload }` |
| `api.externalActions.confirmHumanCompleted` | mutation | `{ requestId, submitted }` |
| `api.inbox.updateMailboxMessageStatus` | mutation | `{ messageId, status: "read" \| "archived" }` |
| `api.firecrawlInteract.executeApproved` | action | `{ requestId }` |
| `api.firecrawlInteract.completeApprovedHumanStep` | action | `{ requestId, executionId, submitted }` |
| `api.browserbasePortal.executeApprovedWrite` | action | `{ requestId }` |
| `api.browserbasePortal.getApprovedWriteLiveView` | action | `{ executionId }` |
| `api.browserbasePortal.completeApprovedWriteHumanStep` | action | `{ requestId, executionId, submitted }` |

**Web-form pseudo-threads**: `actionRows` with `requestedActionType === "submit_webform"` and
`payload.kind === "contact_form"` are turned into `{ channel: "webform", threadId: action._id,
subject: field whose name contains "subject" || "Web-form outreach", status: action.status,
participants: [new URL(payload.targetUrl).hostname], lastMessageAt: action.updatedAt }` and merged
into the thread list, sorted by `lastMessageAt desc`.

**Channel filter** `all | needs_action | email | webform | platform_dm`; `needs_action` means
email `status ∈ {replied, failed}`, platform `status === "open"`, webform
`status ∈ {awaiting_approval, failed, executing}`. Changing the filter also clears `selectedThread`.

**Selection behaviour**: the stored selection is only honoured while it is still in the filtered list —
`effectiveThread = selectedStillVisible ? selectedThread : visibleThreads[0]`. So **the first thread is
auto-opened on load and again after every filter change**, and the conversation pane is never empty
while any thread matches. The context pane joins a provider conversation to the open thread by
`conversation.mailThreadId === thread.id` (email) or `conversation.platformThreadId === thread.id`
(platform); web-form threads never join one.

**Approval sheet mapping** (`ActionApprovalRequest`) per `payload.kind` — only rows with
`status === "awaiting_approval"` are eligible:
- `email_message` → destination `recipientEmail`, actingAs `mailbox?.emailAddress ?? "Personal Scout mailbox"`, fields Recipient/Subject/Body
- `contact_form` → destination `targetUrl`, fields = each `{ label ?? name, value }`
- `platform_message` → destination `recipients.join(", ") || "Existing platform thread"`, fields
  Recipients (`recipients.join(", ") || "Existing thread"` — a **different** fallback from the
  destination), optional Subject, Body
- `portal_account_operation` → destination `` `Portal connection ${connectionId}` ``, fields Operation /
  Account (`accountLabel ?? "No account label supplied"`)
- non-email payloads use `actingAs: "Connected portal identity"`; `effect` is
  `` `${operation} the selected portal account.` `` for `portal_account_operation`, else "Execute the
  exact displayed external action once."; `authorization` is hard-coded `{ mode: "approve_once" }`
  (the sheet never renders the standing-mandate branch from this page).

**Opportunity mapping** (`opportunityRows` → `Opportunity`, only the **first 3** are rendered):
`title` = "Room opportunity" (`supply_match`) / "Potential band collaboration" (`demand_collaboration`) /
"Source lead" (`source_lead`); `counterparty` = the literal
"Counterparty identity is not exposed by the opportunity API"; `confirmed` = `reasons`;
`unresolved` = `uncertainties`; `recommendedNextStep` = "The opportunity has been handed off for a human
decision." when `status === "converted"`, else "Review the evidence and unresolved facts before
preparing a human handoff."; `status` map `converted → handed_off`, `contacted → visit_proposed`, else
`qualified`.
`markHandedOff` sends `summary = [title, ...reasons, ...uncertainties.map(u => "Unresolved: " + u)].join("\n")`
— the server then **collapses all whitespace to single spaces and caps at 2000 chars** (§3.6), so the
newlines are lost — and immediately follows with `updateStatus({ status: "converted" })`.

`ActionLifecyclePanel` receives only `actionRows?.slice(0, 10)`.

**Execution routing**: `action.executor === "firecrawl"` → `firecrawlInteract.executeApproved`;
`"browserbase"` → `browserbasePortal.executeApprovedWrite`, and when it returns
`status === "human_required"` the page additionally fetches `getApprovedWriteLiveView({ executionId })`
and stores `{ liveViewUrl, liveViewExpiresAt }` in **ephemeral React state only** (never persisted).
Any other executor value — the ledger also allows **`agentmail`, `direct_api`, `manual`** (§3.8) —
falls through to `throw new Error("This action does not have a supported provider executor.")`, which is
then rendered via the generic fallback below.
Human completion routes by executor too: `browserbase`/`firecrawl` **with a remembered `executionId`**
call `completeApprovedWriteHumanStep` / `completeApprovedHumanStep`; otherwise
`externalActions.confirmHumanCompleted({ requestId, submitted })`.

**Copy** — the screen is bilingual.

German: „Nachrichten"; „Alle Gespräche zu eurer Suche. Dein Scout bleibt für euch dran."; „Gespräche";
empty thread list „Hier ist es noch ruhig. Sobald ein Gespräch beginnt, erscheint es hier.";
no-selection state „Platz für gute Nachrichten." / „Wähle links ein Gespräch. Hier findest du den Verlauf
und neue Antworten."; context card „Du hast das letzte Wort." / „Dein Scout kümmert sich um unverbindliche
Gespräche. Zusagen, Buchungen und Zahlungen bleiben bei dir."

English: channel labels "Email" / "Platform DM" / "Web form"; filter chips rendered as
`filter.replaceAll("_", " ")` → **"all", "needs action", "email", "webform", "platform dm"**;
"Loading your communication threads…"; per-row participants
`participants.join(", ")` or the literal **"participants not exposed"** — which is what **every email
row** shows, because `communications.listThreadsMine` always returns `participants: []` for email (§3.8);
"Loading conversation…" / "Fetching persisted messages from the selected channel."; conversation-head
badges "Live thread" (email) / "Synced thread" (platform) / "Persisted action" (web form);
message headers `` `You → ${to.join(", ")}` `` / `` `${from} → You` `` (+ ` · <deliveryStatus>`);
"Delivery update"; parsed-reply block "Scout · Parsed reply" + "AI interpretation · original stays above";
web-form rows `Prepared for <hostname>` and "Action state" (+ ` · <error>`);
conversation actions "Draft reply with Scout" / "Draft platform reply", "Ask Scout", "Update search",
"Review exact form"; platform empty "No messages in this thread" / "The platform thread exists, but no
persisted messages were returned."; context pane "Scout mailbox" with
`emailAddress ?? (status === "provisioning" ? "Provisioning…" : "Created on first outreach")` and the
status pill `status ?? "Not provisioned"`; `<details>` "Advanced activity" containing "Selected channel"
(rows Type / Storage → "AgentMail thread" | "Platform thread" | "External action ledger" | "—"),
"Account & verification mail", "External action ledger", and "Opportunities" ("Loading…" /
"No persisted opportunity is ready for handoff.").
Error fallbacks rendered raw (§0.2): "The handoff could not be persisted.", "The exact action decision
could not be persisted.", "The approved provider action could not be started.", "The human completion
state could not be saved.", "The mailbox message status could not be saved."

---

### 1.9 `/app/profile` and `/app/settings/:section?` — ProfilePage

`src/routes/musician/ProfilePage.tsx` (875 lines) + `SettingsFrame` (`src/components/settings/SettingsFrame.tsx`).
Sections: `sources | autonomy | knowledge | profile | notifications | usage | privacy`
(resolved from `useParams().section` → `?section=` → legacy `?tab=connections|memory` → default `sources`).

| call | kind | args | section |
|---|---|---|---|
| `api.users.current` | query | — | profile / knowledge |
| `api.memory.listMine` | query | `{}` | knowledge (facts, profile, events) |
| `api.mailboxes.getMine` | query | `{}` | sources (mailbox card) |
| `api.portalConnections.listMine` | query | `{}` | sources |
| `api.portalConnections.listConnectableSources` | query | `{ limit: 50 }` | sources ("add portal") |
| `api.memory.deleteFact` | mutation | `{ factId }` | knowledge, behind `ActionDialog` |
| `api.memory.refreshMyEmbeddings` | action | `{}` → `{ processed, configured }` | knowledge ("Build semantic index"; `configured:false` → "Set OPENAI_API_KEY …") |
| `api.memory.refreshMyContext` | action | `{}` → `{ rebuiltVersion? }` | knowledge ("Build working context now") |
| `api.mailboxes.ensureMine` | action | `{}` | sources |
| `api.portalConnections.requestConnection` | mutation | `{ sourceId, label }` | sources |
| `api.portalConnections.pauseMine` | mutation | `{ connectionId }` | sources |
| `api.browserbasePortal.startAuthentication` | action | `{ connectionId }` → `{ runId, status:"human_required" }` → `navigate('/app/runs/'+runId)` | sources |
| `api.browserbasePortal.startAgentRegistration` | action | `{ connectionId }` → `{ runId, status }` → navigate | sources |
| `api.browserbasePortal.syncInboxNow` | action | `{ connectionId }` | sources |
| `api.browserbasePortal.disableConnection` | action | `{ connectionId }` | sources, behind `ActionDialog` |

Sub-component `SearchControlSettings` (`src/components/settings/SearchControlSettings.tsx`) is rendered
for `sources` (view="sources") and `autonomy` (view="autonomy") and repeats the need resolution +
`api.searchSources.listForNeed` / `setPreference` / `api.signals.list` / `api.mandates.*` set from §1.7.

Portal status mapping (`portalUiStatus(status, policyDecision)`):
`disabled | policyDecision==="prohibited"` → `disabled`; `needs_auth` → `login_needed`;
`active` → `connected`; `reauth_required` → `reauth_required`; `paused` → `paused`; else `not_connected`.
`canAuthenticate` = policy allowed AND status ∈ {needs_auth, reauth_required, paused};
`canSync` = policy allowed AND status active AND `allowInboxPolling`.

Sections `notifications`, `usage`, `privacy` are **static copy** — no data. They deliberately state
that notification preferences and billing do not exist (pinned by `ProfilePage.test.tsx`).

**Portal view mapping** (`portalConnections.listMine[i]` → `PortalUiConnection`):
`name = platformName ?? sourceName`; `domain = new URL(baseUrl).hostname` (undefined when it throws);
`status = portalUiStatus(...)` (below); `policyReady = policyDecision === "allowed"`;
`scopes = ["Read-only research" if allowReadOnlyRecon, "Inbox sync" if allowInboxPolling]`;
`lastVerifiedLabel = new Date(lastSuccessAt).toLocaleString()`;
`identityLabel = label` **only when `label` differs from both `sourceName` and `platformName`**;
`note` = `` `Platform policy: ${policyDecision}.` `` when not allowed, else
`` `Last connection error: ${lastErrorCode}.` ``, else `` `Reviewed source: ${sourceName}.` `` when a
`platformName` exists, else undefined.
`listConnectableSources` rows whose `sourceId` already appears in `listMine` are filtered out, and the
rest map to `{ id: sourceId, name, domain: hostname ?? baseUrl, url: baseUrl, platformName }`.

**Rendered copy** (English):

- *sources*: `SearchControlSettings view="sources"` (§1.7 coverage panel) + `PortalConnectionsWorkspace`;
  disable dialog "Disable this portal connection?" / "This affects only the selected portal. Other
  connected sites keep their own Contexts." / body "RoomScout will stop using this portal and ask
  Browserbase to delete its persisted Context. This removes the reusable portal session; it does not
  delete the account on the third-party website." / "Keep connected" / "Disable & delete Context".
- *profile*: one card, header "Account" / "Private workspace", rows Display name (`displayName ?? "Not set"`),
  Username (`username ?? "Loading…"`), Role (`role ?? "Musician"`). **This section is read-only —
  nothing in the app ever writes `displayName`.**
- *notifications*: "In-app decisions stay visible" + "Matches, replies, approvals, and required handoffs
  appear in RoomScout as they arrive. User-configurable email, push, and browser notification preferences
  are not available yet; RoomScout will not claim permission or delivery it has not implemented." +
  link "Open inbox".
- *usage*: "Billing is not available" + "This workspace has no connected billing system, purchasable plan,
  or user-facing metering ledger. No prices, quotas, or usage totals are shown because RoomScout cannot
  currently verify them."
- *privacy*: "Storage boundaries" + "Reviewed memory facts, searches, approvals, and event metadata may be
  persisted in Convex. Raw context imports are analyzed but not stored. Raw voice audio, passwords, 2FA
  values, CAPTCHA answers, cookies, and ephemeral Live View URLs are not stored."; "Services involved" +
  "Convex stores application state. Firecrawl performs public-web discovery and monitoring. AgentMail
  handles approved email. Browserbase provides isolated portal contexts. OpenAI performs text reasoning,
  embeddings, and the approved realtime voice flow."
- *knowledge* (two columns). Button "Import music context"; after an import the status line
  `<n> reviewed fact(s) added. Your Scout is rebuilding its working context.`
  Left column: "Working context" card, meta `Version ${profile?.contextVersion ?? 0}` **or a spinner +
  "Learning" while `contextIsBuilding`** (see below); when `profile.summary` exists it renders the
  summary plus "Musical identity" / "Practical context" / "People + relationships", each falling back to
  "Not enough context yet."; otherwise the empty state "Your Scout is ready to learn" / "Tell the Scout
  about your project, or import context from an assistant that already knows your music life." plus, when
  `contextIsBuilding`, the button "Build working context now". Then, when any list is non-empty, three
  cards "Hard constraints" / "Soft preferences" / "Worth asking". Then "Fact memory" with
  `<n> active facts`, empty state "Nothing remembered yet" / "Facts you state or approve will appear here.
  Inferences stay visibly marked.", otherwise **entity cards grouped by `fact.subject`** (heading =
  subject, chip = `facts[0].subjectKind`) whose rows read `<predicate> · <category>` / **value**
  (+ ` → objectName`) / `<verification> · <source> · <n>% confidence` — all with `_`→space — and a
  delete button labelled `Forget <value>`.
  Right column: an "Account" / "Private workspace" card with rows Username (`displayName ?? username ??
  "Loading…"`), Role, "Raw import" / "Analyzed, never stored", "Autopilot" / "Non-binding outreach only ·
  commitments stay with you", "Semantic index" / `<ready> / <total> facts ready`; **the "Build semantic
  index" button is rendered only while some fact has `embeddingState !== "ready"`**, with the follow-ups
  "Set OPENAI_API_KEY in this Convex deployment first." (`configured: false`) and "Semantic memory is up
  to date." Then "Memory activity" — `memory.events` rows (time `HH:MM`, summary, `eventType` chip) or
  "The event ledger will show what changed and when."
  Forget dialog: "Forget this fact?" / "The original memory event remains in the audit trail." / body
  "RoomScout will stop using this fact and rebuild the working context without it." / "Keep it" /
  "Forget fact".

**Derived knowledge states**: `contextIsBuilding = profile && profile.contextVersion < profile.factVersion`
(spinner + "Learning" instead of the version, and the retry button); `groupedFacts` = facts reduced into
`Record<subject, fact[]>`.

Error fallbacks rendered raw (§0.2): "The secure portal session could not be started.", "The controlled
portal registration could not be started.", "The portal connection could not be paused.", "The portal
inbox could not be synchronized.", "The portal connection could not be created.", "The RoomScout email
address could not be created." (also used for `ensureMine` returning `status:"failed"` without
`lastError`), "The portal connection could not be disabled."

---

### 1.10 `/app/runs/:runId` — BrowserRunPage

`src/routes/musician/BrowserRunPage.tsx` + `BrowserRunWorkspace` + `PortalAuthenticationGuide`.

| call | kind | args |
|---|---|---|
| `api.portalConnections.getRunMine` | query | `{ runId }` / `"skip"` |
| `api.portalConnections.getMine` | query | `{ connectionId: storedRun.connectionId }` / `"skip"` |
| `api.mailboxes.getMine` | query | `{}` |
| `api.browserbasePortal.getLiveView` | action | `{ runId }` → `{ url, expiresAt }` (ephemeral, React state only) |
| `api.browserbasePortal.resumeAuthentication` | action | `{ runId }` → `{ status:"completed" }` (only after the user ticks "signed in") |
| `api.browserbasePortal.stopRun` | action | `{ runId }` |
| `api.browserbasePortal.startAuthentication` / `startAgentRegistration` | actions | `{ connectionId }` (retry → navigate to the new runId) |
| `api.mailboxes.ensureMine` | action | `{}` |

Run → UI state: `liveView && status==="human_required"` → `human_controlling`; `running` → `agent_running`;
`expired` → `failed`; otherwise the raw `storedRun.status`.

`BrowserRun` view object (built only when **both** `storedRun` and `connection` have resolved):

- `sourceName = connection.platformName ?? connection.sourceName`, `sourceDomain = new URL(baseUrl).hostname`
- `searchTitle` by kind: `authenticate` → **"Scout-assisted portal registration"** when
  `onboardingStage` is set, else **"Connect portal account"**; `inbox_sync` → **"Sync portal inbox"**;
  anything else → **"Review portal source"**
- `mandateLabel: "Policy-reviewed portal run"` (constant)
- `humanPrompt` (only while `status === "human_required"`): "The controlled automation stopped before an
  ambiguous or human-only step. Open Live View to review it; RoomScout will not accept terms, solve
  CAPTCHA, or guess a code."

Two step sets, verbatim labels and conditions:

*Agent registration* (`onboardingStage` present):
| id | label | state |
|---|---|---|
| `reserved` | "Open isolated Browserbase Context" | `status === "queued" ? active : done` |
| `signup` | "Register with personal AgentMail address" | `onboardingStage === "opening_signup" ? active : done` |
| `mail` | "Receive and parse Clerk verification mail" | `waiting_verification → active`, `opening_signup → pending`, `status === "failed" → blocked`, else `done` |
| `verify` | "Inject code and persist authenticated session" | `submitting_verification → active`, `completed → done`, `human_required`/`failed` → `blocked`, else `pending` |

*Manual authentication* (no `onboardingStage`):
| id | label | state |
|---|---|---|
| `reserved` | "Session reserved" | `queued ? active : done` |
| `human` | "Human authentication" | `human_required → active`, `completed → done`, else `pending` |
| `persist` | "Persist authenticated Browserbase context" | `completed → done`, `failed → blocked`, else `pending` |

`PortalAuthenticationGuide` is rendered **only** when
`storedRun.kind === "authenticate" && connection && (!storedRun.onboardingStage || storedRun.status === "human_required")`.
`returnControl()` is a no-op unless the user has ticked "signed in" (`signedInConfirmed`).

**Copy**: "Loading persisted browser run…"; `Requested run: <runId | "none">`; footer link
"Back to connections" → the **legacy** URL `/app/profile?tab=connections` (which §1.9 resolves to the
`sources` section). Error fallbacks rendered raw: "Live View is not available.", "The authenticated
context could not be finalized.", "The browser run could not be stopped.", "The browser run could not be
restarted.", "The RoomScout registration address could not be created."

---

### 1.11 `/ops/*` — operator cockpit

All wrapped in `RequireAuth` + `RequireOperator`; all use `<WorkspaceShell mode="ops">`.

**`/ops` — OpsOverviewPage** (`src/routes/ops/OpsOverviewPage.tsx`)
- `useQuery(api.ops.overview)` → `{ boundedSample, metrics: { publishedSignals, staleSignals, detailBacklog, detailFailures, awaitingApproval, repliedThreads, unhealthySources, activeVoiceSessions, activeMailboxes }, activity: [...] }`
- `usePaginatedQuery(api.sourceIntelligence.listPlatforms, {}, {initialNumItems:50})`
- `usePaginatedQuery(api.sourceIntelligence.listCandidates, { status: "new" }, {initialNumItems:50})`
- `useQuery(api.portalConnections.listMine, {})`
- `useAction(api.opsActions.providerReadiness)({})` in an effect + manual refresh; result type read via
  `FunctionReturnType<typeof api.opsActions.providerReadiness>` → `{ overallStatus, configuredProviders, serverProviderCount, firecrawl{…}, agentmail{…}, browserbase{…}, mapbox{…} }`, rendered by `ProviderReadinessPanel`.

**`/ops/signals` — OpsSignalsPage**: `useQuery(api.ops.listSignalQueue, { state: filter, limit: 50 })`
(filters `all|failed|queued|fetching|processed|none`) + `useMutation(api.sourceRegistry.retrySourceEntry)({ sourceEntryId })`.

**`/ops/sources` — OpsSourcesPage**: `useQuery(api.ops.listSources, { limit: 40 })`;
mutations `sourceRegistry.seedReviewSources({})`, `reviewSource({ sourceId, decision, policyNotes })`,
`setSourceActive({ sourceId, active })`, `syncMonitors({})`, `continueBacklog({})`;
action `opsActions.runMonitorNow({ sourceTargetId })`.
Embeds `SourceIntelligencePanel` (platforms/candidates/policies/adapters/probe runs — `sourceIntelligence.*`,
`sourcePolicies.*`, `sourceAdapters.*`, `sourceProbes.listRuns`, `sourceDiscoveryActions.runGermanySlice`)
and `PortalOperationsPanel` (`portalConnections.listMine|listRunsMine|pauseMine` + the whole
`browserbasePortal.*` action set).

**`/ops/outreach`**: `useQuery(api.ops.listOutreach, { status?, limit: 50 })` — masked recipient/sender,
content hash prefix, delivery status. Read-only; operators cannot approve.

**`/ops/inbox`**: `useQuery(api.ops.listInboxRouting, { limit: 30 })`; plus the platform side:
`portalConnections.listMine` → `platformInbox.listThreadsMine({ connectionId, limit: 40 })` →
`platformInbox.getThreadMine({ threadId, messageLimit: 60 })`; action `browserbasePortal.syncInboxNow({ connectionId })`.

**`/ops/audit`**: `useQuery(api.ops.listAudit, { limit: 60 })` → `[{ id, kind: "approval"|"action"|"provider"|"voice", title, detail, status, at }]`;
plus `portalConnections.listMine` → `listRunsMine({ connectionId })`.

---

## 2. Shared surfaces

### 2.1 WorkspaceShell — `src/components/navigation/WorkspaceShell.tsx`

`mode: "musician" | "ops"`. **This is not one shell parameterised by `mode` — it is two completely
different layouts**, and the musician branch returns early (`if (!isOps) return …`) before the sidebar
markup is ever reached.

| call | args | feeds |
|---|---|---|
| `api.users.current` | — | initials, display name, „Betreiberansicht" (musician) / "Switch to Ops" (ops branch, dead code) when `role === "operator"` |
| `api.ops.navCounts` | `{}` when ops, else `"skip"` | ops badges `{ signalReview, outreach, inbox }` |
| `api.inbox.listThreadsMine` | `{ limit: 50 }` when musician | Nachrichten badge = threads with `status === "replied"` |
| `api.matches.listMine` | `{ status: "new", limit: 50 }` when musician | „Euer Suchauftrag" badge |
| `api.outreach.listMine` | `{ status: "awaiting_approval", limit: 50 }` when musician | „Scout" badge |

`useAuthActions().signOut()` then `navigate("/", { replace: true })`.
`displayName = currentUser?.displayName ?? currentUser?.username ?? "Dein Konto"`;
`initials = displayName.split(/[\s_-]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase()`.

**`mode: "musician"` — a consumer header, no sidebar, no mobile tab bar**:

```
<div class="rs-consumer-workspace[ rs-consumer-workspace--scout]">   // modifier only on /app/scout
  <header class="rs-consumer-header">
    <Link class="rs-consumer-wordmark" to="/app/scout" aria-label="RoomScout home">roomscout</Link>
    <details class="rs-account-menu" key={location.pathname}>        // keyed on the path → closes on navigation
      <summary aria-label="Profilmenü"><span>{initials}</span></summary>
      <nav aria-label="RoomScout und Konto" class="rs-account-menu__panel">
        <div class="rs-account-menu__identity"><strong>{displayName}</strong><span>Dein persönlicher Scout</span></div>
        … the four nav items … + Karte + <hr/> + Einstellungen [+ Betreiberansicht] + Abmelden
      </nav>
    </details>
  </header>
  <main class="rs-consumer-main">{children}</main>
</div>
```

Musician nav items (with badge counts): „Scout" `/app/scout` (`approvalDrafts?.length`),
„Anzeigen entdecken" `/app/explore`, „Euer Suchauftrag" `/app/search` (`newMatches?.length`),
„Nachrichten" `/app/inbox` (replied threads). Then „Karte" `/app/map`, a rule, „Einstellungen"
`/app/settings/sources`, „Betreiberansicht" `/ops` (operators only), „Abmelden".
The lowercase wordmark „roomscout" is literal.

**`mode: "ops"` — the sidebar layout** (`.shell.rs-workspace.rs-workspace--ops`): brand
`roomscout ops`, `<nav class="nav" aria-label="Operations">` with **Overview** `/ops`,
**Signals** `/ops/signals` (`navCounts.signalReview`), **Sources** `/ops/sources`, **Outreach**
`/ops/outreach` (`navCounts.outreach`), **Inbox** `/ops/inbox` (`navCounts.inbox`); a spacer, an `<hr>`,
then an "Account" nav with **"Audit log"** `/ops/audit`, **"Switch to RoomScout"** `/app/scout`, and an
identity span `displayName ?? username ?? "Operator"`. Below `<main>` sits
`<nav class="rs-mobile-tabs" aria-label="Mobile workspace navigation">` rendering `items.slice(0, 4)`
(Overview, Signals, Sources, Outreach).

⚠ The sidebar's musician sub-branch — a "Profile" link to `/app/profile`, "Switch to Ops", and a
"Sign out" button — is **unreachable dead code**, because `mode:"musician"` never reaches it. Do not
port it as a musician affordance.

### 2.2 ContextImportDialog — `src/components/memory/ContextImportDialog.tsx`

- `useAction(api.memory.parseContextImport)({ text })` → `{ summary, facts: FactCandidate[] }`.
  Raw text is **never stored**; the action is rate-limited (`contextImport` 3/h).
- `useMutation(api.memory.importFacts)({ batchId: crypto.randomUUID(), facts: selected })` →
  `{ imported, duplicateBatch }`.
- `FactCandidate` = `{ subject, subjectKind, predicate, value, objectName?, objectKind?, category,
  confidence, sensitivity, relevance }`; facts with `sensitivity === "sensitive"` start **unchecked**.
- Prompt text to copy: `MUSIC_CONTEXT_IMPORT_PROMPT` in `src/features/memory/contextImportPrompt.ts`.

**Flow**: two phases derived from state, `phase = facts.length > 0 ? "review" : "collect"`.
In `collect` the single footer button "Analyze for review" is disabled until the pasted text has
**≥ 20 trimmed characters** (and `analyze()` returns early below that). In `review` the footer is
"Back" (clears `facts` + `selected`, returning to `collect`) and `Remember <n> fact(s)`, disabled at
zero selection. The copy-prompt button flips to "Copied" for **1800 ms**. A successful import calls
`onImported(result.imported)`, clears everything and closes the dialog.
Errors go through a local `errorMessage()` that **strips the `ConvexError:` prefix**
(`error.message.replace(/^.*?ConvexError:\s*/, "")`) and falls back to
"The context could not be processed. Please try again."

**Copy** (English): title "Import your music context"; description "Bring useful context. Keep control."
(collect) / `<n> of <m> facts selected` (review);
"01 · Ask your current assistant" + "Copy this prompt into ChatGPT, Claude, or another assistant that
already knows your music life." + "Copy prompt" / "Copied";
"02 · Paste the result here" + "RoomScout extracts candidates with the AI Gateway. Nothing is stored
until you review and confirm it." + sr-only label "External assistant context" + placeholder
"Paste your music context export…";
review header "Scout readout" + `<n> candidates across <m> entities · no raw export stored`;
each candidate row shows subject, a `category` chip, a `sensitivity` pill when not `normal`, the value
and `relevance`.

### 2.3 ApprovalComposer — `src/components/outreach/ApprovalComposer.tsx`

Manual email review path (fallback when autopilot cannot act).

- `api.outreach.listMine({ limit: 50 })` to find a draft by `signalId + savedNeedId` and status
  `drafted|awaiting_approval|approved`; `api.outreach.getMine({ draftId })` → `{ draft, approval? }`;
  `api.mailboxes.getMine` for the "From" line.
- Staircase on the single primary button. `handleApprove()` branches in this order, and each branch that
  **returns early** also clears the acknowledgement and sets a status message:
  1. `subject !== draft.subject || message !== draft.body` → `outreach.updateDraft({ draftId, recipientName, recipientEmail, subject, body })`, then `setApproved(false)` and the status message *"Changes saved. Review the refreshed version, then approve it."*
  2. `draft.status === "drafted"` → `outreach.submitForApproval({ draftId })`, then `setApproved(false)` and *"The exact message is ready. Confirm it once more to approve and send."*
  3. `draft.status === "awaiting_approval"` → `outreach.decide({ draftId, decision:"approved", expectedContentVersion, expectedContentHash, expectedRecipientEmail, expectedSubject, expectedBody })` **then** `outreach.sendApproved({ draftId })`
  4. `draft.status === "approved"` → `outreach.sendApproved({ draftId })`
  5. any other status → `throw new Error("This draft cannot be sent while it is <status with _→space>.")`
  On success (3/4) it calls `onApprove({ recipient, subject, message })` from the **persisted** draft and
  closes the dialog. Any throw lands in `flowMessage` as `error.message`, else "The draft could not be
  approved."
- **Button labels** (the same button, driven by `liveDraft.draft.status`): "Working…" while busy;
  `drafted` → **"Lock exact version for review"**; `awaiting_approval` → **"Approve & send once"**;
  `approved` → **"Send approved message"**; no draft → **"Approve exact message"**. Disabled while
  `!approved || working || !liveDraft`.
- ⚠ **The acknowledgement checkbox is required, but it is NOT reset by content changes.** `approved` is
  cleared only (a) after a save round-trip, (b) after `submitForApproval`, and (c) when the dialog closes
  (`handleOpenChange(false)`, which also drops the subject/message overrides and the status message).
  Typing in Subject or Message leaves the box ticked; the edit is caught only because the next click
  takes branch 1 instead of branch 3. Reproduce this behaviour exactly or change it deliberately — the
  test suite pins the staircase.
- **Copy**: dialog title "Manual send review"; description
  `` `Linked to “${search.title}” and “${signal.title}”` `` + `` ` · version ${contentVersion}` `` when a
  draft exists (typographic quotes); "From" → `mailbox?.emailAddress ?? "Your AgentMail inbox is being
  prepared"`; "To" → `<recipientName> <recipientEmail>` or "Waiting for the persisted draft and
  recipient…"; "Subject"; "Message" + the note "This fallback lets you review wording when a source is
  not covered by Autopilot."; the acknowledgement "I approve this exact recipient, subject, and message.
  RoomScout may send this version once."; "Cancel"; and the no-draft guard message "The Scout has not
  produced a sendable draft with a recipient yet."

### 2.4 ProviderOfferPanel + OfferAcceptanceFlow

`src/components/opportunities/ProviderOfferPanel.tsx`, `src/components/opportunities/OfferAcceptanceDialog.tsx`

- Input is one row of `api.providerConversations.listMine` (`FunctionReturnType<…>[number]`).
- Acceptance is only offered when `offer.current && offer.ready && conversation.platformThreadId &&
  acceptanceStatus ∉ {approved, executing} && !acceptedOfferId`.
- `OfferAcceptanceFlow`:
  `useMutation(api.offerAcceptance.prepare)({ offerId, expectedOfferHash })` → `requestId`
  → `useQuery(api.offerAcceptance.getMine, { requestId })` → descriptor
  → `useMutation(api.offerAcceptance.approveAndSend)({ requestId, offerId, expectedOfferHash,
     expectedContentVersion, expectedContentHash, expectedContextHash, acknowledged: true })`.
- Acknowledgement is keyed to a snapshot `${requestId}:${contentVersion}:${contentHash}:${reviewContextHash}`
  and cleared whenever any of them changes; errors `OFFER_CHANGED`, `ACCEPTANCE_CONTENT_CHANGED`,
  `EXPIRED` get explicit "Nothing was sent." copy.

**`OfferAcceptanceDescriptor`** (what `api.offerAcceptance.getMine` returns and the dialog renders):

```ts
{ requestId: Id<"actionRequests">, offerId: Id<"offerRevisions">, offerHash, offerRevision,
  contentVersion, contentHash, reviewContextHash, status, current: boolean, expiresAt,
  destination, actingAs, subject, body,
  assessment: { summary,
                monthlyPrice: { totalEur: number | null, allRecurringCostsKnown: boolean },
                terms: { key, label, value }[] } }
```

**Dialog gating**: `openedAt` is frozen at mount (`useState(() => Date.now())`);
`expiredAtOpen = expiresAt <= openedAt`; `alreadySent = status === "executed"`;
`pending = status ∈ {approved, executing}`; `failed = status === "failed"`;
`reviewable = current && status === "awaiting_approval" && !expiredAtOpen`. The checkbox is disabled
unless `reviewable`, and the primary button needs `acknowledged && reviewable && !working`.
A failed submit clears the acknowledgement and stores the message **against the snapshot key**, so it
disappears the moment the descriptor changes.

**Copy**: title "Review offer acceptance"; description
`` `Offer revision ${offerRevision} · exact-once platform message` `` or "Preparing an exact acceptance
for review"; states "Preparing the exact acceptance…", "This acceptance request is unavailable. Nothing
was sent.", "This review is stale because the offer, search, or conversation changed. Nothing was sent.",
"This approval request expired. Nothing was sent.", "The acceptance failed and is not confirmed sent.
This exact request cannot be approved again.", "Acceptance approved. Delivery is still being checked;
this does not yet confirm it was sent.", "Acceptance sent."; section "Offer being accepted" with
"Monthly total" → `"Not confirmed"` / `€<n>` + " · " + "All recurring costs stated" / "Additional costs
may be unresolved"; rows "Sending as", "Destination", "Subject" (`subject || "(No subject)"`),
"Exact message"; the note "Controlled roomscout.dev platform message only. This does not sign an
agreement, book a room, or make a payment."; acknowledgement "I reviewed these exact terms, sender,
destination, subject, and message. RoomScout may send this acceptance once."; buttons "Cancel" and
"Approve and send acceptance" / "Approving…".
`errorMessage()` maps `OFFER_CHANGED` / `ACCEPTANCE_CONTENT_CHANGED` → "The offer or acceptance message
changed. Nothing was sent. Close this review and start again from the current offer.", `EXPIRED` →
"This approval request expired. Nothing was sent.", else `error.message` or the caller's fallback
("The acceptance could not be prepared. Nothing was sent." / "The acceptance could not be approved.
Nothing was sent.").

**`ProviderOfferPanel` rendered states** (the raw material for the prototype's `offer` stage):

- No offer at all → `<h2>Scout assessment</h2>` + "Your Scout is reviewing the provider's message against
  your search.", or **"The provider update could not be assessed yet. No reply has been sent."** when
  `conversation.errorCode` is set.
- Header status word: `Revision <n> · ` + "Accepted offer" (`acceptedOfferId === offerId && acceptedAt`) /
  "Needs reassessment" (`!offer.current`) / "Ready for review" (`offer.ready`) / "Open questions".
- Stale notice: "This assessment is out of date because the conversation, listing or your search changed."
- `<dl>`: "Availability" → `assessment.availability.status`; "Monthly total" →
  `"Not confirmed"` / `€<n>` + " · " + "All recurring costs stated" / "Additional costs may be
  unresolved"; then one row per `assessment.terms`.
- "Still to resolve" — `offer.blockers` (hidden once accepted).
- The suggested reply sits behind a `<details>` whose summary is the **replyStatus label**:
  `executed` → "Reply · sent"; `executing` → "Reply · delivery being checked"; `queued` → "Reply ·
  checking final text"; `approved` → "Reply · authorized, awaiting delivery"; `awaiting_approval` →
  "Reply · needs your review"; `failed` → "Reply · failed; not confirmed sent"; anything else (including
  `undefined`) → **"Suggested reply · not sent"**.
- "Evidence behind this assessment" — constraints (`<verdict> · <explanation>` + quoted evidence) and the
  availability evidence quotes.
- Acceptance notices: "Acceptance sent · search paused. This does not confirm a booking, signature, or
  payment." / "Acceptance approved. Delivery is still being checked; it is not yet confirmed sent." /
  "Acceptance failed and is not confirmed sent."
- Button "Review acceptance" (only when `offer.current && offer.ready && platformThreadId &&
  !acceptancePending && !acceptanceSent`), and the standing footer "An assessment is not a booking or
  acceptance. Any final commitment needs your exact approval."

### 2.5 ActionApprovalSheet / ActionLifecyclePanel / MailboxVerificationPanel

`src/components/actions/*` — pure presentational; data comes from `api.externalActions.listMine`
and `api.inbox.listMailboxMessagesMine` (see §1.8). `ActionLifecycleItem` is
`Pick<Doc<"actionRequests">, "_id"|"requestedActionType"|"payload"|"status"|"error"|"updatedAt"> &
{ executor?, execution? }`. Live-View URLs live only in `EphemeralActionExecution` React state.

### 2.6 MandatePanel — `src/components/mandate/MandatePanel.tsx`

Props `{ mandate: ScoutMandate, platformOptions?: {id,label}[], onSave?, onStatusChange? }`.
See §3.4 for the UI↔backend mandate translation, and `src/features/agentOperations/mandatePolicy.ts`
for `canMandateAuthorize` / `mandateRequiresExactApproval` / `hardHumanActionTypes`.

**On/off condition** (not the mandate's `status` alone):

```ts
autopilotOn = mandate.persisted && Boolean(mandate.version) && mandate.status === "active"
              && mandate.killSwitchEnabled && mandate.mode !== "guided" && mandate.mode !== "research";
```

**The editor is a two-option radiogroup, not a four-mode picker.** "Autopilot" writes
`mode: "negotiation"` and back-fills empty fields (`platformAllowlist` ← all `platformOptions`,
`allowedActionTypes` ← `[send_email, submit_webform, send_platform_dm, create_portal_account,
publish_listing, propose_visit]`, `dataScopes` ← `[band_name, reply_email, availability, budget,
music_profile]`, `dailyContactLimit || 10`, `dailyBrowserMinutes || 30`). "Review every action" writes
`mode: "guided", allowedActionTypes: []`. `research` / `outreach` appear only when **reading** an
existing mandate. `draftAutopilotOn = draft.mode !== "guided"` gates every advanced input.

**Card copy**: "Scout Autopilot" + pill "On"/"Off"; "RoomScout is working for you" / "Put your room
search on Autopilot"; body "The Scout can research, contact suitable leads, and continue non-binding
conversations within your limits." / "Let the Scout research, contact suitable leads, and follow up
without asking about every message."; buttons "Turn off" / "Turn on Autopilot" ("Starting…" while
saving) and "Advanced"; the boundary line "You stay in control of the consequential decision:
agreements, bookings, contracts, and money always come back to you."; when on, a summary strip
`<n> platforms · <n> contacts/day · active until <YYYY-MM-DD>`.

**Dialog copy**: title "Autopilot settings", description "Autopilot is the default. Switch to manual
review or tune its exact limits here."; the two radio options "Autopilot" / "Research, outreach, and
non-binding follow-up happen automatically." and "Review every action" / "The Scout prepares work but
waits before every external action."; boundary "Autopilot covers only non-binding actions on reviewed
sources. Any commitment, payment, credential, 2FA, or CAPTCHA stops for you."; `<details>` "Advanced
controls" with sections "Goal", "Public research scope" (`sourceAllowlist.join(", ")` or "Reviewed
sources for this search"), "Platform allowlist" (or "Active reviewed platforms are added automatically
when Autopilot starts."), "Allowed non-binding actions", "Personal data scopes" (labels are
`scope.replaceAll("_"," ")`), the four limit inputs "Contacts / day", "Browser min / day",
"Max monthly price €", "Expires", then "Stop conditions" and "Always human"; "Emergency stop" (only
while `mandate.status === "active"`); footer "Cancel" and "Save settings"/"Saving…"; closing note
"Saving creates a new immutable mandate version. Existing provider gates re-check that version
immediately before execution." or, without `onSave`, "Autopilot persistence is unavailable. Manual
review remains enforced."; error fallbacks "The Autopilot settings could not be saved." and
"Autopilot could not be updated."

**`actionLabels`** — the full 18-entry dictionary the permission list renders:
`browse_public` "Browse public sources", `browse_connected` "Browse connected portals",
`read_messages` "Read connected messages", `extract_facts` "Extract and compare facts",
`send_email` "Send email", `submit_webform` "Submit web form", `send_platform_dm` "Send platform
message", `create_portal_account` "Create a portal account", `publish_listing` "Publish a search
listing", `share_contact_details` "Share contact details", `propose_visit` "Propose a visit time",
`accept_terms` "Accept terms", `accept_contract` "Accept or sign a contract", `confirm_booking`
"Confirm a booking", `make_payment` "Make a payment", `pay_deposit` "Pay a deposit", `enter_password`
"Enter a password", `complete_2fa` "Complete two-factor authentication", `solve_captcha` "Solve a
CAPTCHA".
`configurableActions` (the checkbox list) = the seven writable ones incl. `share_contact_details`;
`hardHumanActionTypes` (the "Always human" list) = the last eight.

### 2.7 SearchSourcesPanel / CoverageTrustNotice

`src/components/search/SearchSourcesPanel.tsx` — props `{ city, sources: SearchSourceCoverage[],
indexedSignalCount, indexedSourceCount, disclosure?, onScopeChange?, onConnect?, workingSourceId? }`.

⚠ **Two of these are effectively dead today.** `SearchSourceCoverage.status` has a fifth value
`connection_required` (`src/features/agentOperations/types.ts:4`) which renders the `onConnect`
"Connect" branch — but **neither mapper can produce it** (MySearchPage `coverageSources` and
SearchControlSettings `sources` both emit only `watching | partial | under_review | unavailable`), so
`onConnect` is never called. `signalCount` is likewise never set by either mapper, so **every row's
footer reads "0 relevant signals"**. Decide in the port whether to wire or drop them.

- Derived counters: `watching` = rows with `status === "watching"`, `gaps` = all other rows.
- The include/exclude button is disabled when `!onScopeChange`, `status === "unavailable"`, or this row
  is `workingSourceId`.
- Status labels: `watching` "Watching", `partial` "Partial coverage", `connection_required` "Connection
  required", `under_review` "Under review", `unavailable` "Unavailable".
- **Copy**: `CoverageTrustNotice` on top; header `Coverage for <city | "this search">` + "Live index
  evidence"; four metrics `<indexedSignalCount>` "observed signals", `<indexedSourceCount>` "evidence
  sources", `<watching>` "watching this search", `<gaps>` "known gaps"; the hint "Source inclusion is a
  search preference. Global monitoring, policy review, and extraction health remain operator-controlled.";
  then the `disclosure` string when given. Empty state "Source-level coverage is not available yet" /
  "RoomScout has indexed market evidence for this search, but no user-visible source coverage records are
  available yet. It will not invent a source list from aggregate counts." Per row: the domain as an
  external link, `source.note ?? "<side> · <access> access"`, the footer
  `source.lastCheckedLabel ?? "No successful check recorded"` + `<signalCount ?? 0> relevant signals`,
  and the toggle "Saving…" / "Included" / "Excluded" (plus "Connect" in the dead branch).

### 2.8 SignalCard / SignalBadge / ScoutFactList / ScoutConversation / ScoutBrief / ScoutBlob

Presentational. `ScoutFactList` animates a *changed* fact in place, keyed by `fact.key` (this is the
prototype's "fact card" behaviour and is already implemented — see `ScoutFactList.test.tsx`).
`ScoutConversation` renders `**bold**` from the assistant only (`renderScoutFormatting`).

**`ScoutFactList({ facts, expanded = false, heading = "Euer Suchauftrag" })`** — the exact animation
contract (a `useLayoutEffect` over `[data-fact-key]` rows, comparing against the previous
`{ top, value }` map):

| case | animation |
|---|---|
| row is new | `[{opacity:0, transform:"translate(-65px, 14px) scale(.94)", filter:"blur(3px)"}, {opacity:1, transform:"none", filter:"blur(0)"}]`, **650 ms**, `cubic-bezier(.22,1,.36,1)` |
| `value` changed | background flash `rgba(255,105,38,.26)` → `transparent`, **1100 ms** (no easing given) |
| row moved (`Math.abs(before.top - top) > 1`) | FLIP `translateY(before.top - top)` → `none`, **650 ms**, `cubic-bezier(.22,1,.36,1)` |

All three are skipped under `prefers-reduced-motion: reduce` or when `row.animate` is unavailable.
Rows carry `data-fact-key={fact.key}` and `data-fact-value={fact.value}`; the `<dl>` is
`aria-live="polite" aria-relevant="additions text"`; the `<section>` gets `aria-label={heading}`.
Copy: default heading „Euer Suchauftrag", **overridden to „Eure Wünsche" on the voice stage**
(`RealtimeVoiceScout`); empty state „Was euch wichtig ist, sammelt sich hier – während wir sprechen."
(note the en dash).

**`ScoutBrief({ facts, title = "Your search brief", openInitially = false })`** — a collapsible toggle
labelled `` `${facts.length} search facts` `` when facts exist, else the `title`; the open card repeats
`title` as its eyebrow and shows the same `dt`/`dd` pairs, or "Tell Scout what matters and your brief
will form here."

**`ScoutConversation`** — busy bubble "Scout is thinking…"; input placeholder "Tell Scout what
matters…"; sr-only label "Message your Room Scout"; aria labels "Talk to Scout" (mic) and "Send message";
starter chips are rendered only when `starters.length`; **`onSend` returning `false` keeps the draft in
the input** (`if ((await send(message)) !== false) setDraft("")`), and `send()` is a no-op while `busy`.

### 2.9 PortalConnectionsWorkspace / PortalAuthenticationGuide / BrowserRunWorkspace

Presentational; fed from §1.9 / §1.10.

### 2.10 SettingsFrame

`SettingsSection = "sources" | "autonomy" | "knowledge" | "profile" | "notifications" | "usage" | "privacy"`.
This is the surface the prototype re-implements as shadcn `sidebar-13` (sidebar inside a dialog).
`SettingsFrame({ children, section, onSectionChange })` renders a `<nav aria-label="Settings">` with the
heading **"Settings"**, two labelled groups, and a content column whose `<header>` is an `<h1>` +
description pair.

**Sidebar groups and items** (label + lucide icon):

| group | id | sidebar label | icon |
|---|---|---|---|
| **Scout** | `sources` | Sources & access | `Database` |
| | `autonomy` | Autonomy | `SlidersHorizontal` |
| | `knowledge` | **What Scout knows** | `Brain` |
| **Account** | `profile` | **Profile** | `UserRound` |
| | `notifications` | Notifications | `Bell` |
| | `usage` | Plan & usage | `CreditCard` |
| | `privacy` | Privacy | `Shield` |

**Per-section header pair `[H1, description]`** — note that the H1 differs from the sidebar label for
`knowledge` and `profile`:

| id | H1 | description |
|---|---|---|
| `sources` | Sources & access | Manage the private identities and reviewed portal access RoomScout may use for you. |
| `autonomy` | Autonomy | Review what your Scout may do, what still needs approval, and where it must stop. |
| `knowledge` | **What your Scout knows** | Inspect remembered facts and the working context used for your search. |
| `profile` | **Your profile** | The account identity attached to this private RoomScout workspace. |
| `notifications` | Notifications | See which product events can currently reach you. |
| `usage` | Plan & usage | Availability of billing and metered usage for this workspace. |
| `privacy` | Privacy | Understand what is stored, what is not, and which services perform product work. |

The active item carries `aria-current="page"`.

### 2.11 Voice — VoiceSessionProvider / RealtimeVoiceScout / useRealtimeVoiceScout

See §3.10 for the full session model.

### 2.12 UI primitives — `src/components/ui/*`

The four modules every screen above is assembled from. They matter directly for the shadcn port,
because **`ActionDialog` is already a Radix `@radix-ui/react-dialog` wrapper** — the migration is a
restyle, not a rewrite.

- **`ActionDialog({ open, onOpenChange, title, description?, children, footer? })`** —
  `Dialog.Root > Dialog.Portal > Dialog.Overlay(".overlay open rs-dialog-overlay") + Dialog.Content(".modal
  rs-dialog-content")`, whose `.modal-top` holds `Dialog.Title`, an optional `Dialog.Description`
  (class `mono`) and a `Dialog.Close` button with `aria-label="Close dialog"`; then `.modal-body`
  (children) and an optional `.modal-foot` (footer). Used by ApprovalComposer, OfferAcceptanceDialog,
  MandatePanel, ContextImportDialog, ExplorePage, SignalDetailPage and ProfilePage.
- **`LedgerCard({ children, className?, header?, footer?, accent? })`** →
  `<section class="lcard rs-ledger-card[ rs-ledger-card--accent][ className]">` with
  `.lcard-top` / `.lcard-body` / `.lcard-foot`.
- **`PageHeader({ title, meta?, eyebrow? })`** → `<header class="pagehead rs-page-header">` with an
  optional `.eyebrow`, an `<h1>`, and `.rs-page-header__meta`.
- **`EmptyState({ title, body })`** → `<div class="rs-empty-state"><h2>{title}</h2><p>{body}</p></div>`
  — every "Loading …" / "No … yet" pair quoted in §1 is an `EmptyState`.
- **`SelectField`** (`ariaLabel`, `options`, `value`, `onValueChange`) and
  **`Table` / `TableBody` / `TableRow` / `TableCell`** (the `className="facts"` key/value tables).

---

## 3. The Scout domain model as the frontend sees it

### 3.1 Saved need / active need

`Doc<"savedNeeds">` (validator in `convex/savedNeeds.ts`):

```
_id, _creationTime, ownerId,
title: string, city: string, districts: string[],
maxBudgetEur?: number,
arrangement: ("permanent"|"shared"|"hourly")[],
schedule: string[], requirements: string[],
openToSharing?: boolean, radiusKm?: number,
genres?: string[], instruments?: string[], collaborationOpen?: boolean,
facets?: { namespace: string; key: string; value: string|number|boolean|string[]; confidence: number }[],
status: "draft"|"active"|"paused"|"archived",
createdAt, updatedAt, matchingRevision?, matchingRunId?
```

- `facets` is the **open extension point**: any new constraint the Scout learns lands here instead of a
  new column, and `factsFromNeed` renders it generically (`confidence < 0.75` → value + „ · noch zu klären").
- Functions: `listMine({ status?, limit? })`, `getMine({ needId })`, `create({...})` (always `status:"draft"`),
  `getOrCreateDraft({})`, `update({ needId, ...partial })`, `setStatus({ needId, status })`.
- **`listMine`** clamps `limit` to 1..50 (default 30), newest first, by `by_owner` or
  `by_owner_and_status`.
- **`getOrCreateDraft({})`** first reuses any non-archived need among the newest 20; otherwise it inserts

  ```
  { title: "My rehearsal-room search", city: "", districts: [], arrangement: [],
    schedule: [], requirements: [], status: "draft" }
  ```

  Both defaults are user-visible: the title becomes `SavedSearch.title` on `/app/search` and
  `mandate.goal` in the autonomy panel, and the **empty `city`** is exactly what disables „Scout
  losschicken" (§1.6) and makes `enableDefaultAutopilot` / `setNeedStatus("active")` throw
  `INCOMPLETE_NEED`.
- `create` and `update` trim `title`/`city` and throw `ConvexError({ code: "INVALID_FIELD", field })`
  when either is empty; list fields are trimmed + de-duplicated; `maxBudgetEur` must be finite and ≥ 0
  (`INVALID_BUDGET`); `update` throws `NEED_ARCHIVED` for an archived need and always calls
  `refreshNeedMatching`.
- `setNeedStatus` (`convex/lib/needLifecycle.ts`): activating with an empty `city` throws
  `INCOMPLETE_NEED`; any status change or edit bumps `matchingRevision`, retires stale matches and
  (when active) schedules `internal.matches.recomputeNeed`.
- "Active need" is **not** a field on the need. It is `scoutContexts.activeNeedId`
  (`api.scout.getMine`), with the fallback described in §1.6.

### 3.2 Facts projection — `src/features/scout/viewModel.ts`

```ts
type ScoutFact = { key: string; label: string; value: string };
factsFromNeed(need): ScoutFact[]
```

Order and labels (all English today; the port must localise):

| key | label | value |
|---|---|---|
| `location` | Location | `city · district · district` |
| `arrangement` | Arrangement | `Permanent room` / `Shared room` / `Hourly room`, joined by ` · ` |
| `budget` | Budget | `Up to €<n> / month` |
| `radius` | Radius | `<n> km` |
| `schedule` | Schedule | joined ` · ` |
| `requirements` | Essential | joined ` · ` |
| `sharing` | Sharing | `Open to a compatible band` / `Not looking to share` |
| `music` | Music | genres joined ` · ` |
| `instruments` | Instruments | joined ` · ` |
| `connections` | Connections | `Open to band connections` / `Room search only` |
| `facet:<ns>:<key>` | `key` with `_`/`-` → space | value (`Ja`/`Nein` for booleans), `+ " · noch zu klären"` when `confidence < 0.75` |

```ts
type ScoutWorkspaceMode = "discovery" | "waiting" | "attention" | "results" | "paused";
getScoutWorkspaceMode(need, matches, opportunities):
  need.status === "draft"   → "discovery"
  need.status === "paused"  → "paused"
  opportunities.some(o => ["new","reviewing","contacted"].includes(o.status) && o.uncertainties.length) → "attention"
  matches?.length           → "results"
  else                      → "waiting"
```

`activeMatchCount(matches)` = `matches?.length ?? 0`.

### 3.3 Scout thread / context

`api.scout.getMine` → `{ threadId: string, mode, activeNeedId?, focusedSignalId? } | null`
with `mode ∈ { "search_discovery", "signal_advisor", "outreach_drafting" }`.

- `api.scout.getOrCreateThread({ activeNeedId? })` returns the same object; switching `activeNeedId`
  resets `mode` to `search_discovery` and clears `focusedSignalId`.
- `api.scout.setFocus({ threadId, mode, activeNeedId?, focusedSignalId? })` — throws `SIGNAL_REQUIRED`
  when mode ≠ `search_discovery` and no signal is given.
- `api.scout.listMessages({ threadId, paginationOpts })` → page of
  `{ key, role: "system"|"user"|"assistant", text, status, createdAt }` (Convex Agent `listUIMessages`).
  The UI sorts ascending by `createdAt` and maps `assistant → "scout"`.
- `api.scout.sendMessage({ threadId, message })` **action** → `{ text }`. Rate-limited; message must be
  1…4000 chars. Server-side tool sets per mode:
  - `search_discovery` + active need → `{ updateSearchDraft, rememberFact }`
  - `outreach_drafting` + need + focused signal → `{ createOutreachDraft, createWebformDraft, rememberFact }`
  - otherwise → `{ rememberFact }`
- Case card and untrusted-contact framing are built in `internal.scout.getActionContext` +
  `convex/scoutCaseCards.ts`.

### 3.4 Mandates / autopilot activation

`convex/mandates.ts`. Persisted mandate (`searchMandates`):

```
_id, savedNeedId, version, supersedesMandateId?,
mode: "guided"|"research_autopilot"|"outreach_autopilot"|"negotiation_autopilot",
status: "draft"|"active"|"superseded"|"revoked"|"expired",
platformIds: Id<"sourcePlatforms">[],
allowedActionTypes: (send_email|submit_webform|send_platform_dm|create_portal_account|publish_listing|share_contact_details|propose_visit_time)[],
allowedPersonalData: (band_name|member_first_names|reply_email|phone|precise_location|availability|budget|music_profile)[],
maxContactsPerDay, maxBrowserMinutesPerDay, maxMonthlyPriceEur?,
expiresAt, stopOnComplaint, stopWhenSuitableRoomConfirmed,
commitmentBoundary?: "non_binding_outreach_only",
contentHash, activatedAt?, stoppedAt?, createdAt, updatedAt
```

Functions:
- `getActiveMine({ savedNeedId })` → mandate | null
- `listMine({ savedNeedId?, limit? })` — ⚠ **when `savedNeedId` is supplied the query filters
  `.eq("status", "active")`, so it returns only the ACTIVE mandate for that need, never a version
  history.** Only the unscoped call lists all statuses for the owner. Default limit 20, clamped 1..50.
- `createDraft({ savedNeedId, mode, platformIds, allowedActionTypes, allowedPersonalData, maxContactsPerDay, maxBrowserMinutesPerDay, maxMonthlyPriceEur?, expiresAt, stopOnComplaint, stopWhenSuitableRoomConfirmed })` → `{ mandateId, contentHash }`
- `activate({ mandateId, expectedContentHash })` — hash must match the reviewed draft

**Server-side validation a mandate editor must respect** (`convex/mandates.ts:122-166, :313-408`):

| rule | error code |
|---|---|
| `commitmentBoundary` is injected as `"non_binding_outreach_only"`; its absence is rejected | `MANDATE_COMMITMENT_BOUNDARY_REQUIRED` |
| `maxContactsPerDay` integer, 0..50 | `INVALID_CONTACT_LIMIT` |
| `maxBrowserMinutesPerDay` integer, 0..240 | `INVALID_BROWSER_LIMIT` |
| `maxMonthlyPriceEur` finite, 0..100000 | `INVALID_PRICE_LIMIT` |
| `expiresAt > now` and `≤ now + 366 d` | `INVALID_MANDATE_EXPIRY` |
| `guided` / `research_autopilot` with a non-empty `allowedActionTypes` | `MODE_CANNOT_AUTHORIZE_EXTERNAL_ACTIONS` |
| every id in `platformIds` must exist (duplicates are dropped first) | `PLATFORM_NOT_FOUND` |
| need missing / not owned / archived | `NEED_NOT_FOUND` |
| `activate` requires `status === "draft"` | `INVALID_MANDATE_STATE` |
| `activate` requires the hash to still match | `MANDATE_CONTENT_CHANGED` |

`createDraft` computes `version` as `max(existing versions) + 1` over the newest 100 rows for that need
and sets `supersedesMandateId` to the currently active mandate; `activate` marks the previous active
mandate `superseded` and writes an `auditEvents` row `mandate.activated`.
- `revoke({ mandateId })`, `killSwitch({ savedNeedId })` → number of stopped mandates
- `enableDefaultAutopilot({ savedNeedId })` → `{ mandateId, contentHash, created }` — **the one-click
  „Scout losschicken" path**. It: requires a non-empty `city` (else `INCOMPLETE_NEED`); reuses an
  existing non-expired `negotiation_autopilot` mandate with `commitmentBoundary:"non_binding_outreach_only"`;
  otherwise takes up to 50 active `sourcePlatforms` minus the need's `exclude` preferences, uses
  10 contacts/day, 30 browser-min/day, `maxMonthlyPriceEur = need.maxBudgetEur`, 30-day expiry,
  both stop conditions on; supersedes the previous mandate; sets the need `active`; writes an
  `auditEvents` row `mandate.default_autopilot_activated`; schedules `internal.matches.recomputeNeed`.
  It grants exactly
  `allowedActionTypes = [send_email, submit_webform, send_platform_dm, create_portal_account,
  publish_listing, propose_visit_time]` — **note: NOT `share_contact_details`** — and
  `allowedPersonalData = [band_name, reply_email, availability, budget, music_profile]`.

UI translation (both `MySearchPage` and `SearchControlSettings` do this identically):
`research_autopilot↔research`, `outreach_autopilot↔outreach`, `negotiation_autopilot↔negotiation`,
`guided↔guided`; action `propose_visit_time ↔ propose_visit`; when the UI mode is `guided` or
`research`, `allowedActionTypes` is sent as `[]`.
⚠ Those four UI modes are only ever **read**. The autonomy editor offers two options — "Autopilot"
(writes `negotiation`) and "Review every action" (writes `guided`) — see §2.6. Both writers also filter
`allowedActionTypes` through the seven external-action names and `dataScopes` through the eight personal
data scopes before sending, and both send `stopOnComplaint: true, stopWhenSuitableRoomConfirmed: true`
unconditionally plus `expiresAt: next.expiresAt ?? <mount time + 30 d>`.

Autopilot execution loop: `convex/mandateOrchestrator.ts` —
`runNowMine({ limit? })` (user-triggered, not used by any current screen), `runForOwner`, `runBatch`
(cron). It takes `opportunities` with `status:"new"` for an active `outreach_autopilot`/`negotiation_autopilot`
mandate, and only queues them when the signal's platform is the controlled demo portal
`roomscout.dev` **and** the platform is in `mandate.platformIds`; then flips the opportunity to
`reviewing` and enqueues a provider turn. Everything else is skipped by design.

Frontend policy mirror: `src/features/agentOperations/mandatePolicy.ts` decides whether a UI action can
run under the standing mandate or needs exact approval (`hardHumanActionTypes` = accept_terms,
accept_contract, confirm_booking, make_payment, pay_deposit, enter_password, complete_2fa, solve_captcha).

### 3.5 Matches

`api.matches.listMine({ status?, limit?, savedNeedId? })` → array of

```
_id: Id<"signalMatches">, savedNeedId, signalId,
kind: "need_supply" | "demand_demand",
score: number, reasons: string[], uncertainties: string[],
status: "new"|"seen"|"saved"|"dismissed"|"contacted",
updatedAt, signalTitle, signalCity, signalSide,
signal: <signal projection>, contactEligible: boolean
```

⚠ **The two hardest filters — both invisible from the call site:**

1. **A `savedNeedId` that is not `status:"active"` returns `[]`.**
   `if (args.savedNeedId && (!need || need.ownerId !== ownerId || need.status !== "active")) return []`.
   So a **draft or paused** search always shows zero matches, no matter what is in `signalMatches`.
   Anywhere the UI reads `matches.length === 0` as "nothing found yet" it is also reading "the search is
   not active" (see §1.6, §1.7 and the §4 precedence).
2. **Rows are pinned to the need's current revision.** With a `savedNeedId` the query uses
   `by_need_revision_and_eligible_score` with `needRevision === (need.matchingRevision ?? 0)` and
   `eligible === true`; without one it uses `by_owner_and_eligible_and_updated_at`. In both cases every
   row is additionally checked with `isCurrentMatch(ctx, match)` and dropped when stale. With **no**
   `status` argument all `dismissed` matches are dropped; with one, only that status survives.
   The scan takes 200 rows and stops once `limit` (clamped **1..50**, default 30) results are collected.

`api.matches.updateStatus({ matchId, status })` — throws `MATCH_NOT_FOUND` when missing or not owned,
and **`MATCH_NO_LONGER_CURRENT` for any status other than `dismissed` on a stale match** (so "Save" and
"Open detail" → `seen` can fail where "Dismiss" always succeeds).
`api.matches.recomputeMine({ savedNeedId })` **action** → `{ created }` (rate-limited `matchRefresh`
2/min).

Signal projection (`convex/signals.ts`, used by matches, signals.list, signals.get):
`_id, side, title, city, district?, summary, arrangement("permanent"|"shared"|"hourly"|"unknown"),
priceEur?, pricePeriod?("hour"|"month"|"unknown"), requirements[], unknowns[], status("published"|"stale"),
verification("observed"|"verified"|"conflicting"), sourceCount, firstSeenAt, lastSeenAt, publishedAt?, isDemo?`.

### 3.6 Opportunities and offer acceptance

`api.opportunities.listMine({ savedNeedId?, status?, limit? })` →

```
_id, savedNeedId, mandateId?, kind: "supply_match"|"demand_collaboration"|"source_lead",
status: "new"|"reviewing"|"saved"|"dismissed"|"contacted"|"converted"|"expired",
signalId?, platformId?, sourceCandidateId?,
score, reasons: string[], uncertainties: string[],
firstSeenAt, lastSeenAt, updatedAt
```

- `limit` clamped 1..50 (default 30); newest first by `updatedAt`.
- ⚠ **Rows are silently hidden**: any row with `signalId` whose status is `new`/`reviewing`/`saved` is
  dropped when `opportunityMatchIsCurrent(ctx, row)` is false. Since §4 derives the whole
  `clarification` stage from `opportunities.some(...)`, **the stage can disappear without any user
  action** when the need revision or the underlying signal changes.
- `updateStatus({ opportunityId, status })` throws `OPPORTUNITY_NOT_FOUND`, and
  **`OPPORTUNITY_NO_LONGER_MATCHES`** in the same stale situation for the statuses
  `new`/`reviewing`/`saved`.
- `createHandoff({ opportunityId, channel: "platform"|"email"|"manual", summary })` → `Id<"handoffs">`.
  The summary is **normalised server-side**: `trim().replace(/\s+/g, " ").slice(0, 2000)` — so the
  inbox page's `"\n"`-joined summary (§1.8) collapses to one line — and an empty result throws
  `INVALID_SUMMARY`. The mutation also patches the opportunity to `status: "reviewing"`, which the
  inbox page immediately overwrites with `"converted"`.
- `opportunity.uncertainties` is what drives the Scout's **clarification** state (§4).
- Acceptance of a concrete offer is a separate, hash-pinned flow: `offerAcceptance.prepare` →
  `offerAcceptance.getMine` → `offerAcceptance.approveAndSend` (§2.4). It is restricted to
  controlled `roomscout.dev` platform messages and explicitly "does not sign an agreement, book a
  room, or make a payment".

### 3.7 Provider conversations, questions and clarifications

`api.providerConversations.listMine({ limit? })` →

```
conversationId, savedNeedId, signalId,
mailThreadId?, platformThreadId?,
state: string, revision: number, updatedAt, errorCode?,
replyStatus?: string,              // "awaiting_approval"|"approved"|"queued"|"executing"|"executed"|"failed"
acceptanceStatus?: string, acceptanceRequestId?, acceptedOfferId?, acceptedAt?,
offer: null | {
  offerId, revision, current: boolean, ready: boolean, contentHash,
  blockers: string[],
  assessment: {
    summary,
    availability: { status: "available"|"unavailable"|"conditional"|"unknown", evidence: Citation[] },
    monthlyPrice: { totalEur: number|null, allRecurringCostsKnown: boolean, evidence: Citation[] },
    terms: { key, label, value, evidence }[],
    constraints: { key, verdict, explanation, evidence }[],
    uncertainties: string[],
    contradictions: { explanation, evidence }[],
    nextAction: <enum>,
    suggestedReply: { subject, body } | null
  }
}
```

Every citation is validated server-side against the actual message text
(`convex/lib/providerAssessment.ts`, `OFFER_EVIDENCE_NOT_FOUND` etc.), so the UI may render quotes as
provenance. `offer.blockers` + `assessment.uncertainties` are the "open questions" for a candidate;
`opportunity.uncertainties` are the open questions addressed to the *user*.

**Derived semantics the offer stage depends on** (`convex/providerConversations.ts:343-386`):

- `limit` must be an **integer 1..50** (default 30) or the query throws `INVALID_LIMIT` — it is not
  clamped.
- `offer.current` is computed server-side and requires *all* of: an offer exists, no `activeEventId`,
  `conversation.state !== "closed"`, the need is owned **and `need.status === "active"`**,
  `offer.revision === conversation.revision`, `offer.needRevision === (need.matchingRevision ?? 0)`, the
  signal exists with status `published`/`stale`, and `offer.signalRevision === signalMatchRevision(signal)`.
  ⚠ **Pausing the search — including the automatic pause after an acceptance (§4) — makes every offer
  non-current.**
- `ready` is returned as `current && offer.ready`, never `offer.ready` alone.
- When not current, `blockers` is **prefixed** with the literal
  `"The search, listing or provider conversation has changed. Reassessment is required."`
- `replyStatus` is the status of the `actionRequests` row linked to the offer **only when it is not the
  acceptance request** (`providerActionKind !== "acceptance"`); otherwise it is `undefined`, which
  `ProviderOfferPanel` renders as "Suggested reply · not sent".
- `acceptanceStatus` is the status of `conversation.acceptanceRequestId`, when owned.

### 3.8 Communications (inbox)

- `api.communications.listThreadsMine({ limit? })` → union:
  `{ channel:"email", threadId: Id<"mailThreads">, subject, participants[], status, lastMessageAt, lastDeliveryStatus? }`
  | `{ channel:"platform", threadId: Id<"platformThreads">, connectionId, subject, participants[], status, lastMessageAt }`
  ⚠ **For email threads `participants` is ALWAYS `[]`** — the handler literally writes
  `participants: [] as string[]` (`convex/communications.ts:36-45`); only platform threads carry real
  participants (and their `subject` falls back to `"Platform conversation"`). That is why every email row
  in the inbox renders the literal **"participants not exposed"** (§1.8). `limit` is clamped 1..50
  (default 30) and applied **per channel and again after merging**, so 50 email threads can crowd out
  every platform thread.
- `api.inbox.listThreadsMine({ limit? })` → `{ _id, subject, status: "sent"|"awaiting_reply"|"replied"|"closed"|"failed", lastMessageAt, lastDeliveryStatus?, lastError?, createdAt }`
- `api.inbox.getThreadMine({ threadId, limit? })` → `{ thread, messages: [{ _id, direction:"outbound"|"inbound", from, to[], subject, body, parsedSummary?, parsedFacts?[], deliveryStatus?, receivedAt }] } | null`
- `api.platformInbox.listThreadsMine({ connectionId, limit? })`, `getThreadMine({ threadId, messageLimit? })`
  → messages `{ _id, threadId, direction, senderLabel?, bodyText, sentAt, createdAt }`
- `api.inbox.listMailboxMessagesMine({ status?, limit? })` → `{ _id, from, to[], subject, body,
  kind: "portal_verification"|"general", status: "unread"|"read"|"archived", receivedAt }`;
  `updateMailboxMessageStatus({ messageId, status })`
- `api.mailboxes.getMine` → `{ status: "provisioning"|"active"|"failed"|"disabled", emailAddress?, lastError? } | null`;
  `api.mailboxes.ensureMine()` (action) returns the same public shape.
- `api.externalActions.listMine({ limit? })` → the action ledger, newest first, `limit` clamped 1..50
  (default 30). The **full public row** (`actionPublic` + `publicValidator`,
  `convex/externalActions.ts:113-162`):

  ```
  { _id: Id<"actionRequests">,
    savedNeedId?, mandateId?, opportunityId?, handoffId?, platformId?, connectionId?,
    automationMode: "exact_once" | "standing_mandate",
    requestedActionType: send_email | submit_webform | send_platform_dm | create_portal_account
                       | publish_listing | share_contact_details | propose_visit_time,
    personalDataScopes: (band_name|member_first_names|reply_email|phone|precise_location
                         |availability|budget|music_profile)[],
    proposedMonthlyPriceEur?, payload,
    contentVersion, contentHash,
    status: drafted|awaiting_approval|approved|rejected|queued|executing|executed|failed|cancelled|expired,
    error?, expiresAt?, createdAt, updatedAt,
    executor?: "firecrawl" | "browserbase" | "agentmail" | "direct_api" | "manual",   // from the adapter binding
    execution?: { id, status: claimed|running|succeeded|failed|unknown, error?, updatedAt } }
  ```

  **`automationMode` is the field that distinguishes "needs your exact approval" (`exact_once`) from
  "already authorized by the standing mandate" (`standing_mandate`)** — the distinction
  `ActionApprovalSheet.test.tsx` and `ActionLifecyclePanel.test.tsx` pin (§6). MusicianInboxPage
  currently hard-codes `authorization: { mode: "approve_once" }` and ignores it (§1.8); the port should
  read it.
  `executor` has **five** values; MusicianInboxPage only routes `firecrawl` and `browserbase` and throws
  "This action does not have a supported provider executor." for the other three.

  Payload union (server-normalised in `cleanPayload`), with the fields the UI mappers ignore:

  ```
  { kind: "platform_message", threadId?: Id<"platformThreads">, targetPath?: string,
    recipients: string[], senderLabel?: string, subject?: string, body: string }
  { kind: "contact_form", targetUrl: string,
    fields: { name, label?, value, sensitivity: "normal"|"personal"|"sensitive" }[] }
  { kind: "portal_account_operation", connectionId, operation: "connect"|"reauth"|"disconnect", accountLabel? }
  { kind: "email_message", recipientName, recipientEmail, subject, body,
    mailThreadId?: Id<"mailThreads">, parentMessageId?: string }
  ```

  `contact_form.fields[].sensitivity` is the flag an approval sheet should surface; `platform_message`
  carries `threadId` / `targetPath` / `senderLabel`; `email_message` carries the reply route
  (`mailThreadId` + `parentMessageId` must be set together or `INVALID_EMAIL_REPLY_ROUTE`).

### 3.9 Activity / audit feeds, adapters

- Musician-facing "activity" is currently **derived client-side** (`MySearchPage` activity tab; the
  ScoutPage `<details>What Scout is doing`). No `api.*.activity` query exists for the user.
- Operator-facing audit: `api.ops.listAudit({ limit? })` → `{ id, kind, title, detail, status, at }[]`;
  `api.ops.overview().activity` for the overview feed. Both are operator-only.
- Memory events (`api.memory.listMine().events`) are the one persisted per-user event stream:
  `{ _id, eventType, summary, occurredAt }`.
- `src/data/convexAdapters.ts` exports three pure helpers the port can keep:
  - `publicSignalToMarketSignal(signal, sourceName?, fit?)` — freshness (`fresh` ≤ 24 h, `current`,
    `possibly_stale` when status stale or > 7 d), `verified → "source_verified"`, facts list
    (`Price` / `Arrangement` / `Requirements`, with `unknown: true` when "Not stated").
    `relativeTime(ts, prefix)` ladder: `` `${prefix} just now` `` (<1 min), `` `${prefix} ${n} min ago` ``,
    `` `${prefix} ${n} h ago` ``, `` `${prefix} ${n} d ago` ``; the prefix is **"Checked"**, or
    **"Last seen"** when `status === "stale"`, and **"First seen"** for `firstSeen`.
    `arrangement` map: `permanent` "Permanent", `shared` "Shared", `hourly` "Hourly",
    `unknown` **"Arrangement unknown"**. `location` = `` `${city} · ${district}` ``.
    `source` = `sourceName ?? `${sourceCount} indexed source(s)``. Price uses
    `pricePeriod === "hour" ? "hour" : "month"` (so `"unknown"` renders as `/ month`).
  - `savedNeedToSearch(need)` → `SavedSearch` (`status: draft|paused|active`, `fields[]` all
    `source: "you"`) — English labels, duplicates `factsFromNeed` with different wording. The exact
    differences a builder must reconcile:

    | | `factsFromNeed` (§3.2) | `savedNeedToSearch` |
    |---|---|---|
    | order | Location, Arrangement, Budget, **Radius**, Schedule, Essential, Sharing, Music, Instruments, Connections, facets | Location, **Radius**, Arrangement, Budget, Schedule, Essential, Music, Instruments, Sharing |
    | Budget | `Up to €N / month` | `≤ €N / month` |
    | Sharing (true) | "Open to a compatible band" | "Open to compatible room-sharing" |
    | Arrangement | "Permanent room" / "Shared room" / "Hourly room" | "Permanent" / "Shared" / "Hourly" |
    | `collaborationOpen` | "Connections" row | **omitted** |
    | `facets` | rendered generically | **omitted entirely** |

    ⚠ **ScoutPage does not use `savedNeedToSearch`** — it builds `SavedSearch.fields` from
    `factsFromNeed` (`facts.map(f => ({ label, value, source: "you" }))`). So the same card shows
    different wording on `/app/scout` and `/app/search`. Pick one for the port.
  - `formatMessageTime(ts)` → `Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short" })`.

- ⚠ **ScoutPage has a THIRD, local signal mapper**, `marketSignal(match, now)`
  (`src/routes/musician/ScoutPage.tsx:285-340`) — this is the object the `ApprovalComposer` dialog
  renders, and it disagrees with the adapter on almost every field:

  | field | ScoutPage `marketSignal` | `publicSignalToMarketSignal` |
  |---|---|---|
  | `location` | `[district, city].join(", ")` | `[city, district].join(" · ")` |
  | `freshnessLabel` | "Possibly stale" / "Checked within the hour" / `Checked ${h} h ago` | the min/h/d ladder with "Checked"/"Last seen" |
  | `arrangement` | "Fixed monthly" for `permanent`, else the capitalised word, `undefined` for `unknown` | "Permanent"/"Shared"/"Hourly"/"Arrangement unknown" |
  | `source` | `${sourceCount} public source(s)` | `${sourceCount} indexed source(s)` |
  | `firstSeen` | `First seen ${new Date(firstSeenAt).toLocaleDateString()}` | `First seen <relative>` |
  | `facts` | `[]` when `priceEur` is undefined, else one `Price` row `€N / <pricePeriod ?? "unknown">` | always three rows, unknowns marked |
  | `fit` | `[...match.reasons, ...match.uncertainties.map(u => "Uncertain: " + u)].join(" · ")` | passed in by the caller |

- **Where the view types live**: `MarketSignal`, `SavedSearch`, `SearchField`, `SignalSide`,
  `SignalFact`, `VerificationState`, `FreshnessState`, `ScoutMessage`, `MailThread`/`MailMessage` and
  `ReviewCandidate` are all exported from **`src/mocks/demoData.ts`** — not from `src/features/`. Seven
  production modules import them (ScoutPage, ExplorePage, ApprovalComposer, SignalCard, SignalBadge,
  SearchProfileCard, convexAdapters), all via `import type`, so the demo fixtures in the same file
  (`demoSignals`, `demoNewSignal`, `demoSearch`, `demoScoutMessages`, `demoThread`,
  `demoReviewCandidates`, `demoActivity`) never reach the runtime bundle. **The port should move the
  types into `src/features/` and leave the fixtures behind.**

### 3.10 Voice session

**Ownership**: one `useRealtimeVoiceScout()` instance for the whole `/app/*` subtree, held by
`VoiceSessionProvider` (`src/components/voice/VoiceSessionProvider.tsx`) and read through
`useVoiceSession()` (`VoiceSessionContext.ts`). Away from `/app/scout` while connected, the provider
renders a floating pill „Gespräch läuft · Zum Scout" with mute and hang-up buttons.

The floating pill's own labels: `aria-label="Laufendes Scout-Gespräch"`, link „Gespräch läuft · Zum
Scout", buttons „Mikrofon einschalten" / „Mikrofon stummschalten" and „Gespräch beenden".

**Options** (`UseRealtimeVoiceScoutOptions`):
```ts
{ sessionEndpoint?: string;   // default: VITE_CONVEX_URL → *.convex.site + "/api/realtime/session",
                              // then VITE_CONVEX_SITE_URL, then the relative "/api/realtime/session"
  createSession?: (sdp, convexAccessToken) => Promise<string | { answerSdp, voiceSessionId? }>;  // test seam
  initialModality?: "voice" | "text";
  onEvent?: (event: RealtimeServerEvent) => void }
```

**Returned session value** (this is `VoiceSessionValue`):
`{ status, modality, muted, error, transcript, connectedAt, connected, volume, connect, disconnect,
setMuted, setModality, sendText, interrupt, sendEvent }`
with `status ∈ idle | requesting_microphone | connecting | creating_session | listening | thinking |
speaking | disconnected | error`, and `transcript: { id, role:"user"|"assistant", text, final }[]`
(capped at the last 24 items, `src/features/voice/realtimeRuntime.ts`).

**Semantics of the returned functions** (the new UI must wire all of these):

- **`sendText(text)` returns `boolean`.** It trims, returns `false` on empty **and whenever the data
  channel is closed** (`sendEvent` failed) — `RealtimeVoiceScout` and `ScoutConversation` both rely on
  that to keep the draft in the input. On success it optimistically appends a local transcript item with
  id `` `typed-${Date.now()}` ``, persists it via
  `recordTranscript({ voiceSessionId, providerEventId: id, role: "user", transcript })` (fire-and-forget),
  then either issues `response.create` with `output_modalities: [modality === "voice" ? "audio" : "text"]`
  or, while a response or tool batch is active, sets `responsePendingRef` for later. Finally it sets
  status `thinking`.
- **`interrupt()`** sends `response.cancel` **and** `output_audio_buffer.clear`, then forces status
  `listening`.
- **`setModality(next)`** updates the ref + state and pushes
  `session.update { type: "realtime", output_modalities: [audio|text] }`.
- **`setMuted(next)`** toggles `track.enabled` on every local audio track (it does not renegotiate).
- **`volume`** = the **output** meter while `status === "speaking"`, `0` while muted, else the **input**
  meter.
- **`disconnect` is registered as an unmount effect** (`useEffect(() => disconnect, [disconnect])`), so
  leaving the authenticated subtree ends the session and calls `voice.endMine`.
- The context re-sync effect and the 15-minute auto-disconnect are described below.

**How a session starts** (`connect()`):
1. `useAuthToken()` must be non-null → else „Sign in before starting a private voice session."
2. `getUserMedia({ audio: { autoGainControl, echoCancellation, noiseSuppression } })` → status `requesting_microphone`
3. `new RTCPeerConnection()`, an `<audio autoplay playsinline>` element for the remote track,
   data channel `"oai-events"` → status `connecting`
4. `createOffer()` → POST the raw SDP to `POST {convex.site}/api/realtime/session`
   (`Content-Type: application/sdp`, `Authorization: Bearer <convex token>`) → status `creating_session`
5. Convex `httpAction` `sessionHttp` (`convex/voice.ts`, routed in `convex/http.ts`):
   CORS-checked, auth-checked, rate-limited (`voiceSession` 3/h), requires an existing Scout context
   (409 „Start a Scout conversation first"), requires `OPENAI_API_KEY` (503), builds the session
   (model `OPENAI_REALTIME_MODEL`, voice `OPENAI_REALTIME_VOICE`, `server_vad` turn detection,
   `gpt-transcribe` input transcription, instructions = base Scout prompt + case card + memory
   context + voice rules, `tools: realtimeTools()`), inserts a `voiceSessions` row, forwards to
   `https://api.openai.com/v1/realtime/calls`, and answers with the SDP plus header
   **`X-RoomScout-Voice-Session: <voiceSessionId>`** (exposed via CORS).
6. The hook keeps that id in `voiceSessionIdRef` and `setRemoteDescription(answer)`.
7. On data-channel open: `session.update` with `output_modalities`, then
   `useAction(api.voice.getInstructions)()` → `{ instructions, contextVersion }` → another
   `session.update`, then one `response.create` with
   `"Greet the user briefly and ask how you can help with their current rehearsal-room search."`.
8. A 15-minute timer auto-`disconnect()`s; `disconnect()` calls
   `useMutation(api.voice.endMine)({ voiceSessionId })`.

**Transcript events** handled in `handleServerEvent`:
`error` → `safeProviderError` (never shows provider text); `input_audio_buffer.speech_started` →
`listening` + reserve item; `speech_stopped` / `response.created` → `thinking`;
`output_audio_buffer.started` / `response.output_audio.delta` → `speaking`;
`output_audio_buffer.stopped` / `response.done` → `listening`;
`conversation.item.added` → reserve ordered slot;
`conversation.item.input_audio_transcription.completed` → final user line;
`response.output_audio_transcript.delta` / `response.output_text.delta` → streaming assistant text;
`…transcript.done` / `output_text.done` → final assistant line.
Every **final** line is persisted with
`api.voice.recordTranscript({ voiceSessionId, providerEventId, itemId?, role, transcript })` →
`{ created }` (idempotent on `providerEventId`).

**Tool calls**: `functionCallsFromResponse(event)` only reads `response.done` with
`response.status === "completed"` and `output[].type === "function_call"`. Allowed names (client-side
allowlist mirroring the server union):
`get_current_search`, `update_search_draft`, `remember_fact`, `recall_relevant_memory`,
`get_focused_signal`, `create_outreach_draft`, `create_webform_draft`.
Each call → `useAction(api.voice.executeTool)({ voiceSessionId, name, argumentsJson })` →
`{ outputJson }` → sent back as `conversation.item.create` /
`{ type:"function_call_output", call_id, output }`; failures send
`{"error":"The Scout could not complete that action."}`. After a batch, a single `response.create`
is issued. Results arriving after the connection generation changed are dropped (test-pinned).

Server-side tool semantics (`convex/voice.ts::executeTool`, rate-limited `voiceTool` 30/min):
- `get_current_search` → `{ need }` (the whole saved need or null)
- `get_focused_signal` → `{ signal }` (public projection or null)
- `recall_relevant_memory` `{ query }` → `{ memory }`
- `update_search_draft` → `internal.savedNeeds.updateFromScout` → `{ updated: true }`
- `remember_fact` → `internal.memory.rememberFromScout` → `{ remembered, factId }`
- `create_webform_draft` → ensures the AgentMail mailbox, then `internal.externalActions.createContactFormFromScout`
- `create_outreach_draft` → ensures mailbox, then `internal.outreach.createFromScout`
  (last two require both `activeNeedId` and `focusedSignalId`, else `NEED_AND_SIGNAL_REQUIRED`)

**Context re-sync**: an effect watches `api.scout.getMine`; when
`${mode}:${activeNeedId}:${focusedSignalId}` changes while connected, it re-fetches
`voice.getInstructions()` and pushes a fresh `session.update`. So navigating to a signal and
pressing "Ask Scout about this" retargets a *live* call.

**User-facing voice error vocabulary** — these replace the German status line
(`{voice.error ?? statusCopy[voice.status]}`), so a bilingual port needs DE strings for all of them:

From `useRealtimeVoiceScout`:
"Sign in before starting a private voice session." · "This browser does not support microphone capture." ·
"The realtime peer connection failed." · "The Realtime event channel failed." · "Received an unreadable
Realtime event." · "The browser did not create a WebRTC offer." · "Voice session request failed"
(thrown, then run through `safeVoiceError`) · and the tool-failure output sent back to the model,
`{"error":"The Scout could not complete that action."}`.

From `safeVoiceError(cause, fallback)` (`src/features/voice/realtimeRuntime.ts:66-81`):
`NotAllowedError` → "Microphone access was not allowed." · `NotFoundError` → "No microphone was found." ·
`TypeError` → "The voice service could not be reached. Check your connection and try again." ·
message matching `/browser did not create/i` → "The browser could not create a voice connection." ·
default fallback → **"Could not start the Realtime session."**

From `safeProviderError(event)` (`:83-89`) — provider text is never surfaced:
code matching `/rate_limit/i` → "The voice service is busy. Please wait a moment and try again." ·
code matching `/audio|microphone/i` → "The voice service could not process the microphone audio." ·
otherwise → "The Realtime session reported an error."

`RealtimeVoiceScout` (`src/components/voice/RealtimeVoiceScout.tsx`) is the presentational stage:
`VoiceVolumeBlob` (volume from `useAudioVolume`), one live caption, the German status map
(„Bereit, wenn du es bist" / „Warte auf Mikrofonfreigabe …" / „Verbinde …" / „Gespräch wird vorbereitet …" /
„Ich höre zu" / „Ich denke kurz nach" / „Dein Scout spricht" / „Gespräch beendet" / „Verbindung unterbrochen"),
mute / interrupt / hang-up, a transcript drawer („Mitschrift"), a text composer, a modality switch
(„Antworten als Text" / „Antworten mit Stimme"), and an optional `facts` rail („Eure Wünsche").

**Control visibility rules** (props `{ title?, className?, facts?, onEnd? }`):

```ts
busy   = status ∈ { requesting_microphone, connecting, creating_session };
active = voice.connected || status ∈ { listening, thinking, speaking };
```

`!active && !busy` → one start button (icon `Mic`, or `RotateCcw` when status is `error`/`disconnected`).
`busy` → only a cancel button. `active` → mute, **the interrupt button only while `status === "speaking"`**,
and hang-up. The transcript and composer toggles are always visible; **the modality switch renders only
while `active`**; the composer's input and send button are disabled unless `active`. `onEnd` is called
after `voice.disconnect()` (ScoutPage uses it to open the brief review, §1.6).

**Remaining stage copy** (verbatim):
default `title` = „Erzähl mir, was ihr sucht." — shown as the caption while idle; active caption fallback
„Sag einfach, was bei eurem Proberaum wichtig ist."; the latest line is prefixed by a speaker chip „Du" /
„Dein Scout"; the status line appends „ · Mikro aus" while muted; transcript drawer heading „Mitschrift"
with the empty state „Noch keine Äußerungen." and the same „Du"/„Dein Scout" prefixes; composer
placeholders „Schreib deinem Scout …" (active) / „Starte zuerst das Gespräch"; sr-only label
„Nachricht an deinen Scout".
Aria labels: section „Gespräch mit deinem Room Scout"; blob „Sprachaktivität"; control group
„Gesprächssteuerung"; „Gespräch starten" / „Gespräch erneut starten"; „Verbindungsaufbau abbrechen";
„Mikrofon einschalten" / „Mikrofon ausschalten"; „Scout unterbrechen"; „Gespräch beenden";
„Mitschrift öffnen" / „Mitschrift schließen"; „Per Text schreiben" / „Texteingabe schließen";
„Nachricht senden".

---

## 4. Prototype stages ↔ backend state (proposal)

The prototype (`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype/Roomscout.dc.html`)
drives one linear demo:

```js
const STAGES = ['welcome','discovery','brief_review','scouting','waiting','clarification',
                'following_up','offer','offer_review','complete'];
const AUTOPILOT = ['scouting','waiting','following_up'];
// plus two off-line branches reachable only from state: 'candidates' and 'dead_end'
```

The current app has only five modes (`discovery | waiting | attention | results | paused`). The
prototype's twelve are a **finer partition of the same backend facts** — nothing new needs to be
persisted except where marked ⚠.

| stage | real counterpart today | proposed derivation |
|---|---|---|
| `welcome` | ScoutPage `mode==="discovery"` **and** no messages yet | `need.status === "draft" && paginatedMessages.results.length === 0 && facts.length === 0` |
| `discovery` | `mode==="discovery"`, chat/voice open | `need.status === "draft"` and (messages exist or a voice session is connected) and the brief has not been opened |
| `brief_review` | ScoutPage `reviewOpen` local flag | `need.status === "draft" && facts.length > 0` and the user asked to review (keep as UI state; the "Scout losschicken" button calls `mandates.enableDefaultAutopilot`) |
| `scouting` | `mode==="waiting"` right after activation | `need.status==="active"` && active mandate is `*_autopilot` && `matches.length === 0` && no opportunity is `contacted`/`reviewing` — i.e. work started, nothing found yet |
| `waiting` | `mode==="waiting"` | `need.status==="active"` && no unanswered question && no offer && (`matches.length === 0` or every match is `dismissed`) |
| `clarification` | `mode==="attention"` | `opportunities.some(o => ["new","reviewing","contacted"].includes(o.status) && o.uncertainties.length > 0)` — the first such `uncertainties[0]` is the question, `reasons[0]` the context. Answering = `scout.sendMessage({ threadId, message: "About the current opportunity: <question>" })`. ⚠ There is no *typed* answer channel; today the answer is free text and the opportunity's uncertainties are cleared by the backend re-assessment, not by the client. |
| `following_up` | between an answer and an offer | `providerConversations.some(c => c.state is in-flight && !c.offer)` — e.g. `replyStatus ∈ {queued, approved, executing}` or an `actionRequests` row for this need is `approved`/`executing` |
| `candidates` | `mode==="results"` with > 1 match | `matches.length > 1 && !providerConversations.some(c => c.offer)`. Card fields map to `match.signal` (title, `district, city`, `priceEur/pricePeriod`), `match.reasons` (why it fits) and `match.uncertainties` (caveat line, e.g. „Schlagzeug müsste abgebaut werden"). ⚠ The prototype's photo, „ca. 28 m²", travel time and „geteilt mit einer Band" have **no backend field** — they must come from `signal.summary`/`requirements`/`unknowns` or be dropped. |
| `offer` | `mode==="results"` with a provider offer | `providerConversations.find(c => c.offer && c.offer.current)`. Terms come from `offer.assessment.terms` + `monthlyPrice` + `availability`; „Angebot eingegangen" corresponds to `offer.ready === true`; open points = `offer.blockers` |
| `offer_review` | `OfferAcceptanceFlow` open | user pressed "Review acceptance" → `offerAcceptance.prepare({ offerId, expectedOfferHash: offer.contentHash })`, then the descriptor from `offerAcceptance.getMine` renders the exact message; approval requires the acknowledgement checkbox |
| `complete` | after acceptance | `conversation.acceptedOfferId === offer.offerId && conversation.acceptedAt !== undefined`, or `acceptanceStatus === "executed"`. ⚠ **The backend pauses the search on acceptance** — `externalActions.finishExecution` sets the need to `paused`, stops the active mandate, and writes the notification "Offer acceptance sent" / "Your approved confirmation was sent in the controlled portal. Your search is paused. No payment or contract signature was performed." So after an acceptance the need is `paused` **and** every offer is non-current (§3.7): this stage must be tested **before** `paused`, and it must not depend on `offer.current` |
| `dead_end` | no real counterpart | proposed: `need.status === "active"` && the active mandate is running && `matches.length === 0` && at least one opportunity ended `dismissed`/`expired` **and** a staleness threshold passed. ⚠ Today nothing computes "we have exhausted this city"; the prototype's three compromise buttons (budget +50 €, Umland, Mittwoch) would each be `savedNeeds.update({ needId, maxBudgetEur \| districts/radiusKm \| schedule })`, which already re-triggers matching. |
| `paused` (app-only) | `need.status === "paused"` | a global banner — but it does **not** override every stage: an accepted offer also leaves the need paused (see `complete`) |

Recommended shape for the port — one `useScoutStage()` hook returning
`{ stage, need, facts, matches, opportunities, conversations, offer, question, mandate, isAutopilot }`,
computed in this precedence order (**acceptance is checked before `paused`; that is the fix for the
auto-pause described in the `complete` row — with `paused` second, `complete` is unreachable**):

```
need === undefined                                  → "loading"
acceptance sent (acceptedAt / acceptanceStatus)     → "complete"      // BEFORE paused
acceptance under review (local flag)                → "offer_review"  // BEFORE paused
need.status === "paused"                            → "paused"
need.status === "draft" && no messages && no facts  → "welcome"
need.status === "draft" && briefRequested           → "brief_review"  // set by finishVoice() too, §1.6
need.status === "draft"                             → "discovery"
current ready offer exists                          → "offer"
open opportunity uncertainty exists                 → "clarification"
provider conversation in flight                     → "following_up"
matches.length > 1                                  → "candidates"
matches.length === 1                                → "candidates" (single-card variant) or "offer" once assessed
mandate active && matches.length === 0 && young     → "scouting"
matches.length === 0                                → "waiting"
exhausted (see ⚠ above)                             → "dead_end"
```

⚠ Two data facts constrain every `matches.length` test above: `api.matches.listMine` returns **`[]` for
any need that is not `status:"active"`** and drops non-current rows (§3.5), and
`opportunities.listMine` **hides** stale `new`/`reviewing`/`saved` rows (§3.6). So "zero matches" never
distinguishes "nothing found" from "search not active", and `clarification` can vanish without a user
action. Derive `paused` from `need.status`, never from an empty match list.

The prototype's `status` line (STATUS[0..3], FOLLOW_STATUS, ALT_STATUS) is scripted copy. Real
equivalents: `scouting` ← nothing persisted (write it from the stage), `waiting` ← „Jetzt warte ich
auf eine Antwort." when a provider conversation exists with no reply, `following_up` ←
`offer.assessment.nextAction` / `replyStatus`. The prototype's `activity[]` list maps to
`memory.events` + `matches[].updatedAt` + `externalActions.listMine[].status` transitions; a proper
per-user activity query does not exist yet (§7).

---

## 5. Auth and user / role model

- Provider: `@convex-dev/auth` v2 core. `convex/auth.ts` exports `signOut`, `refreshSession`,
  `isAuthenticated` from `setupCore({ component: components.auth })` and `signUpWithPassword`,
  `signInWithPassword` from `setupUsernamePassword(...)` with
  `createUser: internal.users.createUserPassword`, `onSignIn: internal.users.onSignInPassword`.
- `users` table: `{ username, displayName?, role: "musician" | "operator", createdAt, lastSeenAt }`.
  New accounts are always `role: "musician"`.
- `api.users.current` (query, no args) → `{ _id, username, displayName?, role } | null`.
  Returns `null` when unauthenticated or when the identity subject does not normalize to a user row.
- **Promotion to operator is internal only**: `internal.users.promoteToOperator({ userId })` —
  "operator access can only be granted from trusted backend tooling or the Convex dashboard, never by
  a client mutation". There is no UI for it.
- `RequireAuth` (router.tsx): renders `<AuthLoading>Restoring your session…</AuthLoading>`,
  `<Unauthenticated><Navigate to={"/sign-in?returnTo=" + encodeURIComponent(pathname+search)} replace/></Unauthenticated>`,
  `<Authenticated>{children}</Authenticated>`.
- `RequireOperator` (router.tsx): `useQuery(api.users.current)`; `undefined` → "Checking operator
  access…"; `role !== "operator"` → a panel "Operator access required" / "Your account can use the
  musician workspace. The Ops cockpit is restricted server-side." + link to `/app/scout`.
  **This is a UI affordance only** — every `api.ops.*` function re-checks operator status server-side.
- Sign-out: `useAuthActions().signOut()` in `WorkspaceShell`, then `navigate("/", { replace: true })`.
- The voice HTTP endpoint authenticates independently with the Convex access token from
  `useAuthToken()` (`Authorization: Bearer …`), not with cookies (`credentials: "omit"`).

---

## 6. Tests that pin these contracts

All under `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/`. Vitest + Testing Library
(`src/test/setup.ts`). These are the behavioural contracts the port must not break.

| file | protects |
|---|---|
| `app/returnTo.test.ts` | `safeReturnTo` keeps internal path + query, rejects external targets |
| `features/scout/viewModel.test.ts` | `factsFromNeed` fact order/labels, typed `facets` stay visible and are marked „ · noch zu klären" below 0.75 confidence; `getScoutWorkspaceMode` — attention only with a real unresolved opportunity, draft/paused authoritative |
| `features/agentOperations/mandatePolicy.test.ts` | standing mandates never authorize hard human actions; guided → exact approval; research may browse but not communicate; draft/killed/unversioned/expired mandates rejected |
| `features/auth/errors.test.ts` | `authErrorMessage` mapping and a safe fallback for unknown Auth v2 errors |
| `features/voice/realtimeRuntime.test.ts` | function calls extracted **only** from a completed `response.done`; transcript ordering reserved before delayed transcription; provider messages/ids/response bodies never surfaced |
| `hooks/useRealtimeVoiceScout.test.tsx` | no connection resurrection when mic startup resolves after disconnect; failed session response body never exposed; server session ended + stale callbacks detached when remote setup fails; tool results dropped after the connection closed |
| `components/voice/VoiceSessionProvider.test.tsx` | one session stays mounted across Scout, settings and the authenticated map |
| `components/voice/RealtimeVoiceScout.test.tsx` | default caption, optional content closed, keyed facts, end-call callback, cancel-during-startup + mute, text only while connected, sanitized hook error |
| `components/scout/ScoutFactList.test.tsx` | a corrected fact replaces the existing row (no second budget); no facts invented before the backend extracts any |
| `components/scout/ScoutConversation.test.tsx` | failed send keeps the draft editable; `**emphasis**` rendered without markup; user asterisks stay literal |
| `components/actions/ActionApprovalSheet.test.tsx` | exact one-time approval vs. execution authorized by an active standing mandate |
| `components/actions/ActionLifecyclePanel.test.tsx` | provider execution never exposed before exact approval; approved actions execute through their reviewed provider; Live View stays ephemeral and human completion is explicit |
| `components/actions/MailboxVerificationPanel.test.tsx` | verification links are user-opened links; opening marks the message read |
| `components/connections/PortalAuthenticationGuide.test.tsx` | credentials stay in Live View; explicit "signed in" confirmation required |
| `components/connections/PortalConnectionsWorkspace.test.tsx` | independent portal states with scoped actions; AgentMail identity created only from an explicit action |
| `components/opportunities/OfferAcceptanceDialog.test.tsx` | exact terms/message/sender/destination shown; approval gated on acknowledgement; acknowledgement cleared when the snapshot changes; loading + preparation errors show no approval controls; send errors require a fresh acknowledgement |
| `components/opportunities/ProviderOfferPanel.test.tsx` | real terms/unresolved questions/unsent proposal; stale offer unmistakable; acceptance review only for a current ready offer in a platform thread; approved delivery ≠ confirmed sent; sent outcome preserved after the search pauses; failure ≠ offer |
| `components/ops/OpsPageHeader.test.tsx` | operator surface labelled without inventing state |
| `components/ops/ProviderReadinessPanel.test.tsx` | derived provider states, presence-only checks explained, refresh works |
| `components/settings/SettingsFrame.test.tsx` | every settings section exposed and navigation reported |
| `components/signals/SignalBadge.test.tsx` | only an explicitly server-marked demo signal is labelled as demo |
| `data/convexAdapters.test.ts` | `publicSignalToMarketSignal` passes through only an explicit server-derived `isDemo` |
| `routes/musician/ScoutPage.test.tsx` | only current-need matches queried (no arbitrary city listings); Scout context's `activeNeedId` wins over another current need; draft entry is voice-first and chat appears only after „Lieber schreiben"; the persisted mandate starts only after reviewing the brief and confirming; dismissal goes through `matches.updateStatus`; a paused search is never described as active; draft-init failure shows a retry without starting voice or provider work |
| `routes/musician/ProfilePage.test.tsx` | deep-linked settings section; sources render without a search; billing/metering honestly unavailable; path-based section navigation; memory deletion behind confirmation; legacy `?tab=` links still work |
| `routes/public/LandingPage.test.tsx` | landing CTAs link to the real Scout; demo content labelled illustrative; scripted facts reveal in speech order and replace the earlier budget; rejecting Wednesday continues the search and removes the incompatible offer; decision + FAQ interactions |

Convex-side integration tests (context only, not part of this task's scope) live next to their modules,
e.g. `convex/matches.integration.test.ts`, `convex/mandates.integration.test.ts`,
`convex/scoutAutopilot.integration.test.ts`, `convex/offerAcceptance.integration.test.ts`,
`convex/providerConversations.integration.test.ts`.

---

## 7. Gaps the new UI will hit

1. **A per-user notification feed is PERSISTED but has no query.** `notifications`
   (`convex/schema.ts:947-960`) is a real, per-user, indexed table:

   ```
   { ownerId: Id<"users">,
     kind: "new_match" | "mail_reply" | "outreach_failed" | "system",
     title, body, signalMatchId?, mailThreadId?, readAt?, createdAt }
   .index("by_owner_and_created_at").index("by_owner_and_read_at")
   ```

   Rows are written from at least eight paths, with fixed titles:
   "RoomScout found a new match" (`new_match`, body = the first two match reasons —
   `convex/matches.ts:318`); "A room contact replied" (`mail_reply`, body = subject — `inbox.ts:185`);
   "Portal verification email received" / "New Scout mailbox message" (`system` — `inbox.ts:275`);
   "Outreach delivery failed" (`outreach_failed` — `inbox.ts:509`); "Outreach could not be sent"
   (`outreach_failed` — `outreach.ts:590`); "A room offer is ready to review" / "Your Scout has assessed
   a provider update" (`system`, body = the assessment summary — `providerConversations.ts:270`);
   "Portal action is waiting" (`externalActions.ts:569`); "Offer acceptance sent"
   (`externalActions.ts:1125`); "Scout needs your review" (`messageSafety.ts:75`).
   **Only a query is missing** — this is the closest existing backing for the prototype's
   activity/notification ledger, and `api.notifications.listMine({ limit })` + a read mutation is a small
   addition, not a new subsystem.
   The prototype's `activity[]` ledger („Suchauftrag gestartet", „Raum gefunden", „Anbieter kontaktiert",
   „Warte auf Antwort", „Angebot eingegangen") still has no single query today; the other sources are
   `api.memory.listMine().events`, `matches[].updatedAt`, `externalActions.listMine[].status`,
   `providerConversations[].state`. A combined `api.activity.listMine({ savedNeedId, limit })` over
   `notifications` + those would be the clean fix.
2. **No typed clarification object.** `opportunity.uncertainties[]` is a `string[]`; the prototype's
   Ja/Nein answer buttons currently have to be turned into free-text `scout.sendMessage` calls.
3. **No `dead_end` signal.** Nothing marks a search as exhausted; the compromise buttons must be
   implemented as `savedNeeds.update` edits and the stage inferred from age + zero matches.
4. **Candidate cards lack fields** the prototype shows: photo, room size, travel time, number of
   co-tenants. Only `signal.summary`, `requirements[]`, `unknowns[]`, `priceEur/pricePeriod` exist.
5. **Two ad-hoc client-side filters** should move server-side during the port: ScoutPage filtering
   `providerConversations.listMine` by `savedNeedId`, and MusicianInboxPage synthesising web-form
   threads out of `externalActions.listMine`.
6. **Copy is bilingual by accident today** (German shell + English facts/labels/empty states). Every
   string in `factsFromNeed`, `savedNeedToSearch`, `SearchSourcesPanel`, the ops pages and most empty
   states is English and needs a DE/EN pair in the port. **§8 is the enumerated inventory** — the German
   surfaces are exactly five app files plus the landing components, everything else is English.
7. **Need resolution is duplicated three times** (ScoutPage, MySearchPage, SearchControlSettings) —
   extract `useActiveNeed()`.
8. **Notification *preferences* and billing genuinely do not exist**, and the current UI says so
   explicitly; the new settings dialog must not invent a preference centre or a plan (pinned by
   `ProfilePage.test.tsx`). Note the distinction from gap 1: the `notifications` **table** does exist
   and is written on eight paths — what is missing is a read query and any delivery channel other than
   in-app. Wording that promises email/push delivery would be a false claim; a read-only in-app feed
   would not.

---

## 8. Copy inventory (DE / EN)

The port is specified as German **and** English with a toggle, so every string needs a key and a pair.
This section is the index: it enumerates the **German** surfaces completely (they are the smaller set and
the ones a translator would otherwise have to hunt for), and points at the section where each **English**
surface is quoted verbatim. Nothing below is paraphrased — quotes include the original typography
(„ ", ·, –, …, the typographic apostrophe in "I’ll").

### 8.1 Where each language lives today

German exists in exactly these files (`grep -l "[äöüßÄÖÜ„]" src`):

| file | surface |
|---|---|
| `src/components/navigation/WorkspaceShell.tsx` | consumer header + account menu (§2.1) |
| `src/routes/musician/ScoutPage.tsx` | the whole Scout screen (§1.6) |
| `src/components/scout/ScoutFactList.tsx` | fact card heading + empty state (§2.8) |
| `src/components/voice/RealtimeVoiceScout.tsx` | voice stage, status map, aria labels (§3.10) |
| `src/components/voice/VoiceSessionProvider.tsx` | ongoing-call pill (§3.10) |
| `src/routes/musician/MusicianInboxPage.tsx` | inbox headings + empty states (§1.8) — **mixed** with English |
| `src/routes/public/AuthPage.tsx` | card eyebrow + headlines (§1.5) — **mixed** with English |
| `src/features/scout/viewModel.ts` | facet values „Ja"/„Nein" and the suffix „ · noch zu klären" (§3.2) |
| `src/components/landing/*` + `landingStoryModel.ts` | the marketing page and its scripted Scout demo (§1.1 — no data wiring, but it is the largest German text body in the repo) |
| `src/mocks/demoData.ts` | German demo fixtures — **not shipped** (type-only imports, §3.9); do not translate |

Everything else — settings, search, explore, signal detail, the inbox context pane, mandate panel,
action approval, provider offer, browser run, all ops pages, and every `EmptyState` — is English only.

### 8.2 German strings, complete

**Shell / account menu** (§2.1): „roomscout" (wordmark, lowercase) · „Profilmenü" · „RoomScout und Konto" ·
„Dein persönlicher Scout" · „Dein Konto" (display-name fallback) · „Scout" · „Anzeigen entdecken" ·
„Euer Suchauftrag" · „Nachrichten" · „Karte" · „Einstellungen" · „Betreiberansicht" · „Abmelden".

**Scout screen** (§1.6): „Wir lernen euch kennen" · „Suche pausiert" · „Autopilot aktiv" ·
„Begleitete Suche" · „Einstellungen" · `Hey ${name}.` · „Aus unserem Gespräch" ·
„Euer Proberaum beginnt mit einem Gespräch." · „So suche ich für euch." ·
„Erzählt mir, was euch wichtig ist. Ich kümmere mich um die Suche." · „Mit Scout sprechen" ·
„Lieber schreiben" · „Suchauftrag ansehen" · „Musik-Kontext aus ChatGPT oder Claude mitbringen" ·
„Scout losschicken" · „Scout startet …" ·
„Ich suche und frage im Rahmen eures Auftrags selbstständig an. Eine verbindliche Zusage gebt nur ihr." ·
„Noch etwas ändern" · „Eure Suche macht eine Pause." · „Eine kurze Rückfrage an euch." ·
„Diese Räume könnten passen." · „Ich kümmere mich darum." ·
„Euer Suchauftrag bleibt gespeichert. Macht weiter, wenn ihr bereit seid." ·
`Ich behalte passende Räume in ${need.city || "eurer Gegend"} im Blick. Ihr könnt die App schließen.` ·
„Hier findet ihr die aktuellen Treffer und Antworten zu eurem Suchauftrag." ·
„Ein Detail ist noch offen. Sagt mir, was für euch passt." · „Chat schließen" · „Nachricht schreiben" ·
„Aktualisieren" · „Pausieren" · „Fortsetzen" · „Dein Scout macht sich bereit …" · „Erneut versuchen" ·
„Kurz durchatmen: Bitte versuche es in einer Minute noch einmal." ·
„Der Scout konnte diesen Schritt gerade nicht abschließen. Bitte versuche es erneut. Dein Suchauftrag bleibt gespeichert."

**Fact list** (§2.8): „Euer Suchauftrag" (default heading) · „Eure Wünsche" (voice-stage heading) ·
„Was euch wichtig ist, sammelt sich hier – während wir sprechen."

**Voice** (§3.10): status map „Bereit, wenn du es bist" / „Warte auf Mikrofonfreigabe …" / „Verbinde …" /
„Gespräch wird vorbereitet …" / „Ich höre zu" / „Ich denke kurz nach" / „Dein Scout spricht" /
„Gespräch beendet" / „Verbindung unterbrochen" · „ · Mikro aus" · „Erzähl mir, was ihr sucht." ·
„Sag einfach, was bei eurem Proberaum wichtig ist." · „Du" · „Dein Scout" · „Mitschrift" ·
„Noch keine Äußerungen." · „Schreib deinem Scout …" · „Starte zuerst das Gespräch" ·
„Nachricht an deinen Scout" · „Antworten als Text" · „Antworten mit Stimme" ·
aria: „Gespräch mit deinem Room Scout" / „Sprachaktivität" / „Gesprächssteuerung" / „Gespräch starten" /
„Gespräch erneut starten" / „Verbindungsaufbau abbrechen" / „Mikrofon einschalten" /
„Mikrofon ausschalten" / „Scout unterbrechen" / „Gespräch beenden" / „Mitschrift öffnen" /
„Mitschrift schließen" / „Per Text schreiben" / „Texteingabe schließen" / „Nachricht senden" ·
pill: „Laufendes Scout-Gespräch" / „Gespräch läuft · Zum Scout" / „Mikrofon stummschalten".

**Inbox** (§1.8): „Nachrichten" · „Alle Gespräche zu eurer Suche. Dein Scout bleibt für euch dran." ·
„Gespräche" · „Hier ist es noch ruhig. Sobald ein Gespräch beginnt, erscheint es hier." ·
„Platz für gute Nachrichten." · „Wähle links ein Gespräch. Hier findest du den Verlauf und neue Antworten." ·
„Du hast das letzte Wort." ·
„Dein Scout kümmert sich um unverbindliche Gespräche. Zusagen, Buchungen und Zahlungen bleiben bei dir."

**Auth** (§1.5): „Dein persönlicher RoomScout" · „Euer nächster Raum beginnt hier." ·
„Schön, dass du wieder da bist." · „Ein Gespräch. Ein Suchauftrag. Dein Scout bleibt dran." ·
„Deine Suche und eure Gespräche warten auf dich."

**View model** (§3.2): „Ja" · „Nein" · „ · noch zu klären" (appended to a facet value below 0.75
confidence).

### 8.3 English surfaces — index

Every string is quoted verbatim in the section named; build the DE column against those lists.

| surface | section |
|---|---|
| ExplorePage (filters, counts, save gate) | §1.2 |
| SignalDetailPage (cards, provenance, gate, states) | §1.3 |
| MapPage (header, chips, states, pin summaries) | §1.4 |
| AuthPage form + the 14 `authErrorMessage` strings | §1.5 |
| ScoutPage's English leftovers (starters, intros, attention card, result cards, activity `<details>`) | §1.6 |
| MySearchPage (header, tabs, match card, Updates card, all empty states, activity rows) | §1.7 |
| MusicianInboxPage (channel labels, filters, timeline, context pane, advanced activity) | §1.8 |
| ProfilePage (all seven settings sections, knowledge column, both dialogs) | §1.9 |
| BrowserRunPage (run titles, step labels, human prompt, footer) | §1.10 |
| WorkspaceShell ops nav (Overview…Audit log, "Switch to RoomScout", "Operator") | §2.1 |
| ContextImportDialog (two phases, prompt steps, readout) | §2.2 |
| ApprovalComposer (4 button labels, 2 status messages, dialog copy) | §2.3 |
| ProviderOfferPanel (status words, 7 replyStatus labels, 3 acceptance notices, footer) + OfferAcceptanceDialog (8 state messages, terms, acknowledgement) | §2.4 |
| MandatePanel (card, dialog, the 18 `actionLabels`) | §2.6 |
| SearchSourcesPanel (5 status labels, 4 metric captions, hint, empty state) | §2.7 |
| ScoutBrief / ScoutConversation | §2.8 |
| SettingsFrame (7 sidebar labels + 7 `[H1, description]` pairs, heading "Settings") | §2.10 |
| UI primitives ("Close dialog") | §2.12 |
| `factsFromNeed` / `savedNeedToSearch` field labels and values | §3.2, §3.9 |
| `searchSources.listForNeed` disclosures (2 server strings) | §1.7 |
| Voice error vocabulary (7 hook + 5 `safeVoiceError` + 3 `safeProviderError` strings) | §3.10 |
| Router guards ("Restoring your session…", "Checking operator access…", "Operator access required", …) | §5 |
| Ops pages | §1.11 (labels are inline in the ops components; they are operator-only and lowest priority for translation) |

### 8.4 Error and fallback strings

Two mechanisms, both needing replacement in the port (§0.2):

1. **Raw `ConvexError` codes reach the user** on MySearchPage, ProfilePage, MusicianInboxPage,
   BrowserRunPage and MandatePanel. Codes seen in these paths: `INCOMPLETE_NEED`, `NEED_NOT_FOUND`,
   `NEED_ARCHIVED`, `INVALID_FIELD`, `INVALID_BUDGET`, `MATCH_NOT_FOUND`, `MATCH_NO_LONGER_CURRENT`,
   `PLATFORM_NOT_AVAILABLE`, `PLATFORM_NOT_FOUND`, `MANDATE_NOT_FOUND`, `MANDATE_CONTENT_CHANGED`,
   `INVALID_MANDATE_STATE`, `INVALID_MANDATE_EXPIRY`, `INVALID_CONTACT_LIMIT`, `INVALID_BROWSER_LIMIT`,
   `INVALID_PRICE_LIMIT`, `MODE_CANNOT_AUTHORIZE_EXTERNAL_ACTIONS`,
   `MANDATE_COMMITMENT_BOUNDARY_REQUIRED`, `OPPORTUNITY_NOT_FOUND`, `OPPORTUNITY_NO_LONGER_MATCHES`,
   `INVALID_SUMMARY`, `INVALID_LIMIT`, `OFFER_CHANGED`, `ACCEPTANCE_CONTENT_CHANGED`, `EXPIRED`,
   `SCOUT_CONTEXT_REQUIRED`, `NEED_AND_SIGNAL_REQUIRED`, `SIGNAL_REQUIRED`.
2. **English fallbacks**, used when the throw is not an `Error`. Complete list, verbatim:
   "The search status could not be changed." · "The match could not be updated." · "The source preference
   could not be saved." · "The source preference could not be saved. Your previous setting is still in
   effect." (SearchControlSettings' variant) · "The mandate could not be updated." · "The mandate could
   not be saved and activated." · "The Autopilot settings could not be saved." · "Autopilot could not be
   updated." · "The handoff could not be persisted." · "The exact action decision could not be
   persisted." · "The approved provider action could not be started." · "This action does not have a
   supported provider executor." · "The human completion state could not be saved." · "The mailbox
   message status could not be saved." · "The secure portal session could not be started." · "The
   controlled portal registration could not be started." · "The portal connection could not be paused." ·
   "The portal inbox could not be synchronized." · "The portal connection could not be created." · "The
   RoomScout email address could not be created." · "The RoomScout registration address could not be
   created." · "The portal connection could not be disabled." · "Live View is not available." · "The
   authenticated context could not be finalized." · "The browser run could not be stopped." · "The
   browser run could not be restarted." · "The search could not be saved." · "The draft could not be
   approved." · "The context could not be processed. Please try again." · "The acceptance could not be
   prepared. Nothing was sent." · "The acceptance could not be approved. Nothing was sent."

### 8.5 Rules for the port

- One key per string, never one key per language pair per screen: the same sentence appears on several
  screens (e.g. the "Not confirmed" / "All recurring costs stated" price line in both
  `ProviderOfferPanel` and `OfferAcceptanceDialog`).
- Interpolated strings must keep their slots: `Hey ${name}.`,
  `Ich behalte passende Räume in ${city} im Blick.`, `${n} of ${m} facts selected`,
  `${prefix} ${n} min ago`, `Remember ${n} fact(s)`, `${n}% match`, `${n} / ${m} facts ready`,
  `Linked to “${searchTitle}” and “${signalTitle}” · version ${n}`. Several need plural rules
  (`fact/facts`, `source/sources`, `second/seconds`, `signal/signals`).
- The safety sentences are legally load-bearing and must not be softened in translation: the
  „Eine verbindliche Zusage gebt nur ihr." family, "An assessment is not a booking or acceptance…",
  "This does not confirm a booking, signature, or payment.", "Nothing was sent.", "Analyzed, never
  stored", and the notifications/billing unavailability paragraphs (§1.9), which `ProfilePage.test.tsx`
  pins.
- Server-authored strings cannot be translated in the client: the two `searchSources` disclosures, the
  provider-conversation blocker prefix (§3.7), every `notifications` title/body (§7.1), and
  `assessment.summary` / `blockers` / `uncertainties`, which are model output. Either translate them
  server-side or show them as-is and label the language.
