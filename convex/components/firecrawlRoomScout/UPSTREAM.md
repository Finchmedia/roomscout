# Upstream provenance and extension delta

## Source

- Project: [Firecrawl Convex component](https://github.com/firecrawl/firecrawl-convex)
- Package: `@firecrawl/firecrawl-convex@0.1.1`
- Commit: `d4056f1e70b6a459ed88df2bb97fa2016816a751`
- License: MIT, Copyright 2026 Firecrawl; copied in [`LICENSE`](./LICENSE)

The official source was inspected and vendored on 2026-08-31. This fork is kept
inside the RoomScout repository so the beta Native Monitoring and Interact
surfaces can be tested without replacing any upstream capability.

## Preserved upstream surface

The following are copied from the upstream component and remain behaviorally
intact:

- `schema.ts`: `crawls` and `pages` tables and indexes;
- `crawl.ts`: durable crawl lifecycle, webhook/poll modes, page ingestion,
  content clamping, watchdog, callbacks, cancel/resume/delete;
- `http.ts` and `signature.ts`: signed webhook route and constant-time HMAC
  verification;
- `lib.ts` and `validators.ts`: scrape/map/search requests and validators;
- `api.ts`: official transport, origin label, errors, and retry policy;
- `upstreamClient.ts`: full official application-side client and types;
- upstream tests for crawl, lib, signature, and setup.

Generated declarations are regenerated locally from this complete schema and
function tree; they are not a replacement implementation.

## RoomScout additions

- `monitor.ts`: Firecrawl v2 Native Monitoring endpoints.
- `interact.ts`: Firecrawl v2 Interact execute/stop endpoints.
- `contracts.ts`: provider-ID, pagination, and Interact input guards.
- `client.ts`: extends the official client with Monitor and Interact methods.
- `contracts.test.ts` and `extensions.test.ts`: focused extension tests.

The only shared transport changes in `api.ts` are:

1. support for `PATCH`, required by monitor updates;
2. a per-request `maxRetries` override;
3. extension mutations can set `maxRetries: 0`.

The official `origin: "firecrawl-convex"` attribution is unchanged.

The component name in `convex.config.ts` is
`firecrawlRoomScout` to avoid colliding with the published package if both are
mounted during evaluation.

## Updating from upstream

1. Fetch the exact upstream tag/commit and compare every preserved file.
2. Apply upstream changes first without changing their tests.
3. Reapply the small `api.ts` transport delta above.
4. Keep Monitor and Interact as additive modules.
5. Regenerate component declarations.
6. Run upstream tests plus the RoomScout extension tests.
7. Update this file with the new commit and any semantic conflict.

Do not copy provider credentials, browser profiles, session URLs, or application
approval state into this directory.

