import { Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

// This pool runs interpretation only. External writes use separate ledgers and
// must not inherit automatic retries from read-only AI work.
export const scoutWorkpool = new Workpool(components.scoutWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 2_000, base: 2 },
});

// One execution queue for every controlled-portal browser operation: inbox
// reads AND approved writes are serialized here. Retries are opt-in per
// enqueue: reads pass retry: true (defaultRetryBehavior), writes pass
// retry: false because a browser write must never be replayed automatically.
export const browserWorkpool = new Workpool(components.browserWorkpool, {
  maxParallelism: 1,
  retryActionsByDefault: false,
  defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 5_000, base: 2 },
});
