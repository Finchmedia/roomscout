/// <reference types="vite/client" />
import type { TestConvex } from "convex-test";
import type schema from "./schema";

/** One `work` row of the browser pool component (see @convex-dev/workpool/src/component/schema.ts). */
export type PendingPortalWrite = {
  fnName: string;
  fnArgs?: Record<string, unknown>;
  retryBehavior?: { maxAttempts: number; initialBackoffMs: number; base: number };
  attempts: number;
};

/**
 * Write-worker items currently held by the shared browser pool. The pool
 * schedules through its own component tables, not the root
 * _scheduled_functions, so tests read the component's `work` table through
 * convex-test's (untyped at runtime) runInComponent.
 */
export async function pendingPortalWrites(t: TestConvex<typeof schema>): Promise<PendingPortalWrite[]> {
  const runInComponent = (t as unknown as {
    runInComponent: (componentPath: string, handler: (ctx: {
      db: { query: (table: "work") => { collect: () => Promise<PendingPortalWrite[]> } };
    }) => Promise<PendingPortalWrite[]>) => Promise<PendingPortalWrite[]>;
  }).runInComponent;
  const rows = await runInComponent("browserWorkpool", async (ctx) => await ctx.db.query("work").collect());
  return rows.filter((row) => row.fnName.endsWith(":executeApprovedWriteWorker"));
}
