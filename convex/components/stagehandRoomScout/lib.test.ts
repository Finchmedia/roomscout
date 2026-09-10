/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const recordSession = makeFunctionReference<
  "mutation",
  {
    sessionId: string;
    region: "eu-central-1";
    contextId?: string;
    persistContext?: boolean;
    lastUrl?: string;
  },
  null
>("lib:recordSession");
const updateSession = makeFunctionReference<
  "mutation",
  {
    sessionId: string;
    status?: "active" | "completed" | "error";
    lastUrl?: string;
    error?: string;
    endedAt?: number;
  },
  null
>("lib:updateSession");
const getSession = makeFunctionReference<
  "query",
  { sessionId: string },
  {
    sessionId: string;
    region: "us-west-2" | "us-east-1" | "eu-central-1" | "ap-southeast-1";
    contextId?: string;
    persistContext?: boolean;
    lastUrl?: string;
    startedAt: number;
    endedAt?: number;
    status: "active" | "completed" | "error";
    error?: string;
  } | null
>("lib:getSession");

describe("Stagehand v4 session metadata", () => {
  it("records the same provider session idempotently without replacing its start time", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(recordSession, {
      sessionId: "provider-session",
      region: "eu-central-1",
      lastUrl: "https://roomscout.dev/sign-up",
    });
    const initial = await t.query(getSession, { sessionId: "provider-session" });
    await t.mutation(recordSession, {
      sessionId: "provider-session",
      region: "eu-central-1",
      contextId: "context-1",
      persistContext: true,
      lastUrl: "https://roomscout.dev/inbox",
    });
    const updated = await t.query(getSession, { sessionId: "provider-session" });

    expect(updated).toMatchObject({
      sessionId: "provider-session",
      contextId: "context-1",
      persistContext: true,
      lastUrl: "https://roomscout.dev/inbox",
      status: "active",
      startedAt: initial?.startedAt,
    });
    const rows = await t.run(async (ctx) => await ctx.db.query("sessions").collect());
    expect(rows).toHaveLength(1);
  });

  it("records completion metadata without attempting provider cleanup", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(recordSession, {
      sessionId: "completed-session",
      region: "eu-central-1",
    });
    await t.mutation(updateSession, {
      sessionId: "completed-session",
      status: "completed",
      endedAt: 42,
    });

    await expect(
      t.query(getSession, { sessionId: "completed-session" }),
    ).resolves.toMatchObject({ status: "completed", endedAt: 42 });
  });

  it("leaves an unknown provider session as a no-op", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(updateSession, {
        sessionId: "missing-session",
        status: "error",
        error: "bounded diagnostic",
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(getSession, { sessionId: "missing-session" }),
    ).resolves.toBeNull();
  });
});
