# Source gathering from the CLI

Every step is an internal Convex function, so `npx convex run` drives it without
an operator session. Add `--prod` to target production.

**Nothing here starts recurring work.** Promotion leaves targets paused,
activation keeps them paused unless `monitoring: true` is passed, and a
Firecrawl monitor is only ever created for an unpaused target. Collection
happens through explicit one-time scrapes.

## Measured costs

| operation | credits |
| --- | --- |
| one search query (5 results) | 2 |
| one page scrape | 1 |
| full 600-query sweep | ~1,200 |

Check the balance any time:

```sh
KEY=$(npx convex env get FIRECRAWL_API_KEY --prod)
curl -s -H "Authorization: Bearer $KEY" https://api.firecrawl.dev/v2/team/credit-usage
```

## 1. Status

```sh
npx convex run sourcePipeline:summary '{}' --prod
```

## 2. Seed the city geo areas (once)

Resolves candidates to a city and enables coverage attribution.

```sh
npx convex run sourcePipeline:seedGeoAreas '{}' --prod
```

## 3. Discovery sweep

600 queries: 150 German cities above ~40k inhabitants x 4 source families.
Queries are city-scoped on purpose - region-wide and country-wide queries return
aggregators and social posts instead of local operators.

Dry run, one batch, no chaining (~20 credits):

```sh
npx convex run sourceDiscoveryActions:sweepGermany \
  '{"maxQueries":10,"queriesPerBatch":10,"chain":false}' --prod
```

Full sweep. Each invocation runs a batch and schedules the next one, so it
finishes on its own in roughly 10-20 minutes with no cron and no babysitting:

```sh
npx convex run sourceDiscoveryActions:sweepGermany '{}' --prod
```

Arguments: `cursor` (resume point), `queriesPerBatch` (default 10, max 25),
`resultsPerQuery` (default 5, max 10), `maxQueries` (credit budget),
`chain` (default true), `delayMs` (default 2000).

Discovery only writes `sourceCandidates`. Candidates are invisible to users.
Search engines and social hosts are rejected outright; restricted marketplaces
(kleinanzeigen, ebay) are kept at confidence 0.2 with a `[ToS review required]`
marker so they sort last in review.

## 3b. Stopping a running sweep

The sweep is a single chain: each invocation schedules exactly one successor, so
at most one job is ever queued. Cancelling it ends the chain; nothing re-arms
it.

```sh
npx convex run sourcePipeline:scheduledWork '{}' --prod   # what is queued
npx convex run sourcePipeline:stopSweep '{}' --prod       # stop the chain
npx convex run sourcePipeline:clearStopRequest '{}' --prod # allow runs again
```

`stopSweep` does two things: it cancels any queued job AND raises a persisted
stop flag. The flag is what makes the stop reliable - a worker that is mid-batch
has not queued its successor yet, so there is nothing to cancel, and it checks
the flag before re-arming instead. Clear the flag before starting a new run.

`stopSweep '{"includeDetailBacklog":true}'` also stops the detail scrape worker,
which self-chains the same way. Other brakes: `maxQueries` is a hard credit
budget, `chain: false` runs one batch and stops, and the Convex dashboard's
Schedules view cancels by hand. Left alone, a sweep ends itself at query 600.

## 3c. Operator-supplied venue names

A study or a local list gives venue names, not URLs. This resolves each name
with one search and files the best hit as a candidate at confidence 0.7, above
search-discovered candidates, because a human already vouched for the venue.
Ranking prefers the venue's own domain over documents and ticketing aggregators
that merely mention it.

```sh
npx convex run sourceDiscoveryActions:resolveNamedVenues '{}' --prod
npx convex run sourceDiscoveryActions:resolveNamedVenues \
  '{"cursor":0,"limit":6,"chain":false}' --prod
```

The list lives in `convex/lib/berlinStudyVenues.ts` (28 Berlin venues). Roughly
three in four resolve to the venue's own site; the rest land on a plausible page
and need the review queue's judgement, and anything unresolved is returned by
name in `unresolved`.

## 4. Promote candidates

Creates the platform, the source and one paused scrape target per candidate,
all in review. ToS-flagged domains are skipped unless asked for.

```sh
npx convex run sourcePipeline:promoteCandidates \
  '{"limit":25,"minConfidence":0.4}' --prod
```

Arguments: `limit`, `minConfidence`, `includeTosFlagged`, `domain`.

## 5. Activate a reviewed source

`monitoring` defaults to false: the source becomes ingestible for a one-time
scrape while its targets stay paused, so no Firecrawl monitor is provisioned.
`publicDisplay` defaults to false so an activated source does not appear in the
user-facing source list.

```sh
npx convex run sourcePipeline:activateSource '{"slug":"<source-slug>"}' --prod
npx convex run sourcePipeline:deactivateSource '{"slug":"<source-slug>"}' --prod
```

## 6. One-time scrape

Scrapes the target once and ingests through the same extraction and detail
pipeline the monitor webhook uses. Detail pages are then fetched by the
self-chaining backlog worker, one credit each.

```sh
npx convex run sourcePipelineActions:scrapeAllOnce '{}' --prod
npx convex run sourcePipelineActions:scrapeAllOnce '{"slug":"<source-slug>"}' --prod
npx convex run sourcePipelineActions:scrapeTargetOnce \
  '{"sourceTargetId":"<id>"}' --prod
```

Re-running is a no-op while the page content is unchanged; pass `"force":true`
to ingest it again.

## Turning recurring collection on later

Recurring checks need both switches:

1. `npx convex env set FIRECRAWL_MONITORS_ENABLED true --prod`
2. activate the source with `'{"slug":"...","monitoring":true}'`

The `reconcile Firecrawl native monitors` cron then creates a daily Firecrawl
monitor per unpaused target, and results arrive at the webhook instead of
through a manual scrape.

## Safety notes

- Outreach stays locked to the controlled demo portal while
  `SCOUT_CONTROLLED_PORTAL_ONLY` is unset or `true`. Real landlords are never
  emailed by ingestion.
- An activated source produces signals that are eligible for matching. Keep
  Berlin sources deactivated while recording the Berlin demo, or the demo's
  match list can contain real scraped listings.
