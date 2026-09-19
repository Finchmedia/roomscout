function unsafeHostname(hostname: string): boolean {
  const host = hostname.toLocaleLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host.includes(".") || host.includes(":")) return true;
  if ([".local", ".localhost", ".internal", ".home.arpa", ".lan", ".test", ".invalid"].some((suffix) => host.endsWith(suffix))) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const a = octets[0]!;
  const b = octets[1]!;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b! >= 64 && b! <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168);
}

export function normalizePublicImageUrl(value: unknown, baseUrl?: string): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > 2_048) return undefined;
  try {
    const url = baseUrl ? new URL(value.trim(), baseUrl) : new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || unsafeHostname(url.hostname)) return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Selects an image Firecrawl observed in explicit image output or visible Markdown. */
export function publicImageUrlFromDocument(args: {
  pageUrl: string;
  markdown?: string;
  images?: unknown;
}): string | undefined {
  const candidates: unknown[] = Array.isArray(args.images) ? args.images : [];
  for (const match of args.markdown?.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g) ?? []) {
    candidates.push(match[1] ?? match[2]);
  }
  for (const value of candidates) {
    const normalized = normalizePublicImageUrl(value, args.pageUrl);
    if (normalized) return normalized;
  }
  return undefined;
}
