import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "reconcile Firecrawl native monitors",
  { minutes: 15 },
  internal.firecrawl.runDueTargets,
  {},
);

crons.interval(
  "recover interrupted approved outreach sends",
  { minutes: 5 },
  internal.outreach.recoverStuckSending,
  { olderThanMs: 10 * 60 * 1_000, limit: 20 },
);

crons.interval(
  "mark old market signals stale",
  { hours: 6 },
  internal.ingestion.markStaleSignals,
  { maxAgeMs: 30 * 24 * 60 * 60 * 1_000, limit: 100 },
);

crons.interval(
  "poll one reviewed platform inbox",
  { minutes: 30 },
  internal.browserbasePortal.scheduleDueInboxSync,
  {},
);

crons.interval(
  "orchestrate standing RoomScout mandates",
  { minutes: 10 },
  internal.mandateOrchestrator.runBatch,
  { limit: 8 },
);

crons.interval(
  "reap abandoned external action executions",
  { minutes: 5 },
  internal.externalActions.reapStaleExecutions,
  { olderThanMs: 15 * 60 * 1_000, limit: 40 },
);

export default crons;
