# Browserbase Component Migration

Status: Stagehand v4 browser/form smoke passed; full signup acceptance pending · updated 2026-09-10

## Stagehand v4 replacement — 2026-09-10

The user requested the actual v4 SDK execution model after reviewing the official
migration and prompting guides. The controlled portal now uses a Node action
with `browserbase.launch/connect`, `Stagehand.create`, and explicit
`observe`/`act`/`extract` steps. Primitive results are unwrapped from `data`.
The mounted local component retains session metadata only; its old hosted REST
transport and autonomous `agentExecute` surface are retired. The sections below
record the earlier REST implementation and are superseded for execution.

The browser runtime receives its keys explicitly. Model logging and caching are
disabled. Known DOM selectors use deterministic operations; observed candidates
must pass field-role and exact-value checks. Registration verifies the completed
form before submitting, including the mailbox address. An absent optional
display-name input is never inferred from a different field.

Each action closes its SDK resources. While waiting for an AgentMail code, the
remote Browserbase session remains available and the continuation reconnects to
that same session and page. Completed or failed runs explicitly release the
provider session. Existing mandate, final-submit claim, message readback and
receipt checks remain the authorization and completion boundaries.

An installed v4 package alone did not make the former REST component a v4
integration. Also, `observe` followed by exact `act` replay is explicitly
supported by v4; the observed form bug was missing target/value validation,
not evidence that replay itself is unsupported.

Verification: 622 tests pass across 101 files, with the opt-in local-browser
probe skipped. TypeScript, the production build, scoped ESLint and diff checks
pass. The runtime's emitted DOM expression is parsed and executed in a fixture,
and registration tests cover a later fill overwriting an earlier field with zero
submits. Development and production Convex backend deployments completed.

The original failure was reconfirmed directly as HTTP 402 (free browser minutes
exhausted). After the user restored provider capacity, both real Development
smokes passed through Stagehand v4: public navigation/extraction/observation and
reviewed demo terms followed by an exact email-field fill. Neither submits
signup. The earlier credential-free local probe timed out and remains opt-in;
it is not counted as a pass. Full signup/OTP and messaging acceptance remain open.

Failed-start recovery is now an explicit owner action. It accepts only the exact
reviewed demo source and the latest failed authentication run before a provider
session was attached, rejects live sessions, and restores that connection's auth
attempt budget at most once per daily window. It never registers, activates the
connection, sends a message or resets the global browser budget. The UI displays
structured cooldowns instead of raw nested Convex exceptions.

References: [v3-to-v4 migration](https://docs.stagehand.dev/v4/migrations/v3),
[prompting](https://docs.stagehand.dev/v4/best-practices/prompting-best-practices).

## Goal

Move the controlled `roomscout.dev` registration, inbox and message flows to the local Stagehand
REST fork while preserving the existing RoomScout write gates. Browser
interpretation may use `OPENAI_API_KEY`; Scout text generation and normalization
remain on the Convex AI Gateway.

## Fixed controlled-demo scope

- Exact origin: `https://roomscout.dev`; adapter: `roomscout-dev-v1`.
- Registration may generate one ephemeral, unpersisted password and submit one
  unambiguous 4–8 digit verification code from the user's AgentMail inbox.
- Browserbase's native CAPTCHA solver may solve the CAPTCHA. Custom bypasses are
  prohibited; an unsolved or ambiguous CAPTCHA stops.
- Free-account terms may be accepted only when their exact path and canonical
  content fingerprint match a pre-reviewed code-owned entry. Unknown, changed,
  or paid terms stop. Payment, contract, deposit, and booking steps always stop.
- The deployed `/sign-up` page was inspected read-only on 2026-09-09 before the
  controlled terms fixture existed; it showed Clerk's email/password form and
  no terms, price, contract, or CAPTCHA. The subsequently approved test fixture
  uses `/demo-terms/v1` and the exact SHA-256 evidence fingerprint pinned in
  `controlledPortalPolicy.ts`. Any changed content or path stops.

## Implementation sequence

1. Keep source, connection, adapter, host, HTTPS, and allowed-path checks as
   independent prerequisites before the registration policy helper runs.
2. Add the local Stagehand REST client inside the Browserbase execution
   execution boundary. Configure direct OpenAI credentials there, never in
   Scout generation or normalization.
3. Capture structured registration evidence: exact URL, terms presence/path and
   canonical fingerprint, native CAPTCHA outcome, and commercial/contract
   detection. Do not authorize from phrase-regex matches alone.
4. Evaluate that evidence with `controlledPortalPolicy.ts`; fail closed before
   every consequential submit when the surface changes.
5. Preserve the existing one-run reservation, global/source rate limits,
   provider session TTL/release, persistent-context ownership, AgentMail code
   coalescing, bounded polling, exact numeric-code validation, and circuit
   breaker/backoff behavior.
6. Add fixture tests for no-terms success, exact reviewed terms, changed terms,
   native CAPTCHA success/failure, commercial blockers, redirects, retry
   idempotency, and session cleanup. Run a provider proof only after local tests
   pass and explicit execution approval is present.

## Implemented boundary

- `convex/components/stagehandRoomScout` is a local MIT fork with provenance in
  `UPSTREAM.md`, mounted directly in `convex.config.ts`. It keeps the hosted REST
  protocol; this is not a rewrite around the Stagehand v4 SDK.
- Fixed arguments/results have Convex validators. Generic extraction schemas
  and results cross the component boundary as bounded JSON strings, preserving
  `$schema`, `$defs`, and `$ref`. The app client parses and validates extraction
  results with the requested Zod 4 schema. Component table IDs stay isolated.
- `stagehandPortalDriver.ts` uses observe/act/extract for UI interpretation and
  execution. A small read-only Node/CDP bridge checks actual URLs, rendered terms,
  authentication markers, composer contents and receipts. These exact facts do
  not depend on an LLM seeing hidden HTML attributes.
- `browserbasePortal.ts` retains existing ownership, mandates, rate limits,
  workpool coordination, mailbox polling and send ledger. It persists the engine
  on authentication runs so continuations do not change engine mid-session.
- Only `BROWSERBASE_EXECUTOR=stagehand` plus the exact controlled adapter selects
  the new engine. An unset switch keeps legacy behavior. Do not remove legacy
  code or enable production rollout before the shared acceptance test.
- OpenAI browser interpretation uses the existing `OPENAI_API_KEY`, with
  `BROWSERBASE_MODEL` optional (default `openai/gpt-4o`). Scout composition stays
  on the Convex AI Gateway. No credentials belong in client code or logs.

## Verified checkpoint

- Development backend pushed successfully with the mounted component and latest
  JSON transport. Browserbase project configuration was resolved from its sole
  existing project, without disclosing credentials.
- Real component smoke passed: session start, navigation, model-backed extract,
  observe, and normal cleanup (`stagehandSmoke:run`).
- Local checkpoint: 522 tests across 91 files, backend TypeScript, production
  frontend build and targeted backend lint pass. Repository-wide lint has
  unrelated existing design-system/UI findings; no blanket lint pass is claimed.
- Prop portal deployed to `https://roomscout.dev`. Its required demo terms gate
  was checked live through to the Clerk signup form, without creating an account.
  Portal checkpoint: 17 tests, typecheck, lint and build pass.
- Exact observed-action/variable form smoke passed on Development
  (`stagehandFormSmoke:run`): reviewed terms accepted, placeholder observed,
  reserved test value filled exactly, and session cleaned up. Signup was never
  submitted. This checkpoint does not claim registration or a message round trip.
- Provider probes exposed and fixed unsupported session options, extra fields in
  successful act responses, an empty CAPTCHA placeholder false positive, and
  build-injected references in serialized DOM callbacks. Fixed DOM expression
  strings now have an actual minified-build regression test.

## Shared E2E handoff

1. Use the main RoomScout frontend on localhost against Development. Keep the
   production RoomScout backend unchanged. At test start, enable the Stagehand
   switch on Development and confirm only the controlled source is selected.
2. The user signs into the main app as a demo band. On `roomscout.dev`, use a
   separate owner account and a controlled matching listing.
3. Let RoomScout provision its personal AgentMail inbox and create its own
   portal account; do not manually create that agent-side account first.
4. Observe known terms acceptance, registration, received numeric verification
   code, and persisted authenticated Browserbase context.
5. Start the non-binding search/outreach. Confirm a single exact message appears
   in the portal, then reply manually as the owner.
6. Observe Resend notification → AgentMail → coalesced Browserbase read → Scout
   interpretation and response. A commitment must still await exact approval.
7. Inspect application/provider logs together if a step stops; never retry an
   uncertain send blindly. Record only sanitized outcomes in public build logs.

Until these steps pass, the migration is ready for acceptance testing, not
declared end-to-end complete. No commit or push is part of this checkpoint.
