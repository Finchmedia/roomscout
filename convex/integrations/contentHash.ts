export async function contentHash(parts: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join("\u001f"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Object key order can change at a Convex serialization boundary. Hash values,
 * not incidental insertion order; keep array order and omit optional fields. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return item;
  });
}

export async function actionPayloadHash(payload: unknown): Promise<string> {
  return contentHash([canonicalJson(payload)]);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}
