import { v, type Infer } from "convex/values";

/**
 * Outcome of the portal-side reset that a demo reset triggers: the app POSTs the
 * owner's portal identities to the property portal's `/participant-reset`
 * endpoint, and the portal wipes its threads, messages, landlord-agent state and
 * the agent's chat thread for those participants asynchronously.
 *
 * - "done": the portal accepted (202), which per the contract means it matched at
 *   least one portal user; `matched` and `resetIds` are 0 and [] if the reply body
 *   could not be read.
 * - "none_matched": the portal answered 200 with no matching portal user, or the
 *   owner has no mailbox address to identify them with.
 * - "skipped_not_configured": PORTAL_RESET_URL or PORTAL_RESET_SECRET is unset.
 * - "failed": non-2xx, timeout or network error; `error` carries a code only.
 * A failure never blocks or fails the app-side reset.
 */
export const portalResetValidator = v.object({
  status: v.union(
    v.literal("done"),
    v.literal("none_matched"),
    v.literal("skipped_not_configured"),
    v.literal("failed"),
  ),
  matched: v.optional(v.number()),
  resetIds: v.optional(v.array(v.string())),
  error: v.optional(v.string()),
  at: v.number(),
});

export type PortalReset = Infer<typeof portalResetValidator>;

/** The contract caps a reset request at five addresses. */
export const PORTAL_RESET_MAX_ADDRESSES = 5;

/** Portal identities the band registered with: mailbox addresses, lowercased, deduplicated, capped. */
export function portalIdentities(emailAddresses: ReadonlyArray<string | undefined>): string[] {
  const seen = new Set<string>();
  for (const address of emailAddresses) {
    const normalized = address?.trim().toLowerCase();
    if (normalized) seen.add(normalized);
  }
  return [...seen].slice(0, PORTAL_RESET_MAX_ADDRESSES);
}

/** Narrows the portal's JSON reply; unexpected shapes fall back to zero matches. */
export function parsePortalResetReply(body: unknown): { matched: number; resetIds: string[] } {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const matched = typeof record.matched === "number" && Number.isFinite(record.matched) ? record.matched : 0;
  const resetIds = Array.isArray(record.resetIds)
    ? record.resetIds.filter((id): id is string => typeof id === "string")
    : [];
  return { matched, resetIds };
}
