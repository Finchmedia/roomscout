# Portal browser: Firecrawl OR Browserbase

Revision 2 · 2026-09-11 · locally integrated and automatically verified; live acceptance pending.
Supersedes the three-engine/fallback and per-connection-override proposal.

## 1. Approved decision

One deployment selects ONE browser provider for the reviewed roomscout.dev portal:
**Firecrawl OR Browserbase**. No automatic provider fallback, mixed browser flow,
per-band exception or per-connection override in v1.

Firecrawl is preferred for sponsor alignment IF the complete flow is reliable
with Clerk bot sign-up protection disabled. Otherwise retain Browserbase as the
selected provider. Missing keys, outages and unsupported capabilities produce
explicit errors; they must never trigger work through the other provider.

The choice covers registration, authentication/recon, approved messages, inbox
and thread reads, live view, continuation, resume and human-step completion.
Firecrawl's public discovery/crawling and AgentMail's email work are independent
capabilities, not browser fallbacks. Unrelated public contact-form adapters are
outside this controlled-portal release; none may bypass its provider selection.

## 2. One selector, explicit errors

Public configuration: `PORTAL_BROWSER_ENGINE=firecrawl|browserbase`.

| Configuration | Required behavior |
| --- | --- |
| Unset | Browserbase, preserving the existing deployment behavior |
| browserbase | Existing reviewed Browserbase implementation only |
| firecrawl | Firecrawl implementation only |
| Invalid nonempty value | Configuration error; no browser work |
| Selected provider missing credentials | Provider-specific configuration error; no fallback |
| Connection belongs to other provider | Explicit reconnect required; no automatic signup |

Browserbase's existing `stagehand`/`legacy` runtime tags remain historical/internal
compatibility details, not public provider choices. `BROWSERBASE_EXECUTOR` cannot
override Firecrawl selection. Do not require a Browserbase key for Firecrawl portal
work. Existing untagged connections and contexts belong to Browserbase.

Persist provider identity before allocating a session. A profile is stable per
connection and provider, not recreated from every run ID. Never pass a Firecrawl
scrape ID/profile name to Browserbase SDK methods, or overwrite a Browserbase
context with a Firecrawl profile. No automatic cookie or account migration.

## 3. Switching is explicit, never a recovery fallback

V1 uses a documented maintenance/drain procedure; a one-click operator UI is not
required. An env flip cannot cancel an external request already in flight.

1. Pause new controlled-portal work. Drain active runs and submissions before
   changing provider; resolve unknown sends before allowing another message.
2. Change the deployment selector explicitly.
3. Before resuming work, invalidate/terminalize queued old-provider reservations
   and retries. Every worker, continuation, resume, session attach and final
   pre-submit claim checks the persisted provider against the selected provider.
4. Resume only connections authenticated with the selected provider. Other
   connections display reconnect required; do not recreate their portal accounts.
5. Old-provider cleanup may stop a session using its original provider. It may
   not continue reading, signing up, verifying or sending through that provider.

Switching back must not revive old queued jobs. The drain procedure must clear
them; if a future live switch is required, add a persisted generation fence and
two-phase quiescing rather than claim that an env variable makes it atomic.

Acceptance uses fresh test bands in separate provider phases, not a claim of
transferring authenticated sessions. Existing-account reconnect can require human
login. Never infer from an OTP timeout that no portal account exists.

## 4. Reuse the reviewed driver and authorization

- Registration and writes reuse `stagehandPortalDriver.ts` over Firecrawl
  primitives; the filename does not require an LLM/Browserbase implementation.
- Add deterministic `fillSelector` fallback only when `actInstruction` is absent.
  Keep before/after form inspection, exact value read-back and existing Browserbase
  behavior. Reuse the existing deterministic helper where possible.
- Preserve reviewed terms fingerprint, origin checks, one-submit gate and the
  final `beforeSubmit` re-claim. Provider selection is not authorization.
- Exact approval remains mandatory for commitments; existing standing-mandate
  restrictions govern nonbinding communication.
- Existing `executor: "browserbase"` may temporarily remain an authorization
  compatibility label. Retain every ownership, policy, active-connection and
  write-lock check. Store/show the actual provider separately and document the
  distinction. No new executor literal or automatic binding migration in v1.
- After a potentially dispatched click, timeout, killed program, lost response
  or missing receipt means unknown, never automatic resubmission via either engine.

Firecrawl has no CAPTCHA-solving path. A challenge stops the run explicitly.
Turning off portal Turnstile is a human-managed prerequisite, not a browser action
or bypass. No testing tokens/custom CAPTCHA code. Existing CAPTCHA policy remains
unchanged; append an engine-specific clarification only, without widening authority.

## 5. Prove saved authentication

Stop/DELETE and `cleanupQueued` do not prove that profile cookies are reusable.

1. Authenticate in the original session.
2. Stop it and mark the profile pending, not the connection active.
3. Open a NEW read-only session from the SAME profile. Verify reviewed origin
   and authenticated portal access, then stop the probe.
4. Only successful proof permits `contextReady: true` and follow-on automation.

Use bounded retry/backoff for busy profiles and delayed persistence. Initial
verification budget: 120 seconds, to be validated with measurements. Store attempts
and a deadline if retries are scheduled; at most one pending probe per connection.
Waiting is not proof. On exhaustion expose a recoverable profile-not-ready error,
not immediate reauthentication or a new signup. Readers during queued cleanup
need an explicit benchmark; do not assume `saveChanges:false` guarantees availability.

Registration and approved writes may save rotated login state. After a writable
session, dependent reopen work respects the readiness protocol. A confirmed send
stays confirmed even if subsequent profile persistence fails.

## 6. Timeout, resume and cleanup contract

- Budget the WHOLE run: opening, primitive calls, OTP polling, retries, profile
  verification and teardown. Respect Convex action/run deadlines; use scheduled
  profile verification if needed, with provider checks on every continuation.
- Use per-navigation timeouts and an overall reader deadline. A wall-clock check
  inside a loop does not interrupt a blocked navigation.
- OTP timeout closes the session/run with an explicit error and releases locks.
  Do not show a resume action for a deleted session.
- Explicit retry opens the same profile in a new session and inspects whether it
  is authenticated, awaiting verification, needs login or is blocked. No blind
  rerun of signup and no duplicate account creation.
- Keep human-required sessions only where the product genuinely supports resume.
  Respect absolute TTL AND inactivity timeout. A cached getUrl is not a heartbeat.
- Check session availability before returning live view; expiry estimates cannot
  promise provider availability. Never persist live-view URLs.
- Best-effort stop on all terminal paths, with safe cleanup retry. Preserve enough
  provider identity to clean up after disable/reset.
- If remote profile deletion is unavailable, mark the connection locally disabled,
  not remotely erased. Document retained authentication state truthfully.

## 7. Read path

One generated inbox program may reduce round trips. Reuse shared DOM expressions
and interpretation rather than fork the meaning of portal evidence.

- Check origin and authentication for every visited thread.
- Validate and deduplicate thread IDs before code-owned URL construction.
- Bound thread count, body size, navigation time and total execution time.
- Validate returned JSON before existing sanitization and owner-scoped upsert.
- Return partial/truncated state explicitly. Missing threads are not evidence
  of deletion, no reply, rejection or a missing offer.
- Preserve provenance, deduplication and owner/thread correspondence.
- Test late-thread coverage so repeated timeout batches do not starve the thread
  that triggered notification-driven sync.

## 8. Component, programs and privacy

Use the existing vendored component, with small documented changes:

- `scrapeOnce`, zero retry for billable session creation. Profile options passed
  at scrape creation. Do not allocate another session after an uncertain response
  without accounting for the original attempt.
- Opt-in return of HTTP 200 unsuccessful envelopes. Interpret success, result,
  exitCode and killed together; partial output from a failed program is not proof.
- Zero retries for mutating Interact, including non-2xx and transport failures.
  Preserve that rule when extending generic component error handling.
- Async IIFE code wrapper to avoid REPL declaration collisions/top-level returns.
  Fix existing contact-form builders with separate regression coverage.
- No Firecrawl prompt mode for these flows. Only code-owned selectors and programs;
  values are JSON encoded, never interpreted as code/instructions.
- Do NOT port local debug output: no body snippets, raw exceptions, program text,
  unfiltered stderr or credentials in persisted events/user errors. Map failures
  at the earliest boundary to fixed codes; test synthetic-secret contamination.
- Audit component action arguments/results and platform/provider diagnostics.
  JSON encoding is not encryption or a non-retention guarantee. Verify rather
  than assert that programs cannot appear in diagnostics.
- Cache/zero-retention options are not proof of no recordings. Persistent profiles
  intentionally retain authentication state. Verify option compatibility and
  document limits, including regional hosting and deletion capability.

Containment: reviewed URL before initial scrape, top-level navigation guard and
fresh origin assertion inside each fill/click program. Never rely on cached getUrl
for the security check. This is weaker than Browserbase network containment;
limit the engine to the reviewed controlled portal and state the difference.

## 9. Files and entry points that must be covered

- `portalConnections.ts`, `schema.ts`: provider identity, reservations, pending
  profile readiness, lock cleanup and backward-compatible validators. Expire stale
  connection-local runs correctly; a global take(10) must not leave them busy.
- `mandateOrchestrator.ts`: scheduled registration already reserves before the
  action. Pin provider there; configuration failure must close the pre-reserved run.
- `browserbasePortal.ts`, new `firecrawlPortal.ts`: manual/scheduled registration,
  recon/auth, inbox reads, writes, continuation, live view, resume, human-step
  completion and stop. Provider-specific modules may not bypass central selection.
- `messageSafety.ts`, `offerAcceptance.ts`, `externalActions.ts`: dispatch, claims
  and final pre-submit checks, including previously queued/executing work.
- `portalInboxSync.ts`, notification-triggered work and cron/retry entry points:
  no stale old-provider execution after switch; email ownership stays unchanged.
- `devUserResetActions.ts` and connection disable: provider-aware cleanup.
- Operator/connection/browser-run surfaces and readiness: display the selected
  provider honestly, disable stale-session resume, no per-connection engine picker.
- Existing public-form Firecrawl actions: cannot become an alternate entry point
  into the controlled portal that evades the global choice.

## 10. Sol-5.6 implementation plan

Parent owns architecture/contracts, integration review and final verification.
Implementation uses GPT-5.6-Sol subagents, with one writer per shared file.

| Slice | Ownership | Exit gate |
| --- | --- | --- |
| A: transport | Sol A: component api/interact/client, program toolkit, contact-form builders + tests | Sanitized output, IIFE/result behavior, zero retry for writes |
| B: state | Sol B: selector, schema, portalConnections, mandateOrchestrator + tests | Exclusive choice, provider pinning, profile readiness, reserved-run cleanup |
| C: primitives | Sol C: driver/helpers, Firecrawl runtime/read engine + tests | Same reviewed gates; fresh origin checks; bounded read programs |
| D: orchestration | Sol D after A–C: portal entry points, dispatch/claim, reset paths | Complete provider isolation through every lifecycle path |
| E: verification | Sol test agent after D: dedicated integration tests, minimal truthful UI/copy, setup docs | Both modes independently pass; real end-to-end gate remains explicit |

Agree exported interfaces before A–C run in parallel. D waits for them; no multiple
agents independently rewriting browserbasePortal.ts. Codegen/typecheck after schema
integration; parent reviews full diff and evidence, not only agent summaries.
No fixed delivery-time promise before profile lifecycle and privacy are validated.

## 11. Automated acceptance

1. Selector truth table, invalid values, missing keys; other provider credentials
   present do not enable fallback.
2. Throwing spies for Browserbase in Firecrawl portal tests, and vice versa.
   Discovery and email services are not part of this prohibition.
3. Switch before queued worker/after claim/before submit/during human wait:
   no stale-provider business action; consistent terminal state and lock cleanup.
4. Switch back does not revive drained jobs. In-flight unknown sends are never replayed.
5. Scheduled pre-reserved registration with configuration failure closes cleanly.
6. Delayed profile save, 409 and failed auth probe keep connection pending and
   prevent mandate work. Probe success alone activates; exhausted retry is recoverable.
7. OTP timeout and explicit retry use a new session with the same profile, no
   dead-session resume or blind duplicate signup.
8. Exactly one submit after re-claim; lost/killed result means unknown; later
   receipt reconciliation completes without another send.
9. Malformed/partial/wrong-origin inbox output and synthetic-secret errors are safe.
10. Cleanup uses recorded provider and never claims unperformed remote deletion.
11. Existing Browserbase tests, full suite, typecheck and build pass.

## 12. Live acceptance and release decision

Only designated test accounts/listings and approved nonbinding messages. Preparing
this plan does not deploy code, change provider/Clerk settings or send test mail.
Confirm live-test targets and deployment authority when executing those steps.

Firecrawl phase, with Browserbase unavailable to the portal execution path:

1. Fresh band → AgentMail inbox → registration → OTP.
2. Close original session; NEW session proves saved login before activation.
3. One approved message arrives exactly once; receipt bound to its execution.
4. Provider reply → notification → automatic Firecrawl sync → reply imported and
   consistent Scout/chat/UI state, without manual sync.
5. Close sessions and repeat later read/write from the saved profile.
6. Exercise delayed save, timeout/restart and unavailable provider: no fallback.
7. Exact-approval boundary for offer acceptance remains intact; the default live
   proof does not create a binding commitment.

Then drain and explicitly select Browserbase. Verify its independent flow using its
own authenticated test connection. Do not claim cross-provider cookie transfer.
Record durations/costs/outcomes without secrets or personal data.

**Ship gate:** repeated full Firecrawl flow, not just a local successful form fill.
If unmet, explicitly select Browserbase and leave Firecrawl portal execution off.
This is a release choice, not runtime fallback behavior.

## References / evidence limits

- Local experiments: scripts/firecrawl-local-*.mjs; not product implementations.
- https://docs.firecrawl.dev/features/interact
- https://docs.firecrawl.dev/agent-source-of-truth/node
- docs/BROWSERBASE_COMPONENT_MIGRATION.md

Reported signup/send/profile-reopen timings are observations, not service guarantees.
This revision records requirements and implementation ownership, not an integrated
end-to-end success claim.
