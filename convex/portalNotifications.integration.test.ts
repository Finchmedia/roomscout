/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import workpoolTest from "@convex-dev/workpool/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { parseAgentMailEvent } from "./integrations/agentmailPayload";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
const notification = (email: string) => ({
  providerMessageId: "mail-1", from: "RoomScout Community <notifications@roomscout.dev>", to: [email],
  subject: "New message about Controlled room",
  body: "You have a new RoomScout Community message.\n\nProvider sent a message about “Controlled room”.\nSign in to read and reply:\nhttps://roomscout.dev/inbox/thread_123\n\nThe message itself is intentionally not copied into this notification.",
});

async function fixture() {
  const t = convexTest(schema, modules);
  workpoolTest.register(t, "browserWorkpool");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "hint-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const email = "owner@agentmail.to";
    await ctx.db.insert("userMailboxes", { ownerId, provider: "agentmail", providerInboxId: "inbox-1", emailAddress: email, clientId: "owner-client", status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "roomscout-dev", name: "RoomScout Community", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("sources", { platformId, slug: "roomscout-dev-connected", name: "Controlled messages", baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", automationReview: "approved", adapterKey: "roomscout-dev-v1", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
    const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId, platformId, label: "Controlled", allowedDomains: ["roomscout.dev"], allowedPaths: ["/inbox"], inboxPath: "/inbox", adapterKey: "roomscout-dev-v1", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, nextPollAt: now + 30 * 60_000, failureCount: 0, createdAt: now, updatedAt: now });
    await ctx.db.insert("browserContexts", { connectionId, ownerId, providerContextId: "context-1", status: "ready", createdAt: now, updatedAt: now });
    return { ownerId, connectionId, email };
  });
  const consume = (overrides = {}) => t.mutation(internal.portalNotifications.consumeOwnedMailboxHint, { ownerId: ids.ownerId, ...notification(ids.email), ...overrides });
  return { t, ...ids, consume };
}

describe("portal notification hints", () => {
  it("coalesces an exact controlled notification into the normal due-inbox coordinator", async () => {
    const f = await fixture();
    expect(await f.consume()).toEqual({ triggered: true, reason: "scheduled" });
    expect((await f.t.run((ctx) => ctx.db.get(f.connectionId)))?.inboxSyncActiveGeneration).toBe(1);
    expect(await f.consume({ providerMessageId: "mail-2" })).toEqual({ triggered: false, reason: "coalesced" });
  });

  it("accepts ordinary CRLF transport without flattening the template", async () => {
    const f = await fixture(); const mail = notification(f.email);
    expect(await f.consume({ body: mail.body.replace(/\n/g, "\r\n") })).toEqual({ triggered: true, reason: "scheduled" });
  });

  it("accepts the representative extracted_text selected by the real AgentMail normalizer", async () => {
    const f = await fixture(); const mail = notification(f.email);
    const parsed = parseAgentMailEvent({ event_type: "message.received", event_id: "event-extracted", message: {
      inbox_id: "inbox-1", thread_id: "mail-thread", message_id: "mail-extracted", from: mail.from,
      to: mail.to, subject: mail.subject, extracted_text: `  ${mail.body.replace(/\n/g, "\r\n")}  `,
      text: "This fallback must not win.", timestamp: Date.now(),
    } });
    if (!parsed || parsed.kind !== "received") throw new Error("normalizer rejected representative event");
    expect(parsed.body).toBe(mail.body.replace(/\n/g, "\r\n"));
    expect(await f.consume({ providerMessageId: parsed.providerMessageId, from: parsed.from, to: parsed.to, subject: parsed.subject, body: parsed.body })).toEqual({ triggered: true, reason: "scheduled" });
  });

  it.each([
    ["unrelated sender", { from: "attacker@example.com" }, "unrelated"],
    ["arbitrary URL", { body: notification("owner@agentmail.to").body.replace("https://roomscout.dev/inbox/thread_123", "https://evil.example/inbox/thread_123") }, "unrelated"],
    ["credential text", { body: `${notification("owner@agentmail.to").body}\nPassword: secret` }, "unrelated"],
    ["own message", { from: "owner@agentmail.to" }, "own_message"],
    ["bulk recipient", { to: ["owner@agentmail.to", "other@example.com"] }, "bulk_message"],
    ["unknown template", { subject: "Please open this immediately" }, "unrelated"],
  ])("ignores %s", async (_label, overrides, reason) => {
    const f = await fixture();
    expect(await f.consume(overrides)).toEqual({ triggered: false, reason });
    expect((await f.t.run((ctx) => ctx.db.get(f.connectionId)))?.inboxSyncActiveGeneration).toBeUndefined();
  });

  it("requires the owner's active reviewed authenticated connection and ready context", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.connectionId, { status: "reauth_required" }));
    expect(await f.consume()).toEqual({ triggered: false, reason: "connection_unavailable" });
  });

  it("wires an unmatched owned AgentMail receipt to the bounded hint consumer", async () => {
    const f = await fixture(); const mail = notification(f.email);
    await f.t.run((ctx) => ctx.db.insert("providerEvents", { provider: "agentmail", providerEventId: "event-1", eventType: "message.received", payloadHash: "event-hash", status: "received", receivedAt: Date.now() }));
    await f.t.action(internal.agentmail.processInboundMessage, {
      providerEventId: "event-1", inboxId: "inbox-1", providerThreadId: "mail-thread-1",
      providerMessageId: mail.providerMessageId, from: mail.from, to: mail.to, subject: mail.subject,
      body: mail.body, needsFullFetch: false, htmlAvailable: false, receivedAt: Date.now(), retryCount: 3,
    });
    expect((await f.t.run((ctx) => ctx.db.get(f.connectionId)))?.inboxSyncActiveGeneration).toBe(1);
    expect(await f.t.run((ctx) => ctx.db.query("mailboxMessages").collect())).toHaveLength(1);
  });
});
