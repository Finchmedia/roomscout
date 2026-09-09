import { Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

// This pool runs interpretation only. External writes use separate ledgers and
// must not inherit automatic retries from read-only AI work.
export const scoutWorkpool = new Workpool(components.scoutWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 2_000, base: 2 },
});

// Passive inbox reads are serialized independently. This pool must never carry
// a browser write because automatic retries are enabled.
export const browserWorkpool = new Workpool(components.browserWorkpool, {
  maxParallelism: 1,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 5_000, base: 2 },
});
