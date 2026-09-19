# Portal browser coordination with Workpool

2026-09-18 · Proposed implementation plan. Code and installed Workpool 0.4.11
were inspected; no runtime changes, deployments or provider messages belong to
this planning step.

## Status 2026-09-19

Trimmed cutover implemented three days before the demo: `browserWorkpool`
retries are opt-in (reads `retry: true`, writes `retry: false`); approved
portal writes enter the pool through `convex/portalWriteQueue.ts`
(`dispatchApproved`, `redispatchApproved` with `busyAttempt`, exact acceptance),
with an `onComplete` that only logs; the Firecrawl worker releases a claim that
strands before any provider call (`releaseUnstartedClaim`, audit event
`action.execution_released`, reason kept on `request.error` until the next
fresh claim) and reschedules `BROWSER_CONTEXT_BUSY` only after that release,
while any other pre-provider code parks the request as approved with its
reason and no automatic re-dispatch; both workers' busy chains re-enter the pool via
`redispatchApproved`; writes no longer wait on a merely queued inbox lease; the
gate's browser-busy wait is 30 s. The production error code from the incident
was not recoverable from the logs.

Deferred until after the demo: the per-connection coordinator with stored
WorkIds (section 3), admission ordering and fairness plus the mini-tests of
section 7, pool status queries and the queued/waiting/sending UI states
(section 5), manual refresh and the public `executeApprovedWrite` through the
pool, the epoch/drain cutover (section 6, step 5), and raising concurrency
above 1.

## Recommendation

Extend the existing browser Workpool into a common execution queue for portal
inbox reads and approved portal writes. Add a small admission coordinator per
portal connection, using the existing request ledger and inbox generations.
Keep browser leases, approval checks and write receipts as separate safeguards.

Workpool limits execution across the application. The connection coordinator
orders work against one logged-in browser profile. Neither replaces the other.
Two separate read/write pools would still collide on the same profile; a single
global pool alone would not protect against authentication or recovery sessions.

This is not evidence of a Firecrawl capacity limit. The observed lock contention
is application-side. Invalid inbox output is a separate result/timeout problem.

## 1. What exists today

| Area | Current implementation |
| --- | --- |
| Scout interpretation and message-safety assessment | `scoutWorkpool`, concurrency 2, up to 3 attempts |
| Notification/cron-triggered inbox reads | `browserWorkpool`, concurrency 1, up to 3 attempts |
| Simulated providers in the separate portal | `simulatedProviderWorkpool`, concurrency 3, up to 3 attempts; one active job per conversation |
| Approved portal writes | Native scheduled actions, plus direct public execution entry points; outside the browser pool |
| Manual inbox refresh | Direct action with an application lease; outside the browser pool |
| Browser mutual exclusion | Inbox generation/deadline, active write execution/deadline, browser context/run state |
| Main-app work status | Application records; returned inbox WorkIds are discarded |

Evidence: `convex/workpools.ts`, `convex/convex.config.ts`,
`convex/portalInboxSync.ts`, `convex/externalActions.ts`,
`convex/offerAcceptance.ts`, `convex/firecrawlPortal.ts`,
`convex/browserbasePortal.ts`; portal `convex/simulatedProviders.ts` and
`convex/simulatedProviderWorkpool.ts`.

Today, a read can own the connection while separately scheduled writes attempt
to start. The gate waits for two minutes before redispatching. A narrower
pre-claim race has its own bounded scheduler retries. The later
`BROWSER_CONTEXT_BUSY` path is not covered by that same retry branch and must be
handled without abandoning an execution claim. Inbox requests arriving during
a write can also be ignored until a later poll. These are coordination gaps.

## 2. Use the installed API, not the outdated status example

The linked docs and the installed package differ:

- Use `pool.status(ctx, workId)` or `pool.statusBatch(ctx, ids)` in a query.
- The discriminator is `state`, with `pending`, `running`, and `finished`.
- `WorkpoolOptions` in 0.4.11 has no `statusTtl` option.
- `finished` does not mean successful delivery. The implementation also returns
  it for an absent work record. Persist the business outcome through the worker
  and `onComplete`; do not infer success from queue status.
- `cancel` does not stop an already running action.

Sources: installed `node_modules/@convex-dev/workpool/src/client/index.ts` and
`src/component/lib.ts`; [official client source](https://github.com/get-convex/workpool/blob/main/src/client/index.ts),
[official status implementation](https://github.com/get-convex/workpool/blob/main/src/component/lib.ts),
[component overview](https://www.convex.dev/components/workpool).
No package upgrade is needed for this plan.

## 3. One admission path per connection

Add a small `portalBrowserQueue.ts` module. It selects the next eligible browser
operation for a connection and enqueues it in the existing component. Pending
writes remain `actionRequests`; pending reads remain inbox generations and
requested thread IDs. Do not introduce a second generic jobs framework.

1. Store the active operation's WorkId, operation kind, request/content version
   or inbox generation, provider/context generation, and ownership token on the
   connection. Store a write's WorkId/version on its request for status lookup.
   Add indexed connection/status access for pending approved requests.
2. At most one operation per connection is admitted to Workpool at a time.
   Enqueue and persist the assignment in the same mutation. Repeated triggers
   reuse the assignment rather than creating duplicate work.
3. A pending assignment is not an active browser session. Do not create an
   `actionExecution` or set `activeWriteExecutionId` during admission. Claim the
   execution inside the started worker; queue time must not consume the current
   ten-minute execution deadline. Track queue age separately.
4. Workers recheck connection ownership, provider, account/reset state, current
   approval and content version before accessing the browser. Existing exact
   approvals, idempotency keys and receipt validation remain authoritative.
5. Completion releases only the matching WorkId/token/generation and dispatches
   the next eligible operation. An old callback cannot clear newer work.
6. Retain inbox notifications during a write: persist valid owned read hints
   before checking browser availability. Coalesce repeated notifications and
   manual refreshes into one pending read with bounded requested thread IDs.
7. Process eligible writes in order; when both kinds are pending, alternate a
   write with one bounded inbox batch. This prevents repeated polls from starving
   writes and a burst of messages from starving replies. Reconciliation of an
   uncertain write precedes another write on that connection. Persist the
   connection's last/next operation kind. This is fairness between reads and
   writes on one connection, not a guarantee of cross-user fairness from Workpool.
8. Authentication, profile recovery and deletion continue to hold their existing
   exclusive leases. Their terminal transitions wake the coordinator, as do read
   completion, write release, stale-run expiry, reset/provider-change invalidation
   and maintenance reopen. These triggers must not release a Workpool assignment
   while an intermediate read attempt will still retry. An age-bounded watchdog
   handles missing completion, without assuming lease expiry proves a remote
   write did not happen.

Retain global concurrency 1 for the initial cutover. It serializes independent
users too, so it is deliberately a conservative starting setting, not the
multi-user target. After checking the configured Firecrawl session allowance
and queue/error measurements, raise it to 2 for independent connections. The
per-connection rule stays at 1. Do not create a component instance per user.

## 4. Retry rules and expected waiting

Change the browser pool default to `retryActionsByDefault: false`. Every read
enqueue explicitly opts into bounded retries; every write uses `retry: false`.
Update the read-only pool comments as part of the same change. Read retries reuse
the same assignment token/generation and deduplicate imported messages. Only the
final `onComplete` releases that assignment; attempt failure bookkeeping must not
make a safely retryable connection ineligible before the next attempt. The
unused execution-claim release below applies only to a race after worker start.

| Result | Treatment |
| --- | --- |
| Connection already in use before provider work | Persist waiting; release any provably unused execution claim; resume after release, with a bounded delayed wake-up as a backstop |
| Read timeout or invalid read result | Bounded read-only retry, then visible failure; preserve incomplete inbox work |
| Confirmed write receipt | Persist delivered once; duplicate enqueue/callback does not resend |
| Write may have happened, but no receipt | Persist uncertain outcome and enqueue read-only reconciliation; no automatic resend |
| Human action, revoked approval, reset or provider mismatch | Persist the actual blocked/canceled outcome; do not retry as a transient error |

Ordinary contention returns a typed waiting result, not an uncaught
`GATE_WAIT/browser_busy`. Normalize the pre-provider busy paths only after
checking the execution ledger. An error name alone is not proof that retry is
safe. Remove the overlapping native busy-retry chains only once the coordinator
owns all their callers. Time-based policy/circuit-breaker waits still retain
their real retry deadline.

The existing inbox result validation/recovery remains a separate invariant:
only a completed result belonging to that read invocation may be imported. A
scalar, timeout or missing result must never become a successful empty inbox.
Workpool cannot repair the result parser by itself.

## 5. Close bypasses and expose useful status

- Route notification, cron and manual refresh through the same read request.
- Route `dispatchApproved`, offer acceptance, redispatch and public browser-write
  entry points through the same approved-write admission path. Internal executor
  actions are worker-only. Preserve provider routing for legacy Browserbase
  callers; this is not a provider migration.
- Manual refresh currently returns completed counts synchronously. Change it to
  return acceptance/job identity and update Settings, OpsInboxPage and
  PortalOperationsPanel in the same change; do not show “synced” on enqueue.
- Keep generic Firecrawl contact-form execution and AgentMail outside this portal
  queue: they do not share the controlled portal profile. They retain their own
  approval and execution rules.
- Expose authenticated queries by owned request/connection IDs, not arbitrary
  client-provided WorkIds. Derive queue state from `status`/`statusBatch` and
  business outcome from the application ledger. WorkId is a correlation/cancel
  handle, not the sole authority for application state. Keep the final outcome
  even after Workpool's work record is gone.

User-facing states: “Queued”, “Waiting for the portal”, “Sending”, “Sent”,
“Checking delivery”, and a concrete failure/action-needed state. Inbox refresh
has its own reading/completed state. One pending indicator per operation; a
staged message must not simultaneously claim that nothing is happening.
Candidate fit/disposition remains separate from delivery progress.

## 6. Implementation and cutover order

1. Add optional coordination/status fields, validators and indexed access.
2. Implement coordinator, typed outcomes and completion handling; retain exact
   authorization and external-write ledger boundaries.
3. Change browser-pool retry policy and wire all read/write entry points,
   including manual refresh clients, together. Remove redundant busy scheduling.
4. Wire reactive user/operator status and small operational counters: queue age,
   wait reason, retries, invalid read results and uncertain writes. Never include
   message bodies, credentials or session secrets in metrics.
5. Use the existing maintenance window for a guarded cutover. Add a persisted
   coordinator epoch and require new workers to present its assignment token;
   old delayed workers without it must join/no-op through admission. Pause new
   operations, then cancel pending old browser-pool work and drain running
   operations. `cancelAll` does not stop running actions. Existing app records
   alone cannot prove drain because old WorkIds were discarded: inspect the
   component's pending/running work and the app's browser runs/executions before
   reopening. An uncertain remote execution requires reconciliation, not a
   blind lease clear. Install the legacy-worker guard before enabling new work.
   Changing pool defaults does not rewrite retry options already stored on jobs.
6. Resume pending approved work through the coordinator once. Do not replay
   failed, uncertain or already delivered historical messages. A reset, edit or
   provider change invalidates pending assignments; running actions still require
   safe completion/reconciliation.

One owner must handle the coordinator, `externalActions`, `portalInboxSync`,
pool configuration and worker contracts. UI status work can proceed independently
after that contract is defined. No Workflow component or Evalite integration is
needed for this bounded change.

## 7. Functional mini-tests only

Use fake browser responses at the provider boundary; no LLM calls or real sends.

1. Two writes plus an inbox notification on one connection run in order without
   overlap; the notification survives. A second connection can progress under a
   test pool configured for concurrency 2.
2. Contention before browser execution waits and resumes once; queue delay does
   not expire execution leases; a stale callback cannot release newer work.
3. A timeout after submission never resends; reconciliation can mark a receipt
   delivered once. Invalid inbox output cannot report a successful empty read.
4. Manual refresh and a queued message show waiting/running/final states correctly;
   ownership checks reject another user's operation. `finished` alone never
   marks a message sent.

Run scoped typechecks for changed backend/UI contracts. No full suite, repeated
large regression run, microphone test or historical provider-message replay.

Done when busy means observable waiting, all normal portal read/write paths use
one admission mechanism, confirmed delivery is distinct from work completion,
and multiple candidates can advance without losing inbox notifications or
resending uncertain messages.
