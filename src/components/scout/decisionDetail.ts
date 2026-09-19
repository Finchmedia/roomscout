/**
 * The `detail` of an Entscheidung as the backend writes it
 * (convex/lib/decisions.ts gateDecisionSpec): for `private_data` the
 * highlighted scopes come first ("Datenfelder: a, b"), then the message.
 */
const SCOPES_PREFIX = "Datenfelder: ";

export function splitDecisionDetail(decision: { kind: string; detail?: string }): { scopes: string[]; subject?: string; message?: string } {
  const detail = decision.detail;
  if (!detail) return { scopes: [] };
  let scopes: string[] = [];
  let content = detail;
  if (decision.kind === "private_data" && detail.startsWith(SCOPES_PREFIX)) {
    const [head = "", ...rest] = detail.split("\n\n");
    scopes = head.slice(SCOPES_PREFIX.length).split(/[,;]\s*/).map((item) => item.trim()).filter(Boolean);
    content = rest.join("\n\n");
  }
  const labelled = content.match(/^(?:Subject|Betreff):\n([^\n]*)\n\n(?:Message|Nachricht):\n([\s\S]*)$/);
  if (labelled) return { scopes, subject: labelled[1], message: labelled[2] };
  return { scopes, message: content };
}
