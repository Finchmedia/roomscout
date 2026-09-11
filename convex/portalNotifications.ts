import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
type HintResult = { triggered: boolean; reason: "scheduled" | "coalesced" | "unrelated" | "own_message" | "bulk_message" | "connection_unavailable" };

const resultValidator = v.object({
  triggered: v.boolean(),
  reason: v.union(
    v.literal("scheduled"),
    v.literal("coalesced"),
    v.literal("unrelated"),
    v.literal("own_message"),
    v.literal("bulk_message"),
    v.literal("connection_unavailable"),
  ),
});

const SUBJECT_PREFIX = "New message about ";
const PORTAL_NOTIFICATION_SENDER = "roomscout-notifications@agentmail.to";
const BODY_PREFIX = "You have a new RoomScout Community message.\n\n";
const BODY_SUFFIX = "\n\nThe message itself is intentionally not copied into this notification.";
const THREAD_URL = /\nSign in to read and reply:\n(https:\/\/roomscout\.dev\/inbox\/([A-Za-z0-9_-]+))\n/;

function emailAddress(value: string): string {
  const match = value.trim().toLowerCase().match(/(?:<)?([^<>\s]+@[^<>\s]+)(?:>)?$/);
  return match?.[1] ?? "";
}

/** Treats a code-owned portal email as a bounded wake-up hint only. The URL and
 * provider thread id are never passed to Browserbase; the reviewed connection's
 * fixed inbox path remains the sole browser target. */
export const consumeOwnedMailboxHint = internalMutation({
  args: {
    ownerId: v.id("users"),
    providerMessageId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
  },
  returns: resultValidator,
  handler: async (ctx, args): Promise<HintResult> => {
    const mailbox = await ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).unique();
    if (!mailbox?.emailAddress || mailbox.status !== "active") return { triggered: false, reason: "connection_unavailable" as const };
    const mailboxAddress = mailbox.emailAddress.trim().toLowerCase();
    const recipients = args.to.map(emailAddress).filter(Boolean);
    if (emailAddress(args.from) === mailboxAddress) return { triggered: false, reason: "own_message" as const };
    if (recipients.length !== 1 || recipients[0] !== mailboxAddress) return { triggered: false, reason: "bulk_message" as const };
    const sender = emailAddress(args.from);
    const senderDomain = sender.split("@")[1] ?? "";
    // Keep legacy portal mail working during cutover; AgentMail is shared by other users.
    const isPortalSender = senderDomain === "roomscout.dev" || sender === PORTAL_NOTIFICATION_SENDER;
    const body = args.body.replace(/\r\n/g, "\n");
    const urlMatch = body.match(THREAD_URL);
    if (!isPortalSender || !args.subject.startsWith(SUBJECT_PREFIX) || args.subject.length <= SUBJECT_PREFIX.length ||
      !body.startsWith(BODY_PREFIX) || !body.endsWith(BODY_SUFFIX) || !urlMatch || body.match(/https?:\/\//g)?.length !== 1) {
      return { triggered: false, reason: "unrelated" as const };
    }
    try {
      const parsed = new URL(urlMatch[1]!);
      if (parsed.protocol !== "https:" || parsed.hostname !== "roomscout.dev" || parsed.port || parsed.search || parsed.hash ||
        parsed.pathname !== `/inbox/${urlMatch[2]}`) return { triggered: false, reason: "unrelated" as const };
    } catch {
      return { triggered: false, reason: "unrelated" as const };
    }

    const connections = await ctx.db.query("portalConnections").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).take(20);
    let connection = null;
    for (const candidate of connections) {
      if (candidate.status !== "active" || candidate.policyDecision !== "allowed" || !candidate.allowInboxPolling ||
        candidate.adapterKey !== "roomscout-dev-v1" || candidate.inboxPath !== "/inbox" ||
        candidate.allowedDomains.length !== 1 || candidate.allowedDomains[0] !== "roomscout.dev") continue;
      const source = await ctx.db.get(candidate.sourceId);
      const platform = candidate.platformId ? await ctx.db.get(candidate.platformId) : source?.platformId ? await ctx.db.get(source.platformId) : null;
      const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", candidate._id)).order("desc").first();
      if (source?.slug === "roomscout-dev-connected" && source.accessMode === "authenticated" && source.automationReview === "approved" &&
        platform?.canonicalDomain === "roomscout.dev" && context?.status === "ready") {
        connection = candidate;
        break;
      }
    }
    if (!connection) return { triggered: false, reason: "connection_unavailable" as const };
    const requested: { status: "queued" | "coalesced" | "ignored" } = await ctx.runMutation(internal.portalInboxSync.requestSync, {
      ownerId: args.ownerId, connectionId: connection._id,
      reason: "notification", receiptKey: `agentmail:${args.providerMessageId}`,
    });
    return requested.status === "queued"
      ? { triggered: true, reason: "scheduled" as const }
      : { triggered: false, reason: requested.status === "coalesced" ? "coalesced" as const : "connection_unavailable" as const };
  },
});
