# Controlled portal browser engine setup

Status: implementation and operator procedure only. This document does not
claim a deployment, provider acceptance, saved-profile proof, or completed live
flow.

RoomScout selects exactly one browser provider for the reviewed
`https://roomscout.dev` controlled portal. Set the Convex deployment variable
`PORTAL_BROWSER_ENGINE` to `firecrawl` or `browserbase`. An unset value preserves
the existing Browserbase default. Any other nonempty value is a configuration
error. There is no automatic fallback, mixed flow, per-user override, or
per-connection selector.

This selector does not change Firecrawl's independent public discovery,
crawling, or Native Monitoring work. AgentMail remains the email provider.

## Provider configuration

For Firecrawl portal mode:

1. Set `PORTAL_BROWSER_ENGINE=firecrawl` in the Convex deployment environment.
2. Set `FIRECRAWL_API_KEY`. Browserbase credentials are not required for this
   mode.
3. Keep the roomscout.dev bot challenge disabled as a human-managed portal
   prerequisite. Firecrawl has no CAPTCHA-solving path; any challenge stops the
   run. Do not add testing tokens or custom challenge bypass code.
4. Keep Firecrawl discovery webhook and monitor settings configured according
   to their separate operational requirements. Portal selection alone does not
   make discovery or monitoring ready.

For Browserbase portal mode:

1. Set `PORTAL_BROWSER_ENGINE=browserbase`, or intentionally leave it unset for
   backward-compatible default behavior.
2. Set `BROWSERBASE_API_KEY`. A Firecrawl key does not enable Browserbase portal
   work.

Configuration checks establish only selector validity and credential presence.
They do not prove provider acceptance, authentication persistence, regional or
recording behavior, or an end-to-end portal flow.

## Drain and switch procedure

An environment-variable change is not a hot or atomic switch and cannot cancel
an external request already in flight.

The executable operator sequence uses the authenticated Convex functions below;
it never changes the environment selector and never deletes records:

1. Call `portalBrowserMaintenance.pauseForDrain({ drainingProvider })`.
2. Repeatedly call `portalBrowserMaintenance.drainBatch({ drainingProvider, limit })`.
   It terminalizes bounded queued runs and unstarted write claims. Do not proceed
   until `readyToSwitch` is true. Active runs/writes and every unknown write are
   reported as blockers and must be stopped/completed or explicitly reconciled.
   If an unknown receipt requires a same-provider inbox read, call
   `portalBrowserMaintenance.cancelDrain({ drainingProvider })`, perform only the
   reviewed reconciliation under the still-selected provider, then pause and
   drain again. Canceling a drain does not restore any terminalized job.
3. Change `PORTAL_BROWSER_ENGINE` outside RoomScout through the normal authorized
   deployment procedure.
4. Call `portalBrowserMaintenance.resumeAfterSwitch({ drainedProvider })`. It
   refuses unless the drain completed and the selector is no longer the drained
   provider. Terminalized jobs remain terminal if the selector is later switched
   back; they are never deleted or made eligible again.

Before resuming, configure the selected provider's credentials and complete the
verification gates below. Only connections belonging to that provider with proved
reusable authentication may run; others require explicit reconnect. Never copy or
reinterpret profile/context IDs across providers, or treat an OTP timeout as proof
that no account exists.

Old-provider cleanup may stop its recorded session, but cannot continue signup,
authentication, reading or sending. Firecrawl profile deletion is unsupported;
local reset disables/removes RoomScout state and reports the remote profile as
retained.

Switching back follows the same drain procedure. It must not revive old queued
jobs. Each provider phase uses a fresh test band or an explicitly reconnected
account; cross-provider cookie transfer is not supported.

## Authentication profile and reconnect rule

Stopping a session does not prove saved authentication. After registration or
another writable authentication session, open a new read-only session with the
same provider-specific profile, verify the reviewed origin and authenticated
portal contract, then stop that probe. Only that successful fresh-session proof
may mark the connection ready.

A pending, busy, or delayed profile remains pending. Retry within the bounded
profile-readiness budget. Exhaustion is recoverable `profile not ready`, not
permission to create a new profile or repeat signup blindly. A connection made
with the other provider displays reconnect required.

## Rate limits and request pacing

Firecrawl limits Interact executes per team and per minute, and browser
sessions per team in parallel. Measured on 2026-09-13: the Free plan allows
10 executes per minute and 2 parallel browsers, and a session stop (`DELETE`)
counts against the same minute window. Hobby allows 100 executes and 5 browsers,
Standard 500 and 25. The 429 body announces the wait ("retry after 57s").

The reviewed portal driver issues one Interact request per primitive, so a
registration is roughly 20 requests. Three rules keep that inside the window:

1. Requests of one session are spaced by `FIRECRAWL_INTERACT_MIN_INTERVAL_MS`
   (default 700 ms, about 85 requests per minute). Waits run locally, the page
   URL is reused from the previous program for two seconds, and field and
   evidence reads let the element appear inside the sandbox first.
2. A 429 is retried after the announced window when the request budget still
   covers it; otherwise the error carries `retryAfterMs` and the caller
   reschedules. Session stops retry within their budget and the scheduled
   cleanup waits out the announced window for up to five minutes.
3. Registration attempts use a profile name per run until the context is
   proven ready. A session that could not be stopped keeps a write lock on its
   profile for its whole TTL; a shared name would turn that into a 409
   (`FIRECRAWL_PORTAL_INTERACT_PROFILE_BUSY`) for every retry.

Do not retry a failed registration inside the same minute. Parallel portal
work (inbox sync, proof, registration) shares the team window, so keep the
inbox poll interval and the workpool parallelism at their defaults.

## Verification gates still required

Automated tests and configuration checks do not satisfy live acceptance. Before
shipping Firecrawl as the selected portal engine, prove repeatedly with approved
test accounts and nonbinding messages:

1. Fresh registration through the user's AgentMail inbox and numeric OTP.
2. Session stop followed by authenticated reopen from the same Firecrawl
   profile.
3. One approved message delivered exactly once with a receipt bound to its
   execution.
4. Provider reply notification followed by automatic inbox import.
5. Later reads and writes from the saved profile.
6. Delayed save, timeout/restart, provider outage, CAPTCHA, and unavailable-key
   behavior without Browserbase fallback.
7. Exact approval remaining mandatory for offers, agreements, bookings,
   payments, deposits, contracts, or other commitments.

Then drain and explicitly select Browserbase and verify its independent flow
with a separate compatible connection. If the repeated Firecrawl flow does not
pass, explicitly select Browserbase; do not implement runtime fallback. Record
durations, costs, and outcomes without secrets, personal data, raw browser
output, or ephemeral Live View URLs.
