# GPT-Live Voice Plan (client delegation, Convex Scout as the brain)

Status: plan and handoff only, nothing implemented · written 2026-09-13 from the
2026-09-11 evaluation · target reviewer: Codex

## How to read this document

Every claim below is tagged as one of three kinds so a reviewer can weigh it:

- **Verified in code**: read in this repository, with file and line.
- **Verified in docs**: read in the official GPT-Live documentation
  (markdown copies used for this plan: `guides/live`, `live-delegation`,
  `live-prompting`, `live-conversations`, `live-migration`, `voice-webrtc`,
  `voice-server-controls`, `voice-latency-cost`, `models/gpt-live-1`, the
  `live/sessions` create reference, and the launch blog).
- **Unverified**: an assumption, a conversion, or something the docs do not say.
  Collected in the "Unverified" section. None of this design has been executed
  against the real GPT-Live API yet; the spike in "Gates" is where that happens.

The plan deliberately keeps the working Realtime path untouched behind a
provider switch. Rollback is an environment variable, not a revert.

## 1. Findings

### 1.1 What the current voice path is (verified in code)

- The browser builds a WebRTC peer and the `oai-events` data channel, POSTs its
  raw SDP to the Convex HTTP action `POST /api/realtime/session`
  (`convex/http.ts:31-41`). `convex/voice.ts sessionHttp` (236-328) checks
  origin, content type, auth, Scout context, key and SDP, inserts a
  `voiceSessions` row, POSTs multipart `sdp` + `session` to
  `https://api.openai.com/v1/realtime/calls`, and returns the SDP answer with the
  session id in `X-RoomScout-Voice-Session`.
- The Realtime model reasons itself: session instructions are
  `scoutBaseInstructions` + case card + memory context + voice rules
  (`voice.ts:276-281`), and it calls eight tools declared in `realtimeTools()`
  (`voice.ts:219-234`). The browser forwards each function call to the public
  action `voice.executeTool` (330-413), which re-implements the tool
  declarations but lands on the same internal mutations the text Scout uses.
- The text Scout is `scoutAgent` (`convex/scoutRuntime.ts:11`) on the Convex AI
  Gateway model `openai/gpt-5.6-terra` (`convex/ai.ts:6-9`). `runScoutTurn`
  (`scoutRuntime.ts:21-61`) is a plain exported function, importable from any
  action: it assembles base instructions, case card, durable memory, semantic
  recall and provider progress, caps at `stepCountIs(6)`, aborts at 120 s, and
  returns `{ text, semanticRecallAvailable }`.
- Per-mode tool sets are built inside the closure of `scout.sendMessage`
  (`convex/scout.ts:377-539`), not exported. Voice duplicates the declarations.
- Voice and text share one Agent thread: `voice.recordTranscript`
  (`voice.ts:462-499`) saves each finalized transcript into the thread via
  `scoutAgent.saveMessage` and discards the returned message id.
- The client status machine, greeting and tool loop depend on Realtime events
  that GPT-Live does not have: `response.created/done`,
  `output_audio_buffer.*`, `conversation.item.*`, item ids, and
  `response.create` to speak (`src/hooks/useRealtimeVoiceScout.ts:287-345,
  413-437`).
- Defect, independent of this plan: `mark_search_brief_ready` is missing from
  the client tool allowlist (`useRealtimeVoiceScout.ts:235-243`). The model's
  call is dropped after its `call_id` was already marked handled (line 277), so
  no Convex action runs and no `function_call_output` is returned; the batch
  still sends `response.create`, so the model continues with the tool silently
  skipped rather than hanging. The server side is implemented and tested
  (`convex/scoutBriefReadiness.integration.test.ts`).

### 1.2 What GPT-Live is (verified in docs)

- Full duplex: the model listens while speaking and decides turns itself. There
  is no manual turn control, no `response.create` to make it speak, and no
  per-response completion event.
- The voice model never calls tools. It **delegates**. Two modes, fixed at
  session creation: **Responses delegation** (an OpenAI-hosted Responses model
  reasons and calls tools; the app still executes custom functions) and
  **client delegation** (the app receives `session.delegation.created` with an
  opaque `delegation.id` and no task text, works out the request from
  transcript deltas and its own state, and returns results with
  `session.commentary.append`, `session.thinking.append`,
  `session.instructions.append`, each a plain string of at most 500 tokens with
  a required `delegation_id`, `null` allowed).
- Session creation for WebRTC: `POST /v1/live/sessions` with JSON
  `{ session, transport: { type: "webrtc", sdp } }`, project API key on the
  server, returns 201 `{ session: { id }, transport: { sdp } }`. No ephemeral
  keys exist for Live. Creating a WebRTC session bills 15 s of voice time,
  credited against the running session.
- `instructions`, `model`, `audio.output.voice`, `input`, `store` and the
  delegation type are immutable after start. `session.update` only changes
  `delegation.responses` settings, so it is meaningless in client mode.
- `input` seeds prior conversation at start: up to 128 messages and 8,192
  rendered tokens, roles `developer`, `user`, `assistant`, one text part each.
- Transcripts arrive as `session.input_transcript.delta` and
  `session.output_transcript.delta` with `delta`, `start_ms`, `end_ms` on the
  session timeline. No item ids, no turn-completed event, speakers may overlap.
- Greeting: after `session.started`, send one `session.instructions.append`
  with `delegation_id: null`, wait for `session.instructions.appended`.
- `session.started` carries `expires_at`; `session.closed` carries
  `usage.seconds` and a reason (`close_requested`, `expired`, `content`,
  `remote_hangup`, `connection_lost`). The maximum session duration is not
  published.
- `client.data_channel.allowed_client_events` (strings or `"all"`) and
  `allowed_server_events` (selector objects `{ type }` or `"all"`) restrict what
  the untrusted browser may send and receive on the data channel.
- Pricing: $0.05 per minute of session time, billed per second; backend usage
  billed separately. Rate limits are concurrent sessions (25 at Tier 1). Free
  tier is unsupported. Knowledge cutoff July 2025.
- Voices listed for GPT-Live are English and Brazilian Portuguese; `marin` is the
  documented default. No language list is published. German is unmentioned.
- Data residency: `/v1/live/sessions` supports EU regional storage and
  processing with `eu.api.openai.com`, requiring MAM or ZDR and a retention
  amendment.

### 1.3 Options compared

| | Sprechen | Reasoning | Tools | Case card, memory, thread |
| --- | --- | --- | --- | --- |
| Today (Realtime) | OpenAI | OpenAI, `gpt-realtime-2.1` | Convex via browser | Convex, copied into the voice prompt |
| A: Responses delegation | GPT-Live | OpenAI Responses model direct | Convex via browser, same loop as today | Convex, copied into the backend prompt |
| **B: client delegation** | GPT-Live | Convex Scout agent on the Gateway | Convex, inside the agent turn like text | Convex, stays where it is |
| LiveKit Agents | GPT-Live or Realtime plugin | plugin backend or custom | worker process outside Convex | worker bridges to Convex |

Decision (founder, 2026-09-11): **B**. One brain, one thread, Gateway rule
intact, and the strongest Convex story. A is the fallback if measured
delegation latency is unacceptable. LiveKit is not for the submission (needs a
long-running worker outside Convex plus a LiveKit server), kept as a separate
post-hackathon piece.

Latency, high level: model inference dominates. A saves the Convex→Gateway hop
per LLM call but pays a browser→Convex→browser round trip per tool call; B pays
the Gateway hop once per LLM call and runs tools inside the same Convex action.
With two or three tool calls per turn the two roughly cancel. What matters is
the voice turn profile (reasoning effort, step cap, answer length) and whether
the voice model bridges the wait by talking.

## 2. Target architecture

**Roles.** The browser owns the WebRTC peer, the data channel and playback.
Convex owns the OpenAI key, the session config, the Scout brain, the thread and
every side effect. GPT-Live is ears and mouth. The browser is the relay and only
relays strings that Convex or a module constant produced. A server sideband
WebSocket is not used: a Convex action cannot hold a 15-minute socket.

**Flow.**

1. `connect()` builds peer, mic tracks, data channel and SDP offer as today.
2. Browser POSTs the raw SDP to the existing `POST /api/realtime/session`.
3. `sessionHttp` branches on `VOICE_PROVIDER`. For `live` it POSTs JSON
   `{ session, transport: { type: "webrtc", sdp } }` to
   `https://api.openai.com/v1/live/sessions`, reads 201, returns
   `transport.sdp` as `application/sdp` plus `X-RoomScout-Voice-Session` and a
   new `X-RoomScout-Voice-Protocol: live` header (added to
   `Access-Control-Expose-Headers`).
4. Browser applies the answer and waits for `session.started` (records
   `expires_at` and the provider session id through a Convex mutation), then
   sends the greeting instruction.
5. On `session.delegation.created` with `target: "client"`, the browser
   assembles the user's words since the previous delegation from
   `session.input_transcript.delta` fragments and calls the new Convex action
   `voiceDelegate.delegate`.
6. `delegate` claims the delegation id, runs one `runScoutTurn` on the shared
   thread with the real per-mode text tools under a voice profile, and returns
   a spoken summary plus a structured state snapshot.
7. Browser relays the summary as `session.commentary.append` with the original
   `delegation_id`, then pushes the state snapshot as `session.thinking.append`
   with `delegation_id: null`.

**Why this is one brain.** `delegation: { type: "client" }` means gpt-live-1
never calls a tool and never runs a Responses model. `voice.executeTool` and
`realtimeTools()` are unreachable on the Live provider; the eight duplicated
voice tool declarations stop being a second surface. The allowlist defect cannot
recur because readiness goes through the same `markSearchBriefReady` tool the
text path uses.

**Provider switch.** Server: `VOICE_PROVIDER=realtime|live`, default
`realtime`, any other non-empty value fails closed with 503 and no fetch (the
`PORTAL_BROWSER_ENGINE` precedent). Client: `VoiceSessionProvider` mounts both
hooks unconditionally (rules of hooks) and exposes the one selected by a small
public query `voice.getProviderConfig` that reads the server env, so a switch
needs no frontend rebuild. The response header is a consistency check: a
mismatch fails with the fixed string "Voice is misconfigured." A build-time
`VITE_VOICE_PROVIDER` was considered and rejected because the demo switch must
be one env change.

**Intentional duplication.** `src/hooks/useGptLiveVoiceScout.ts` is a second
hook with the same return surface as `useRealtimeVoiceScout`. The transport half
is duplicated on purpose so the Realtime demo path stays byte-identical.
Extracting a shared transport is a follow-up. Do not rename
`src/ui/chat/LiveVoiceChat.tsx`; it predates GPT-Live and means live voice chat
generically. New code uses a `gptLive` / `GptLive` prefix.

## 3. Design

### 3.1 Session creation (`convex/voice.ts sessionHttp`, new `convex/voiceLiveSession.ts`)

Keep the guard chain in its current order, then branch. Build the session
object in a pure module `buildLiveSessionConfig(input)` so it is unit-testable.

```
{
  model: OPENAI_LIVE_MODEL ?? "gpt-live-1",
  instructions: <voice prompt, 3.2>,          // immutable, ≤16,384 tokens
  audio: { output: { voice: OPENAI_LIVE_VOICE ?? "marin" } },  // no audio.format on WebRTC
  delegation: { type: "client" },
  input: <seeded history, below>,
  client: { data_channel: {
    allowed_client_events: ["session.thinking.append", "session.commentary.append",
      "session.instructions.append", "session.input_audio.mute",
      "session.input_audio.unmute", "session.close"],
    allowed_server_events: [{ type: "session.started" }, { type: "session.delegation.created" },
      { type: "session.input_transcript.delta" }, { type: "session.output_transcript.delta" },
      { type: "session.instructions.appended" }, { type: "session.thinking.appended" },
      { type: "session.commentary.appended" }, { type: "session.input_audio.muted" },
      { type: "session.input_audio.unmuted" }, { type: "session.usage.updated" },
      { type: "session.closed" }, { type: "error" }, { type: "info" }]
  } },
  store: false
}
```

Shape trap (verified in the create reference): `allowed_client_events` takes
bare strings, `allowed_server_events` takes selector objects. Restricting the
channel emits `info` with `code: "data_channel_permissions"`; log it, never
surface it.

Input seeding: new internal query `scout.getLiveSeed({ ownerId, threadId,
maxMessages, maxChars })` reusing `listUIMessages` as `scout.listMessages`
does. Newest-first accumulation until 20 messages or 12,000 characters
(unverified conversion, well under 8,192 rendered tokens), then chronological.
Confirm the page order `listUIMessages` returns before relying on the reverse;
the design never states it. `user` → `input_text`, `assistant` →
`output_text`, `system` dropped. Prepend one `developer` message with the
compact search-state snapshot, produced by the same internal snapshot query the
delegate action and the public snapshot query use (3.5). The assembled array
must stay at or under 128 items including the developer message, so the
history cap is 127 at most.

Response handling: branch on `response.ok` plus a parse guard on
`transport.sdp` (the docs show 201, but a 200 with a valid body must not brick
the session); a failed status, non-JSON body or missing `transport.sdp`
marks the `voiceSessions` row `error` and passes the status through with the
body truncated to 1,000 chars, as today; fetch throw → 502. On success flip the
row to `active`, store `providerSessionId` (opaque, server-side only), return
the SDP. `openSession` gains `provider`. The 15-minute `expireSession` schedule
stays. Never create sessions speculatively (15 s initialization charge).

### 3.2 Voice prompt (`GPT_LIVE_INSTRUCTIONS` in `convex/voiceLiveSession.ts`)

Frontend prompt only: persona, pace, backchannels, interruptions, delegation
policy in the docs' three-label form. Business rules, tool schemas and case
cards stay in `scoutBaseInstructions` and `buildScoutCaseCard`, used by the
delegated turn, never copied here. Draft:

```
You are Room Scout, a calm, friendly voice assistant for musicians looking for a rehearsal room.
Speak English. Speak warmly and naturally at an unhurried pace. Be clear and direct.
For routine questions, give one or two short sentences.

Backchannel policy: moderate backchannels; acknowledge without competing with the main response.
Interruption policy: stop speaking when the user interrupts and listen.

Delegation policy:
Backend tools:
- Search brief: read and change the draft room search (place, radius, budget, arrangement,
  days and times, requirements) and mark the brief ready for the musician to review.
- Musician memory: remember and recall durable facts about the band, instruments, gear, schedule.
- Opportunities: explain a listing in focus and continue an already authorized follow-up.
- Outreach: prepare a private message draft for the musician to review.
Delegate to the backend when:
- the user states, changes or corrects anything about the search;
- the user asks what is saved, whether the brief is ready, or what happens next;
- the user asks about a listing, a draft, or asks you to remember something;
- a correction changes work already requested;
- the answer needs reasoning beyond a simple reply.
Do not delegate when:
- the user greets, thanks, or asks you to repeat something;
- the answer is already in this conversation or in the latest search state you were given;
- you need one brief clarification first.
Delegate before giving any answer that depends on backend work. Do not guess the result while waiting.
Never say the search was started, sent, activated or approved, and never say a message was sent.
Only the musician starts the search, from the screen. Say only what the backend reported.
If a place name, number or date is unclear, ask about that one part instead of guessing.
```

Greeting: one `session.instructions.append` with `delegation_id: null` and a
module-constant text after `session.started`; wait for the matching
`session.instructions.appended`; treat an `error` carrying that
`client_event_id` as a failed greeting (log, no global error).

### 3.3 Delegation loop (browser: `src/features/voice/gptLiveRuntime.ts` pure, `src/hooks/useGptLiveVoiceScout.ts` effects)

State: a fragment buffer (last 400 `{role, delta, startMs, endMs}`), the offset
of the last delegation, a task revision counter, a set of claimed delegation
ids, and the existing generation/session/channel guards.

On `session.delegation.created`:

1. Ignore unless `delegation.target === "client"`, but log any other target as
   a bug signal (none should arrive in client mode). Duplicate guard on the id.
   Treat the id as opaque; bound it at 512 characters (the documented
   `event_id` limit) and never reject it on shape.
2. Bump the revision, record `offset_ms` as the new "since" boundary before any
   await, set status `thinking`. Only one delegation runs at a time per
   session: if one is in flight, hold the newest pending delegation and
   dispatch it when the running one resolves; an older pending one is
   superseded. This keeps tool writes in utterance order, which the correction
   story depends on (two overlapping turns could otherwise land the stale
   draft value last).
3. Assemble the utterance from fragments with `end_ms` after the previous
   boundary: consecutive same-role fragments concatenated verbatim (no
   trimming, no inserted spaces), role-labelled lines `Musician:` and
   `Scout (spoken):`, newest 4,000 characters. Only the window since the last
   delegation is sent; the Agent thread already holds the history.
4. If no user text exists yet (the docs warn a delegation can precede a
   complete sentence), do not call Convex; retry on the next input delta,
   debounced 1.2 s, hard deadline 4 s, then a `thinking.append` asking the model
   to clarify. Never fabricate an utterance.
5. Send a quiet progress `session.thinking.append` with the delegation id:
   "Working on this in the musician's search backend. Nothing has been started,
   approved, or sent."
6. Call `voiceDelegate.delegate({ voiceSessionId, delegationId, source:
   "delegation", revision, utterance, offsetMs })`.
7. On result: drop if the connection generation, session id or channel changed
   (existing stale-result guard), drop if the revision is stale, drop if
   `duplicate` with an empty summary.
8. Relay `spokenSummary` as `session.commentary.append` chunks with the original
   `delegation_id`, then the state push (3.5).

Chunking: the documented cap is 500 tokens per append. Use a 1,200-character
budget (unverified conversion, 40 % margin), split on sentence boundaries, at
most 4 chunks. The voice turn instruction bounds the answer to under 60 words, so
one chunk is the normal case.

Acknowledgements (`*.appended`) are matched by `client_event_id` for telemetry
only. An ack means accepted into the timeline, not consumed, spoken or heard. An
`error` whose `client_event_id` matches an outstanding append marks it
undelivered; no global error, no blind retry.

Typed input (`sendText`) calls the same action with `source: "typed"` and a
synthetic id; its result is relayed with `delegation_id: null`, because a
non-null id must name a known client delegation.

Backgrounded tab: browsers throttle timers when the tab loses focus, so the
not-ready debounce, the 4 s deadline, the caption flush and the status ticker
must use absolute timestamps evaluated on the next event or `visibilitychange`,
never rely on a timer firing on time. Document this as a known limitation.

Realtime-only leftovers: `voice.getInstructions` and the mid-session
`session.update` effect (`useRealtimeVoiceScout.ts:540-551`) are the Realtime
mechanism for refreshing the case card. They stay Realtime-only and are never
called on the Live path; the state push replaces them.

### 3.4 The delegate action (new `convex/voiceDelegate.ts`, `convex/voiceDelegations.ts`)

Signature: `delegate({ voiceSessionId, delegationId, source, revision,
utterance, offsetMs? })` → `{ spokenSummary, stateSnapshot, revision,
duplicate, activationRequired, briefReadiness, semanticRecallAvailable }`.
`stateSnapshot` is the structured object from 3.5, not prose; the browser
formats it.

Handler, in order:

1. `requireActionUserId`; `internal.voice.getOwnedSession` must be non-null and
   `active`, else `VOICE_SESSION_NOT_ACTIVE` (same guard as `executeTool`).
2. Normalise the utterance; reject empty or over 4,000 chars with
   `INVALID_MESSAGE` (the `scout.sendMessage` bound).
3. Claim: `internal.voiceDelegations.claim` reads
   `by_voice_session_and_delegation_id` and inserts in one mutation. Existing
   `completed` → return the stored summaries with `duplicate: true` (no tool
   re-runs); `running` → `duplicate: true` with empty summaries; `failed` or
   `abandoned` → retry, max 2 attempts. Refuse with
   `TOO_MANY_ACTIVE_DELEGATIONS` when a row is already `running` for the
   session (cap 1, so writes land in utterance order; the browser queues).
4. Live context: resolve `scoutContexts` by owner (live row), not by the thread
   id captured on the `voiceSessions` row. If the live thread differs from the
   session snapshot, use the live thread and record it on the session row; a
   thread change mid-session must never produce a permanent
   `THREAD_NOT_FOUND`. Then `internal.scout.getActionContext` for mode, case
   card, need and focus. This differs from `executeTool`, which authorizes
   against the `voiceSessions` snapshot. Document the difference.
5. Tools: `scoutToolsFor(ctx, { ownerId, threadId, mode, activeNeedId,
   focusedSignalId })`, a factory extracted from `scout.sendMessage` returning
   exactly today's per-mode sets.
6. Voice profile: `runScoutTurn(..., { origin: "musician", prompt: utterance,
   memoryQuery: utterance, caseCard: caseCard + VOICE_TURN_INSTRUCTIONS, tools,
   profile: "voice" })` with `stepCountIs(3)`, 20 s abort, no retries.
   `@convex-dev/agent` 0.7.1 forwards a per-call `stopWhen`
   (`dist/vercel/index.js:117`, verified in code), so no second agent instance
   is needed.
7. Thread: `generateText` with `prompt` saves the user and assistant messages,
   exactly as `scout.sendMessage`. A voice turn leaves two rows. The spoken
   paraphrase is not stored as the assistant message.
8. Snapshot: `internal.scout.getVoiceStateSnapshot` returns a structured object
   (mode, area, radius, budget, arrangement, schedule, requirements, brief
   readiness, focused listing title and city, pending approvals,
   `anythingSent: false`). It is returned as `stateSnapshot`. Prose is built
   in the browser so change sentences can be diffed against the last push. The
   same internal query backs a new public owner-scoped query
   `voice.getStateSnapshot`, which the hook subscribes to; `api.scout.getMine`
   alone cannot produce the summary because it omits the search fields.
9. Complete or fail the claim row. Failure copy must be honest: a tool may have
   run before a timeout, so say the outcome is uncertain and point at the screen.

`VOICE_TURN_INSTRUCTIONS` (appended to the case card): answer in English as one
to three spoken sentences under 60 words, plain prose, no markdown, lists, URLs,
identifiers or unverified numbers; state what changed or was found, name the
single next step, ask at most one question; never say the search was started,
activated, approved, or that a message was sent.

Side effects and approvals are unchanged by construction: the tools are the
text tools. `markSearchBriefReady` remains a readiness marker; activation is
only the user's click.

### 3.5 State push

Because instructions are immutable, the initial snapshot rides in `input` as a
developer message and every later change rides in `session.thinking.append`
with `delegation_id: null`. Push (a) after every delegated turn from the
returned `stateSnapshot`, (b) on a change of the public `voice.getStateSnapshot`
subscription (reactive over `scoutContexts` and `savedNeeds`), debounced
1.5 s, (c) once more when `session.usage.updated` reports
`context_window.usage_ratio > 0.9`, because the replacement voice engine only
inherits the original instructions plus 8,192 tokens of history. Never on a
timer. Skip when byte-identical to the last push. Target 400 characters, hard
cap 1,200.

Format (`formatStateSummary(next, previous)`): up to three explicit change
sentences ("The radius is now 20 km; it was 10 km."), one flat state line, one
lifecycle line that always states what has not happened ("ready for the
musician to review; it has not been started"), the focused listing title
(60 chars) and city if any, and always "Nothing has been sent." Plain facts
only: no identifiers, URLs, mailbox addresses, memory facts or listing bodies.

### 3.6 Transcripts and thread

Two records, one canonical. The Agent thread holds exactly two messages per
delegated turn, written by `runScoutTurn`. Captions and audit go to
`voiceTranscriptEvents`, one row per caption row, merged from deltas in the
browser, keyed by `providerEventId = "${role}:${rowStartMs}"` and upserted by a
new mutation `voice.recordLiveFragment` that never calls
`scoutAgent.saveMessage`. Do not add a flag to `recordTranscript`; it stays as
is for Realtime. New optional `startMs`/`endMs` columns carry the session
timeline. Raw audio is never persisted and `store: false` means no recording
exists at OpenAI either. The UI says once that captions can differ from the chat
transcript because the voice model paraphrases.

### 3.7 Status machine and UI

There are no response events. Keep `VoiceScoutStatus` unchanged so
`LiveVoiceChat` needs no prop changes. A pure reducer `nextVoiceStatus` runs on
every event plus a 250 ms ticker: `session.started` → listening; a claimed
delegation or `sendText` → thinking; first output delta or output meter above
threshold → speaking; speaking → listening after 900 ms without output deltas
and a quiet meter; thinking → listening when no delegation is pending and 1.2 s
passed since the last relay; `session.closed` or channel close → disconnected;
an `error` matching an outstanding append → no status change, any other error
→ error while keeping the connection (moderation can cut speech without ending
the session). Additive hook fields: `userSpeaking`, `backendActivity`.

`LiveVoiceChat`: one status-area line bound to `backendActivity` outside the
caption bubbles; the interrupt control says it stops the speech, not the work;
new label keys in `LiveVoiceChatLabels`. The shared context value is typed
`ReturnType<typeof useRealtimeVoiceScout>` today
(`src/components/voice/VoiceSessionContext.ts`), so declare an explicit
`VoiceSessionValue` interface with `userSpeaking` and `backendActivity`
optional, and update the two session fixtures (`LiveVoiceChat.test.tsx`,
`RealtimeVoiceScout.test.tsx`).

Session helper: `createRealtimeSession` returns only `{ answerSdp,
voiceSessionId }`; extend `RealtimeSessionAnswer` with the protocol header and
enforce the provider match inside the shared helper so both directions are
guarded. Today a Realtime client against a Live server would apply the answer
and then send `session.update` and `response.create` into a session that
rejects them.

Interrupt: mute local playback immediately, send a constant
`session.instructions.append` ("Stop speaking now. Wait for the musician to
finish, then respond briefly."). Resume playback only on an output-quiet
condition (the output meter below threshold for a held interval, 600 ms
proposed), never on the ack: the docs say an instruction acknowledgment is not a
resume signal, and muting a live WebRTC element discards nothing, so resuming
on the ack would land mid-sentence. It does not bump the revision and does not
cancel the in-flight delegate. Mute: disable the local track and send
`session.input_audio.mute/unmute`.

### 3.8 Interruption, revision, duplicates

Revision is the only cancellation mechanism; client delegation has no cancel
event. The revision increments on a newly claimed delegation and on a typed
correction, not on interrupt, mute or state push. A stale result is dropped
silently; its work is not lost, the turn is already in the thread and the side
effect already happened. A mid-delegation correction produces a second
delegation whose turn reads the live `savedNeeds` row and corrects it.
Corrections are resolved by backend state, not by cancellation; write that into
a code comment. The Scout never claims a cancellation. On `connect()`, orphaned
`running` claims of the owner's previous sessions are marked `abandoned`.

### 3.9 Lifecycle and limits

`session.started` gives `expires_at` (Unix seconds): store it, attach the
provider session id, set the client timer to `min(expiresAt, connectedAt +
MAX_VOICE_SESSION_MS)`; extract the duplicated 15-minute literal into
`convex/voiceLimits.ts`. Graceful close: send `session.close`, keep the
transport alive until `session.closed` (up to 5 s), record `usage.seconds` and
`reason` on `voiceSessions`, then clean up; on timeout mark `finalized: false`.
`session.usage.updated` values are cumulative; write only at close. Reconnect
is always a new session seeded from the thread, never a fork, never
`store: true`. Errors: rejected command (matching `client_event_id`), moderation
cut, or fatal; `immutable_field_update` is a bug signal since the Live path
never sends `session.update`. Rate limit is concurrent sessions; the existing
`activeVoiceSessions` ops metric is the gauge.

### 3.10 Security and privacy

`OPENAI_API_KEY` never leaves Convex; there are no ephemeral secrets for Live.
The data-channel allowlists are enforced by OpenAI. No user text ever becomes
an instruction or a commentary: the three content builders are module constants
or pure functions of a server-returned snapshot, and commentary is the verbatim
`spokenSummary`. `safeGptLiveError` returns fixed strings only. Origins reuse
`REALTIME_ALLOWED_ORIGINS`. Threat model, accepted and documented: a user with
devtools can make their own session say anything; nothing durable changes,
because every side effect goes through `delegate` with auth and ownership, and
the thread stores the Scout's own answer, not the paraphrase. AGENTS.md
compliance: reasoning stays on the Gateway; the sentence permitting the direct
key for "the approved Realtime WebRTC voice flow" must be amended to "the
approved WebRTC voice session flow (Realtime or GPT-Live, client delegation)" in
the same change as the Live branch.

### 3.11 Env and schema (all additive)

- `VOICE_PROVIDER=realtime|live` (default realtime), `OPENAI_LIVE_MODEL`
  (default gpt-live-1), `OPENAI_LIVE_VOICE` (default marin, validated against
  the documented names), `LIVE_VOICE_LANGUAGE` (default English),
  `LIVE_SEED_MAX_MESSAGES=20`, `LIVE_SEED_MAX_CHARS=12000`. All Convex
  deployment env, documented in `.env.example`.
- `voiceSessions`: optional `provider`, `providerSessionId`, `expiresAt`,
  `usageSeconds`, `closeReason`, `finalized`.
- `voiceTranscriptEvents`: optional `startMs`, `endMs`.
- New table `voiceDelegations` (ownerId, voiceSessionId, delegationId, source,
  revision, status running|completed|failed|abandoned, attempts,
  utteranceChars, spokenSummary?, stateSnapshot? (structured, for idempotent replay), error?, startedAt,
  completedAt?, durationMs?) with indexes by session+delegationId,
  session+status, owner+startedAt. The utterance text is not stored here; it is
  the thread's user message.
- `providerReadiness`: extend the `openaiDirect` row with voice provider fields;
  keep `serverProviderCount: 5`. `ops.ts`: title "GPT-Live Scout session" for
  live rows, plus a delegation count.

## 4. Gates

### G0: access and spike (before any repo change, half a day)

Standalone Node server plus static page in the scratchpad, like the Firecrawl
proofs. Criteria, measured over at least 10 runs:

1. gpt-live-1 is enabled on the project key; tier is not Free.
2. Time to first audio (connect click → first greeting output delta): median
   ≤ 2.5 s, p90 ≤ 4 s, and not more than 1 s worse than Realtime on the same
   machine (measure Realtime first).
3. Delegation round trip with a real Scout turn (delegation event → first
   commentary ack, `runScoutTurn` on the Gateway with tools): median ≤ 3 s,
   p90 ≤ 6 s, no run over 12 s; our own overhead under 30 % of the server time.
4. First useful spoken word after the user stops speaking: median ≤ 4 s.
5. Delegation decision quality on 15 scripted English utterances, run twice:
   must-delegate ≥ 6/7, spurious delegations ≤ 1/5, and zero fabricated values or
   action outcomes. One fabricated "I've started your search" fails the spike.
6. `expires_at` read from `session.started`; record the value.
7. `session.close` → `session.closed` within 5 s in ≥ 9/10 runs, with
   `usage.seconds` and reason `close_requested`.
8. State-push effectiveness: after a radius change, "what radius did we say?"
   answered correctly from the pushed state in ≥ 8/10 runs, never invented.
9. Cost sanity: a 5-minute conversation ≈ $0.25 voice plus Gateway tokens.
10. Allowlist evidence: the `info` notice with code `data_channel_permissions`
    arrives after session start, and the greeting works with the restricted
    channel. Its absence is a spike failure, not a pass.
11. Ordering: two overlapping delegations that both write the draft end with
    the value of the later utterance, not the later completion.

Rollback trigger: criterion 3 p90 over 6 s, or any hard-gate failure in
criterion 5, means `VOICE_PROVIDER=realtime` for the 2026-09-22 submission. The
Live code stays merged behind the switch. This is a pure env change only
because the client selects the provider at runtime (section 2); a build-time
client flag would make rollback a rebuild and redeploy, which is why it was
rejected.

### G1: parity

The existing suite passes unchanged for the Realtime provider; the
brief-readiness parity test proves the delegated path produces the same durable
state as the Realtime tool path.

## 5. Work breakdown

Slices A–C can run in parallel with clear file ownership. Effort is for one
engineer; with subagents it compresses, the critical path is C2.

| ID | Slice | Item | Files | Effort | Depends on |
| --- | --- | --- | --- | --- | --- |
| W0 | – | Fix the Realtime allowlist defect and add an allowlist-parity test. Ship regardless of GPT-Live. | `src/hooks/useRealtimeVoiceScout.ts`, its test | 15 min | – |
| S1 | A | Extract `scoutToolsFor` from `scout.sendMessage` (byte-identical behaviour); add `profile` to `runScoutTurn` (per-call `stopWhen` is forwarded, no second agent) | `convex/scoutTools.ts`, `scout.ts`, `scoutRuntime.ts` | half day | – |
| S2 | A | Schema, env, `voiceLimits.ts`, readiness fields, ops title | `schema.ts`, `voiceLimits.ts`, `providerReadiness.ts`, `ops.ts`, `.env.example` | half day | – |
| V1 | B | Live session creation branch, pure `voiceLiveSession.ts`, `scout.getLiveSeed`, protocol header, `openSession.provider` | `voiceLiveSession.ts`, `voice.ts`, `scout.ts` | 1 day | S2 |
| V2 | B | `voiceDelegate.delegate` (structured `stateSnapshot`, live thread resolution, cap 1 running), `voiceDelegations` claim/complete/abandon, internal `scout.getVoiceStateSnapshot` plus public `voice.getStateSnapshot`, `voice.recordLiveFragment`, `attachProviderSession`, `endMine` extension | `voiceDelegate.ts`, `voiceDelegations.ts`, `voice.ts`, `scout.ts` | 1–1.5 days | S1, S2 |
| C1 | C | Pure browser runtime: fragment store, `assembleUtterance`, `chunkForAppend`, `nextVoiceStatus`, `formatStateSummary`, constants, `safeGptLiveError` | `src/features/voice/gptLiveRuntime.ts` | half day | – |
| C2 | C | `useGptLiveVoiceScout` hook: transport, greeting, delegation loop with single-flight queue, state push from `voice.getStateSnapshot`, interrupt with output-quiet resume, mute, typed input, graceful close; extend `createRealtimeSession` / `RealtimeSessionAnswer` with the protocol header and guard both directions | `src/hooks/useGptLiveVoiceScout.ts`, `src/hooks/useRealtimeVoiceScout.ts` (helper only) | 1–1.5 days | C1, V1, V2 |
| C3 | C | Provider selection in `VoiceSessionProvider` (both hooks mounted, server-selected via `voice.getProviderConfig`), explicit `VoiceSessionValue` interface, both session fixtures, `LiveVoiceChat` status line and labels | `VoiceSessionProvider.tsx`, `VoiceSessionContext.ts`, `LiveVoiceChat.tsx`, `LiveVoiceChat.test.tsx`, `RealtimeVoiceScout.test.tsx` | 3–4 h | C2 |
| D1 | – | AGENTS.md wording, `.env.example` docs, BUILD_LOG entry | `AGENTS.md`, `.env.example`, `docs/BUILD_LOG.md` | 20 min | lands with V1 |
| T1 | C | Pure runtime tests | `gptLiveRuntime.test.ts` | 3–4 h | C1 |
| T2 | B | convex-test for session creation with mocked fetch, provider parity | `convex/liveSession.integration.test.ts` | half day | V1 |
| T3 | B | convex-test for delegate: happy path, duplicate, authorization, readiness parity, thread-duplication guard | `convex/voiceDelegate.integration.test.ts` | half day | V2, S1 |
| T4 | C | Hook tests mirroring the four Realtime guards plus close and interrupt | `useGptLiveVoiceScout.test.tsx` | 3–4 h | C2 |

## 6. Tests (what each must prove)

- Pure: verbatim fragment concatenation and windowing; sentence-boundary
  chunking with the 4-chunk ceiling; status transitions including the
  rejected-append case; caption rows keyed by `${role}:${startMs}`; fixed error
  strings; state summary with change sentences, size caps and no identifiers.
- Session creation (mocked fetch): exact body (model, `delegation.type`,
  `store: false`, no `audio.format`, allowlist shapes, seed limits), 201
  handling, error pass-through, 502 on throw, Realtime parity when the flag is
  unset, 503 without fetch on an invalid flag.
- Delegate: two thread messages per turn; duplicate delivery runs the model
  once; authorization errors; concurrency cap of 1 with the queued second
  delegation landing in utterance order; live thread resolution after a
  `scoutContexts.threadId` change; readiness parity with
  `scoutBriefReadiness.integration.test.ts`; `recordLiveFragment` never writes
  to the thread.
- Allowlist evidence: a test that the `info` notice with code
  `data_channel_permissions` is observed and logged.
- Hook: late results after disconnect send nothing; stale revision sends
  nothing; delegation before any transcript waits for the first fragment;
  interrupt mutes and sends one constant instruction; close waits for
  `session.closed` up to 5 s and passes usage to `endMine`.
- Regression: `VoiceSessionProvider.test.tsx` and `providerReadiness.test.ts`
  keep passing; no env value leaks into serialized readiness.

## 7. Review checklist for Codex

Run through this before accepting the plan; each item is a place the plan could
be wrong. An independent adversarial review of the underlying design
(2026-09-13) confirmed the protocol contract against the docs and found the
contradictions that section 3 now corrects; its checks are folded in here.

1. Assert the create body structurally: `allowed_client_events` bare strings,
   `allowed_server_events` objects with only `type`, no `response_event`,
   `audio.format` absent, `delegation.type === "client"`, `store === false`,
   model inside `session` and not in the URL.
2. Assert `session.input` has at most 128 items including the leading
   developer message, roles limited to the three accepted ones, one content
   part each, no `id` or `status`; confirm the page order of `listUIMessages`.
3. Confirm the browser data channel delivers `session.delegation.created` and
   both transcript delta types without a sideband, and that the `info` notice
   with code `data_channel_permissions` actually arrives.
4. Confirm the 500-token append cap and pick your own character conversion;
   the 1,200-character budget is an assumption.
5. Confirm the greeting recipe works with the restricted data channel.
6. Verify `voice.getStateSnapshot` is public, owner-scoped and feeds the state
   push and the seed; `api.scout.getMine` alone cannot produce the summary.
7. Verify the delegate return carries a structured `stateSnapshot`, never a
   prose string.
8. Run two overlapping delegations that both write the draft and assert the
   final `savedNeeds` value matches the later utterance, not the later
   completion; the single-flight queue and cap of 1 exist for this.
9. Replace any 201 equality check with `response.ok` plus a `transport.sdp`
   parse guard; add a 200-response test.
10. Declare `VoiceSessionValue` with optional `userSpeaking` and
    `backendActivity` and update both session fixtures before C3.
11. Extend `RealtimeSessionAnswer` with the protocol header and enforce the
    match in the shared helper; test a Realtime client against a Live server.
12. Replace unmute-on-ack in `interrupt()` with an output-quiet condition and
    assert resume never lands mid-sentence.
13. Change `scoutContexts.threadId` mid-session and confirm the delegate
    resolves the live thread rather than failing `THREAD_NOT_FOUND` forever.
14. Check that extracting `scoutToolsFor` keeps `scout.sendMessage`
    byte-identical (the tools capture `ctx`, `ownerId`, `threadId`).
15. Assert exactly 2N thread messages for N delegations plus M caption rows,
    and that `recordLiveFragment` does not import `scoutAgent`.
16. Check `expiresAt`, the 15-minute cap and the scheduled `expireSession`
    interact correctly; check `Access-Control-Expose-Headers` includes the
    protocol header; check the AGENTS.md amendment lands with V1.
17. Confirm rollback is a pure env change because provider selection is
    runtime-readable on the client; if a build-time flag is chosen instead,
    stop describing rollback as one line.
18. Measure delegation round-trip p90 with tools enabled (G0 criterion 3)
    before starting C2 and C3; if criterion 3 or 5 fails, keep Realtime.

## 8. Unverified

- Maximum Live session duration and any idle timeout; only `expires_at` exists.
- Whether the same `delegation.id` can be delivered twice, and when.
- Whether a `commentary.append` for an older delegation is accepted after a
  newer one was created.
- Character limits on appends beyond the 500-token cap; the tokenizer behind
  the 8,192 rendered-token seed limit.
- Whether misspelled allowlist entries fail at creation or are ignored.
- Whether the model signals an intent to delegate before the event (no such
  event is documented).
- Whether moderation cuts carry a distinguishing error code.
- The page order `listUIMessages` returns for the seed.
- Timer throttling in a backgrounded tab versus the debounce, deadline and
  flush intervals.
- Convex HTTP action outbound body limits versus the seeded `input`.
- Behaviour of the real endpoint from the Convex runtime (201, body, errors).
- Project access to gpt-live-1 and the tier.
- Whether the live model treats a `developer` seed message as trusted state.
- German voice quality (the demo is English by decision).
- Realtime latency baseline on the demo machine.

## 9. Decisions for Daniel

1. Approve the AGENTS.md wording amendment (direct key for the WebRTC voice
   session flow, Realtime or GPT-Live).
2. Accept the both-hooks-mounted provider selection for a rebuild-free switch.
3. Accept that captions and chat transcript differ (paraphrase), stated once in
   the UI.
4. Confirm the rollback trigger thresholds in G0.

## 10. Follow-ups (not in this plan)

- Shared WebRTC transport module for both hooks.
- Delete the unmounted legacy `RealtimeVoiceScout` component.
- A German voice test once GPT-Live publishes a language list.
- LiveKit Agents variant as a separate post-hackathon repository.
- Responses delegation (mode A) as an alternative backend behind the same switch
  if G0 latency fails.
