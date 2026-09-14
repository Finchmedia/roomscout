/**
 * The `detail` of an Entscheidung as the backend writes it
 * (convex/lib/decisions.ts gateDecisionSpec): for `private_data` the
 * highlighted scopes come first ("Datenfelder: a, b"), then the message.
 */
const SCOPES_PREFIX = "Datenfelder: ";

export function splitDecisionDetail(decision: { kind: string; detail?: string }): { scopes: string[]; message?: string } {
  const detail = decision.detail;
  if (!detail) return { scopes: [] };
  if (decision.kind === "private_data" && detail.startsWith(SCOPES_PREFIX)) {
    const [head = "", ...rest] = detail.split("\n\n");
    const scopes = head.slice(SCOPES_PREFIX.length).split(/[,;]\s*/).map((item) => item.trim()).filter(Boolean);
    const message = rest.join("\n\n").trim();
    return { scopes, ...(message ? { message } : {}) };
  }
  return { scopes: [], message: detail };
}
