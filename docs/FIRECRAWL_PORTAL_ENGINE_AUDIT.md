# Firecrawl portal engine implementation audit

Date: 2026-09-11

Scope: read-only completeness review of `FIRECRAWL_PORTAL_ENGINE_PLAN.md` revision 2 against the repository.
Verdict: **not release-ready**. The named implementation contracts now have substantial automatic coverage, but the root-owned full-suite/build verification is not recorded here and every live acceptance gate remains unproved.

Status meanings:

- **Implemented** — concrete product code and focused automated evidence exist.
- **Partial** — important behavior exists, but the full requirement or acceptance scenario is not proved.
- **Missing** — no operable implementation/evidence was found.
- **Live required** — local tests cannot establish the requirement.

This audit does not treat source-string assertions, setup prose, local experiments, or a provider's documented behavior as end-to-end proof.

## Residual verification requirements

1. **Deployment/function registration remains unproved.** At the 2026-09-11 root checkpoint, the full local suite reported 832 passed, 1 skipped across 136 passing files; the production build and scoped lint passed. A read-only dev function-spec showed 422 functions but no `firecrawlPortal` or maintenance identifiers after the accidental codegen upload attempt, so those functions must not be described as deployed or callable remotely.
2. **Whole-run budgets need live measurement.** Firecrawl registration now derives open, OTP scheduling, continuation, proof, and teardown allowances from the immutable reserved-run expiry, and reader/program calls use absolute deadlines. Real provider latency must still demonstrate that these budgets behave as intended.
3. **Cleanup retry needs live failure exercise.** `portalBrowserCleanup` performs bounded retries under a fixed deadline and validates the exact recorded owner/provider/session immediately before every attempt. A real provider stop failure/recovery and exhausted cleanup should still be observed without leaking diagnostics.
4. **Non-run cleanup is locally covered, not live-proved.** Write-proof, profile-proof, and recovery sessions register bounded durable leases with exact owner/connection/context/provider/session/deadline validation. The cleanup worker revalidates before every attempt and records completed/exhausted terminal state. Focused state/cleanup tests pass; provider-side failure behavior remains live evidence.

Resolved since the earlier audit: executable maintenance drain/switchback, same-profile classify-before-navigation recovery, maintenance fencing for inbox workers and scheduled write proof, and exact ordinary-message receipt reconciliation are now implemented with focused integration tests.

## §1 — Approved decision

**Status: Implemented automatically; live choice unaccepted.**

- `integrations/portalBrowserEngine.ts` resolves one deployment-wide provider; there is no connection-facing provider picker.
- `browserbasePortal.ts` dispatches compatibility entry points to the selected Firecrawl implementation where supported, and Firecrawl business actions apply a fresh selected-provider fence.
- `firecrawlInteract.ts` rejects controlled `roomscout.dev` targets, preventing the generic public-form path from becoming a portal bypass; `firecrawlInteract.portalGuard.test.ts` covers the exact host and malformed targets.
- `firecrawlProviderIsolation.integration.test.ts` uses throwing provider spies to prove exclusive routing at representative real entry points.
- Whether Firecrawl is reliable enough to be selected remains a §12 live decision.

## §2 — Selector, identity, and explicit errors

**Status: Implemented, with deployment configuration still unproved.**

- `portalBrowserEngine.test.ts` covers unset → Browserbase, explicit values, invalid nonempty values, and provider-specific missing credentials without accepting the other provider's key.
- `schema.ts`, `portalConnections.ts`, browser runs, and action executions persist actual `browserProvider`; absent legacy connection/context tags are interpreted as Browserbase.
- `portalBrowserState.integration.test.ts` covers initial provider pinning and rejects overwriting a Browserbase context with Firecrawl state.
- `reserveRun` requires an explicit provider, when supplied, to match the selector. `firecrawlProviderIsolation.integration.test.ts` covers attempted override.
- Stable Firecrawl profile names are connection context identity; run scrape IDs remain run cleanup/audit identity and are not advertised as resumable.
- The UI exposes selector errors and provider mismatch without leaking credentials or provider session IDs.

Missing live proof: actual selected deployment configuration, credential validity, and absence of accidental Browserbase requirements in a Firecrawl phase. During integration, generated/dev Convex functions were unexpectedly uploaded and are being verified by the root owner; this audit therefore does **not** claim that no deployment-side change occurred, nor that a provider was selected or accepted.

## §3 — Explicit switching and drain

**Status: Implemented automatically at the state/admission layer; operational exercise still required.**

Implemented defenses:

- Run claims, inbox-generation claims, continuations, session attachments, action claims, and final pre-submit reclaims compare selected and persisted providers.
- Cleanup paths can use the recorded provider without requiring that provider to remain selected.
- Mismatched connections render reconnect-required; no cookie/context conversion exists.
- `portalInboxSync.integration.test.ts`, `portalBrowserState.integration.test.ts`, and `firecrawlProviderIsolation.integration.test.ts` cover representative stale-provider claims and final-claim rejection.
- `externalActions.reapStaleExecutions` converts potentially-started stale work to `unknown` instead of retrying it.

`portalBrowserMaintenance.pauseForDrain`, bounded `drainBatch`, and
`resumeAfterSwitch` now provide the minimal executable procedure. Admission is
paused centrally; queued runs and unstarted writes are terminalized without
deletion; active and unknown work blocks readiness; resume requires an actual
selector change. The integration test proves a terminalized job remains terminal
after switch-away and switchback. `portalInboxSync.integration.test.ts` proves new,
manual, and already-queued worker admission is blocked during maintenance. This deliberately avoids claiming an atomic
hot switch or adding a broader generation framework.

## §4 — Reviewed driver and authorization

**Status: Mostly implemented.**

- Firecrawl registration and messages reuse `integrations/stagehandPortalDriver.ts` through deterministic Firecrawl primitives.
- `stagehandPortalDriver.test.ts`, `portalDomEvidence.test.ts`, and `portalWriteAdapters.test.ts` cover deterministic filling, DOM inspection, terms/origin boundaries, exact readback, one click, and final `beforeSubmit` rejection.
- `externalActions.ts`, `messageSafety.ts`, and `offerAcceptance.ts` retain ownership, exact approval/mandate, policy, active connection, provider, and lock checks. `executor: "browserbase"` remains only the documented compatibility authorization label; action executions separately expose the actual provider.
- Post-click uncertainty becomes `unknown`; repeat claims return the existing unknown execution and do not open another provider session. Isolation and write-adapter tests cover no replay.
- Visible CAPTCHA evidence produces a human boundary; Firecrawl has no solver path. Setup documentation states that disabling the portal challenge is a human prerequisite.

Partial evidence: the full exact-approval and standing-mandate suites exist, but a fresh full-suite result is not part of this read-only audit. Binding offer acceptance needs the §12 live boundary check.

## §5 — Saved-authentication proof

**Status: Implemented automatically; live persistence remains unproved.**

- Registration stops the writable session before opening a new `saveChanges:false` session using the same stable profile. `firecrawlPortal.test.ts` and `firecrawlProviderIsolation.integration.test.ts` cover ordering and prevent proof after a failed stop.
- `recordContextProbeResult` is the only registration path to Firecrawl readiness; `finishRun(contextReady:true)` cannot activate Firecrawl without that proof. Attempts, deadline, last attempt, and fixed error code are persisted.
- Failed/exhausted probes leave the context non-ready. Mandate registration and inbox/write eligibility require ready matching context.
- Approved writes call `markContextPendingAfterWrite` before the writable session. The final claim has a narrow exception only for the exact pending execution, matching active lock, provider, request, connection, generation, and deadline. After stop, a fresh profile proof calls `recordWriteContextProbe`.
- A confirmed send is finalized independently; stop/proof failure leaves the context blocked without changing the succeeded execution. Isolation tests cover this state transition and stale generations.

Missing/partial:

- Profile proof uses bounded attempts inside the immutable run deadline; post-write proof can continue through a generation-bound scheduled action that revalidates provider, execution, context, and maintenance state before allocation.
- No measurement establishes that readers can reopen during/after provider cleanup or that 120 seconds is sufficient.
- `firecrawlPortal.recoverProfile` uses generation-bound same-profile state, opens a read-only inspection session, and classifies authenticated / awaiting verification / auth needed / review before choosing a next step. It never navigates to signup. Recovery tests cover authenticated reuse and inspection failure; state tests cover stale recovery generations and prove OTP mailbox/timestamp selection from the latest authentication run despite a newer recon.

## §6 — Timeout, resume, and cleanup

**Status: Partial.**

Implemented:

- Firecrawl session creation and primitive calls receive bounded timeouts; registration OTP timeout terminalizes the run and stops the session.
- Firecrawl runs always expose `canResume:false`. Browserbase live view/resume endpoints reject Firecrawl run IDs with fixed unsupported errors.
- Live-view URLs are returned ephemerally and are not schema fields.
- Terminal paths make best-effort recorded-provider cleanup. Disable/reset truthfully report Firecrawl remote profile retention; Browserbase-only remote deletion is provider-tagged.
- Public and internal functions have validators and owner checks at the inspected entry points.

Missing/partial:

- Firecrawl registration uses the reserved run's immutable `expiresAt` across session open, OTP scheduling/continuation, proof, and teardown reserve; helpers refuse work when the remaining budget is exhausted. Runtime tests cover shared absolute primitive deadlines. Real timing remains a live gate.
- Firecrawl explicit recovery now inspects the same profile before action. An awaiting-verification result may create a new authenticate run using the prior authentication run's mailbox and request timestamp; it does not replay signup.
- Browserbase human runs now persist a distinct five-minute app inactivity deadline bounded by (and never extending) total TTL. Public `canResume` requires both deadlines; an exact-session touch mutation refuses expired runs. Browserbase live/resume actions must retain this pre-provider-call check in final integration.
- Browserbase live view calls the provider debug API (a useful availability check); no live evidence establishes availability/TTL behavior.
- Failed Firecrawl and Browserbase run stops schedule `portalBrowserCleanup`, which retries at most five times within 120 seconds. Every retry calls `validateProviderCleanup` against the persisted owner, original provider, and exact session ID without requiring that provider to remain selected. Terminal `finishRun` preserves that identity. Non-run proof/recovery sessions have a separate durable cleanup-lease contract; final transport coverage must be confirmed before treating those paths as closed.

## §7 — Read path

**Status: Implemented automatically; live late-profile behavior unproved.**

- `integrations/firecrawlPortalEngine.ts` runs a bounded generated inbox program, validates/deduplicates thread IDs, bounds output, and returns explicit partial/truncated/timed-out metadata.
- Generated DOM evidence asserts origin and authentication at inbox/thread reads. Returned structures pass strict parsing and existing sanitization before owner-scoped upsert.
- `portalInboxSync.ts` persists notification-requested thread IDs, cursor, partial/truncated/timed-out state, and generation/provider fences.
- `portalInboxSync.integration.test.ts` covers notification prioritization, cursor advancement, coalescing, bounded follow-up work, provider switch rejection, lock exclusion, and pagination beyond early rows.
- Missing threads do not drive deletion or semantic conclusions in the inspected sync code.

Live required: late-thread coverage under real navigation latency, reader deadline behavior, delayed profile persistence/409 behavior, and automatic notification-to-reply import.

## §8 — Component, programs, privacy, and containment

**Status: Mostly implemented automatically; vendor/privacy claims require live/vendor verification.**

- The vendored component adds one-attempt scrape creation, opt-in unsuccessful-envelope parsing, and zero retry for mutating Interact including transport failure. `extensions.test.ts` covers these cases.
- Program builders use async IIFEs and JSON-encoded values. `firecrawlProgram.test.ts` and contact-form/Interact tests cover structure and non-replay.
- Portal flows use code-owned programs/selectors, not Firecrawl prompt mode.
- Transport and portal boundaries map errors to fixed codes. Tests cover malformed output, secret-like content redaction, and the absence of raw provider response details in surfaced errors.
- Initial URL review occurs before allocation, generated operations include fresh origin assertions, and recon rejects cross-origin paths before opening a session.
- Generic public-form Firecrawl actions reject the controlled portal, while unrelated reviewed forms remain available.

Partial/live required:

- No captured provider diagnostic inspection proves that program text and arguments are absent from Firecrawl-side diagnostics/recordings.
- Regional hosting, cache/zero-retention option compatibility, recording behavior, and remote profile deletion capability have not been verified. Setup documentation correctly avoids claiming them.
- Firecrawl containment remains code-level origin/navigation checking, not a demonstrated network containment boundary.

## §9 — Required files and entry points

**Status: Covered broadly, with explicit unsupported Firecrawl capabilities.**

- State/schema: provider identity, readiness, reservation, stale connection-local run cleanup, and public validators are present. The stale-run test places unrelated rows ahead of the target connection.
- Scheduled registration: `mandateOrchestrator.ts` pins the selected provider; `runScheduledAgentRegistration` terminalizes pre-reserved configuration/mandate failures. State and isolation tests cover configuration cleanup.
- Portal modules: registration, continuation, recon, inbox reads, writes, stop, dispatch, and cleanup are provider-aware.
- Firecrawl live view, dead-session resume, human write continuation, and generic human authentication are deliberately unsupported and return fixed errors. The UI hides these actions using `canResume:false`; this is honest behavior, not implementation of those capabilities.
- Dispatch/claims: `messageSafety`, `offerAcceptance`, and `externalActions` revalidate stale work and provider state. The exact pending-write exception cannot admit a new execution.
- Inbox notifications/cron: generation and provider are persisted and rechecked before work; email ownership logic remains separate.
- Reset/disable: cleanup uses recorded provider, and Firecrawl local deletion does not claim remote deletion.
- UI: connection, operator, and run surfaces display actual provider/readiness/mismatch, expose no per-connection selector, and suppress Firecrawl resume.
- Public form path: exact controlled portal is rejected.

`platformInbox` invokes exact ordinary-message reconciliation only after importing outbound provider evidence; tests cover exact success, replay deduplication, ambiguity, body mismatch, and wrong owner. Firecrawl's unsupported live/human-session paths mean §1's statement that provider choice covers every named capability is satisfied by explicit unavailability, not feature parity; live acceptance must use flows that do not require those unsupported paths.

## §10 — Implementation-process exit gates

**Status: Substantial artifacts exist; integration gate remains open.**

- Slices A–E have corresponding implementation and focused tests for transport, state, primitives, orchestration, UI, and isolation.
- Actual provider metadata remains separate from the compatibility executor label.
- `FIRECRAWL_PORTAL_ENGINE_SETUP.md` is explicit that it is an implementation/operator procedure and not acceptance evidence.
- Root checkpoint on 2026-09-11: 832 tests passed, 1 skipped, 136 test files passed; production build and scoped lint passed.
- The read-only dev function-spec contained 422 functions but did not contain `firecrawlPortal` or maintenance identifiers after an accidental codegen upload attempt. Local code is therefore not evidence that these new functions are deployed.
- Deployment/function registration and all live gates remain open despite the green local checkpoint.

## §11 — Automated acceptance matrix

| Gate | Status | Concrete automatic evidence / gap |
| --- | --- | --- |
| 1. Selector truth table and missing keys | Implemented | `portalBrowserEngine.test.ts`; `firecrawlProviderIsolation.integration.test.ts` covers no cross-key fallback. |
| 2. Throwing opposite-provider spies | Implemented for representative entry points | `firecrawlProviderIsolation.integration.test.ts`. Not every exported wrapper has a throwing-spy test, but central fences and focused entry points are exercised. |
| 3. Switch at queued/claim/submit/human wait | Mostly implemented | Maintenance terminalizes queued work and blocks inbox admission; final claims and run continuations reject stale providers; cleanup uses recorded provider. A complete real human-wait provider switch remains an operational/live exercise. |
| 4. Switchback does not revive; unknown never replayed | Implemented at state/admission layer | Unknown no-replay is tested. Maintenance tests pause admission, terminalize queued work, require an actual selector change, and prove the old run remains terminal after switchback. Operational use is still a live gate. |
| 5. Pre-reserved config failure closes | Implemented | `portalBrowserState.integration.test.ts` and provider-isolation scheduled registration test. |
| 6. Delayed/409/failed probe pending; success activates; recoverable exhaustion | Partial | State and entrypoint tests prove only a successful fresh probe activates, failure remains blocked, and explicit recovery inspects the same profile. Real delayed persistence/409 timing and the 120-second budget still require live measurement. |
| 7. OTP timeout and safe explicit retry | Implemented automatically | OTP timeout closes the session/no fake resume; recovery opens and classifies the same profile and never replays signup. State coverage proves awaiting-verification recovery carries metadata from the latest authentication run despite a newer recon. |
| 8. One submit, unknown, receipt reconciliation | Implemented automatically | One-click/reclaim and unknown no-replay are covered. Acceptance and ordinary platform messages reconcile only from exact imported outbound evidence; ambiguous evidence remains unknown. |
| 9. Malformed/partial/wrong-origin/secret safety | Implemented broadly | `portalSafety.test.ts`, `firecrawlPortalEngine.test.ts`, runtime/program/component tests, and isolation cross-origin test. |
| 10. Recorded-provider cleanup and truthful deletion | Implemented locally | State/reset tests and provider-aware disable/reset code. Remote provider behavior remains live/vendor evidence. |
| 11. Browserbase tests, full suite, typecheck, build | Implemented locally | Root checkpoint 2026-09-11: 832 passed, 1 skipped, 136 files passed; build and scoped lint passed. This does not prove deployment or live provider behavior. |

## §12 — Live acceptance and release decision

**Status: Entirely unproved; live required.**

No repository test proves real provider acceptance, real AgentMail delivery, saved-cookie persistence, provider-side recording/retention behavior, or exactly-once external delivery. Before selecting Firecrawl for release, an authorized operator must record, without secrets or personal data:

1. Fresh test band registration using AgentMail and the numeric OTP.
2. Original session stop, followed by authenticated access in a new read-only session from the same profile.
3. One approved nonbinding message arriving exactly once with its provider receipt bound to the execution.
4. A real provider reply triggering notification-driven Firecrawl sync and consistent inbox/Scout/UI state without manual sync.
5. Later reads and writes from the saved profile after sessions have been closed.
6. Delayed persistence, timeout/restart, provider outage, CAPTCHA, and missing-key behavior with no Browserbase call.
7. Exact approval remaining mandatory for offer/commitment paths.
8. A complete drain, explicit Browserbase selection, and the independent Browserbase flow using a separate compatible connection—without claiming cookie transfer.
9. Durations, retries, Firecrawl credits/cost, regional behavior, recordings/diagnostics, retention, and deletion limitations.

The current ship gate therefore remains **closed**. Even after the remaining integration blockers are resolved, repeated live Firecrawl flow—not a local form fill—is required. If it fails, the release decision is to explicitly select Browserbase, not to add runtime fallback.

## Evidence classification summary

Automatic evidence is strongest for selector exclusivity, provider pinning, origin/form authorization, one-click/no-replay behavior, pending/recovered profile state, exact receipt reconciliation, maintenance drain/switchback, absolute run budgets, bounded cleanup retry, Browserbase inactivity state, read bounds, and truthful UI metadata. The green 2026-09-11 local checkpoint is recorded above; deployment/function registration and a complete real human-session switch lifecycle remain outside that evidence.

Live evidence is absent for both full provider phases, saved-profile durability, notification-driven reply import, exactly-once external delivery, operational drain, provider-side privacy/diagnostics, and measured timeout/cost behavior. None should be described as accepted or shipped until separately recorded.
