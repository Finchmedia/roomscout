import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "run due Firecrawl change-tracking targets",
  { minutes: 15 },
  internal.firecrawl.runDueTargets,
  {},
);

crons.interval(
  "mark old market signals stale",
  { hours: 6 },
  internal.ingestion.markStaleSignals,
  { maxAgeMs: 30 * 24 * 60 * 60 * 1_000, limit: 100 },
);

export default crons;
