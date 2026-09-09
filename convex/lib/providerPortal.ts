import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { actionPayloadHash, normalizeText } from "../integrations/contentHash";

/** Resolve only the reviewed controlled portal; AI never selects a destination. */
export async function resolveControlledPortal(ctx: QueryCtx, conversation: Doc<"providerConversations">, signal: Doc<"signals">, now: number) {
    const entry = signal.sourceEntryId ? await ctx.db.get(signal.sourceEntryId) : null;
    const source = entry ? await ctx.db.get(entry.sourceId) : null;
    const platform = source?.platformId ? await ctx.db.get(source.platformId) : null;
    if (!entry || !source || platform?.canonicalDomain !== "roomscout.dev") return null;
    const listingUrl = new URL(entry.detailUrl);
    if (listingUrl.origin !== "https://roomscout.dev" || !/^\/listings\/[a-zA-Z0-9_-]+$/.test(listingUrl.pathname)) return null;
    const bindings = await ctx.db.query("sourceAdapterBindings").withIndex("by_platform_and_flow_and_status", (q) =>
      q.eq("platformId", platform._id).eq("flow", "contact").eq("status", "active"),
    ).take(20);
    const binding = bindings.find((row) => row.executor === "browserbase" && row.adapterKey === "roomscout-dev-v1" && row.adapterVersion === 1 &&
      row.config.kind === "browserbase" && row.config.workflowKey === "roomscout-dev.platform-message.v1");
    const policy = binding?.policyVersionId ? await ctx.db.get(binding.policyVersionId) : null;
    if (!binding || !policy || policy.status !== "approved" || policy.decision !== "allowed" ||
      policy.platformId !== platform._id || policy.flow !== "contact" || policy.maxAutomationLevel !== "approved_execute" ||
      policy.robotsDecision !== "allowed" || policy.termsDecision !== "allowed" || (policy.nextReviewAt !== undefined && policy.nextReviewAt <= now)) return null;
    // Public listing ingestion and authenticated messaging deliberately have
    // different Source rows. Resolve the connection through the contact adapter.
    const connectedSourceId = binding.sourceId ?? source._id;
    const connectedSource = await ctx.db.get(connectedSourceId);
    if (!connectedSource || connectedSource.platformId !== platform._id ||
      new URL(connectedSource.baseUrl).origin !== "https://roomscout.dev" ||
      (policy.sourceId && policy.sourceId !== connectedSourceId)) return null;
    const thread = conversation.platformThreadId ? await ctx.db.get(conversation.platformThreadId) : null;
    const connection = thread ? await ctx.db.get(thread.connectionId) : await ctx.db.query("portalConnections").withIndex("by_owner_and_source", (q) => q.eq("ownerId", conversation.ownerId).eq("sourceId", connectedSourceId)).unique();
    if (!connection || connection.ownerId !== conversation.ownerId || connection.sourceId !== connectedSourceId ||
      connection.status !== "active" || connection.policyDecision !== "allowed" || connection.adapterKey !== "roomscout-dev-v1" ||
      connection.platformId !== platform._id || (thread && thread.ownerId !== conversation.ownerId)) return null;
    return { entry, source, platform, listingUrl, binding, policy, connection, thread };
}

export async function portalDestinationHash(target: NonNullable<Awaited<ReturnType<typeof resolveControlledPortal>>>) {
  return actionPayloadHash({
    platformId: target.platform._id, connectionId: target.connection._id,
    threadId: target.thread?._id, providerThreadId: target.thread?.providerThreadId,
    recipients: [...new Set((target.thread?.participants ?? []).map(normalizeText))].sort(),
    bindingId: target.binding._id, policyId: target.policy._id,
  });
}
