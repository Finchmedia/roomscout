# RoomScout Firecrawl Convex component

This directory is a source-preserving local fork of
[`@firecrawl/firecrawl-convex@0.1.1`](https://github.com/firecrawl/firecrawl-convex)
at upstream commit
[`d4056f1e70b6a459ed88df2bb97fa2016816a751`](https://github.com/firecrawl/firecrawl-convex/commit/d4056f1e70b6a459ed88df2bb97fa2016816a751).

It retains the complete official component:

- one-shot `scrape`, `map`, and `search`;
- durable `crawl` jobs with webhook or polling progress;
- reactive crawl/page storage, pagination, cancellation, resume, and deletion;
- signed webhook verification and per-crawl callback tokens;
- content-size clamping and terminal callback handling.

RoomScout adds two Firecrawl v2 surfaces which the published component does not
currently expose:

- Native Monitoring: create/list/get/update/delete/run monitors and inspect
  checks;
- Interact: execute one prompt or Node/Python/Bash program against a scrape
  browser session, then stop that session.

The upstream MIT license is preserved in [`LICENSE`](./LICENSE). See
[`UPSTREAM.md`](./UPSTREAM.md) for the provenance and exact extension delta.

## Mounting

The app owns the mount; this component intentionally contains no RoomScout
authentication or product policy.

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import { v } from "convex/values";
import firecrawlRoomScout from "./components/firecrawlRoomScout/convex.config.js";

const app = defineApp({
  env: {
    FIRECRAWL_API_KEY: v.string(),
    FIRECRAWL_API_URL: v.optional(v.string()),
    FIRECRAWL_WEBHOOK_SECRET: v.optional(v.string()),
  },
});

app.use(firecrawlRoomScout, {
  httpPrefix: "/api/components/firecrawl/",
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
    FIRECRAWL_API_URL: app.env.FIRECRAWL_API_URL,
    FIRECRAWL_WEBHOOK_SECRET: app.env.FIRECRAWL_WEBHOOK_SECRET,
  },
});

export default app;
```

After changing the component surface, regenerate component and app declarations
from the mounted app (Convex discovers the local component automatically):

```sh
npx convex codegen
```

When `httpPrefix` is mounted as above, the official durable-crawl webhook is
served at `/api/components/firecrawl/webhook`.

## Client

```ts
import { components } from "../../_generated/api";
import { FirecrawlRoomScoutClient } from "./client";

const firecrawl = new FirecrawlRoomScoutClient(
  components.firecrawlRoomScout,
);

// Every method takes the current Convex ctx first.
const page = await firecrawl.scrape(ctx, url, {
  formats: ["markdown"],
});

const monitor = await firecrawl.createMonitor(ctx, {
  name: "RoomScout Hamburg supply",
  schedule: { text: "daily at 06:00", timezone: "Europe/Berlin" },
  targets: [
    {
      type: "scrape",
      urls: ["https://example.com/rehearsal-rooms"],
      scrapeOptions: { formats: ["markdown", "links"] },
    },
  ],
  webhook: {
    url: "https://example.convex.site/api/webhooks/firecrawl",
    headers: { Authorization: "Bearer <secret>" },
    events: ["monitor.page", "monitor.check.completed"],
  },
});

const check = await firecrawl.getMonitorCheck(
  ctx,
  monitor.id,
  checkId,
  { limit: 100, skip: 0 },
);
```

The upstream `FirecrawlClient` and all its types remain exported from
[`client.ts`](./client.ts), so existing scrape/map/search/crawl callers keep
the official API.

## Interact contract

A scrape response contains `metadata.scrapeId`. Interact resumes that browser
state. Firecrawl reuses it for later calls with the same ID.

```ts
const result = await firecrawl.interact(ctx, scrapeId, {
  code: `
    await page.getByLabel("Your email").fill(approvedFrom);
    await page.getByLabel("Message").fill(approvedBody);
    return await page.screenshot({ encoding: "base64" });
  `,
  language: "node",
  timeout: 60,
  mutating: true,
});
```

Rules enforced at the component boundary:

- exactly one of `code` or `prompt`;
- code at most 100,000 characters, prompt at most 10,000;
- language `node`, `python`, or `bash`;
- timeout clamped to Firecrawl's documented 1–300 second range;
- provider IDs are URI-encoded before becoming URL path segments;
- `mutating: true` disables automatic request replay.

`mutating` is deliberately required. RoomScout must set it to true for any
program which might click, type, submit, purchase, register, log in, or make
another external change. The app must persist exact user approval before
calling such a program. The component never approves or sends on its own.

Call `stopInteraction(ctx, scrapeId)` when done so the browser is not billed
until its TTL expires.

## Responsibility boundary

The component is provider transport and durable crawl state. RoomScout's app
wrappers remain responsible for:

- Convex Auth ownership and operator authorization;
- source policy/robots review;
- approval hashes and exact-recipient/exact-content checks;
- rate limits, spend limits, audit events, and idempotency keys;
- treating scraped pages and model instructions as untrusted input;
- preventing credentials, cookies, live-view URLs, and private contacts from
  entering public queries or logs.

Native Monitor mutations and mutating Interact calls use zero transport retries
to avoid duplicate monitor creation, duplicate manual checks, or duplicate form
submissions. Read-only requests keep the upstream transient retry policy.
